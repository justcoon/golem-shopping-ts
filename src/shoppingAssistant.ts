import {agent, BaseAgent, endpoint, prompt, Config, Secret} from "@golemcloud/golem-ts-sdk";

// import * as llm from 'golem:llm/llm@1.0.0';
import {CartAgent} from "./cart";
import {OrderAgent, OrderItem} from "./order";
import {arrayChunks} from "./common";
import {Datetime, now} from "wasi:clocks/wall-clock@0.2.3";
import {OpenRouter} from "@openrouter/sdk";

export const RECOMMENDATION_INPUT_COUNT = 100;
export const RECOMMENDATION_PRODUCT_COUNT = 4;
export const RECOMMENDATION_BRAND_COUNT = 3;

export interface RecommendedItems {
    productIds: string[];
    productBrands: string[];
    createdAt: Datetime;
    updatedAt: Datetime;
}

interface LLMRecommendations {
    productIds: string[];
    productBrands: string[];
}

function cleanMarkdownJsonString(input: string): string {
    return input.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1').trim();
}

function reduceOrderItems(items: OrderItem[]): OrderItem[] {
    const itemMap = new Map<string, OrderItem>();

    for (const item of items) {
        const existingItem = itemMap.get(item.productId);

        if (existingItem) {
            existingItem.quantity += item.quantity;
        } else {
            itemMap.set(item.productId, {
                ...item
            });
        }
    }

    return Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, RECOMMENDATION_INPUT_COUNT);
}

async function getOrderItems(id: string): Promise<OrderItem[]> {

    const result: OrderItem[] = []

    const cartAgent = CartAgent.get(id);

    const cart = await cartAgent.get();

    if (cart && cart.previousOrderIds.length > 0) {
        const idsChunks = arrayChunks(cart.previousOrderIds, 5);

        for (const ids of idsChunks) {
            const promises = ids.map(async (id) => await OrderAgent.get(id).get());
            const promisesResult = await Promise.all(promises);
            for (const value of promisesResult) {
                if (value) {
                    result.push(...value.items);
                }
            }
        }
    }
    return reduceOrderItems(result);
}

async function getLLMRecommendations(input: OrderItem[], config: AssistantAgentConfig): Promise<LLMRecommendations | undefined> {
    let llmResponse: string | undefined = undefined;
    try {
        const currentItemsString = JSON.stringify(input);
        const apiKey = config.llm.apiKey.get();

        const openrouter = new OpenRouter({
            apiKey: apiKey
        });


        const response = await openrouter.chat.send({
            chatRequest: {
                model: config.llm.model,
                stream: false,
                messages: [
                    {
                        role: "system",
                        content: `You MUST respond with JSON in the following schema:
                        {
                            "type": "object",
                            "properties": {
                            "productBrands": {
                                "type": "array",
                                    "items": {"type": "string"}
                            },
                            "productIds": {
                                "type": "array",
                                    "items": {"type": "string"}
                            }
                        },
                            "required": ["productBrands", "productIds"],
                            "additionalProperties": false
                        }

                        Return ONLY valid JSON, no other text.`
                    },
                    {
                        role: "user",
                        content: `We have a list of order items: ${currentItemsString}.
                       Can you do ${RECOMMENDATION_PRODUCT_COUNT} recommendations for products items to buy based on previous order items.
                       Can you do ${RECOMMENDATION_BRAND_COUNT} recommendations for product brands to buy based on previous order items.
                       Return the list of productId-s and list of productBrand-s as a valid JSON object. Return JSON only.`
                    }
                ],
                responseFormat: {type: "json_object"}
            }
        });

        llmResponse = cleanMarkdownJsonString(response.choices[0]?.message?.content?.trim() || "");
    } catch (err) {
        const code: string = (err as any)?.code || 'N/A';
        const message: string = (err as any)?.message || 'N/A';

        console.warn(`LLM recommendations - failed to get result: ${code}, ${message}`)
    }

    if (llmResponse) {
        try {
            return JSON.parse(llmResponse);
        } catch (err) {
            console.warn(`LLM recommendations - failed to parse LLM's result: ${llmResponse}: ${err}`)
        }
    }

    return undefined
}

type AssistantAgentConfig = {
    llm: {
        apiKey: Secret<string>;
        model: string;
    };
};

@agent({
    mount: '/v1/assistant/{id}'
})
export class ShoppingAssistantAgent extends BaseAgent {
    private readonly id: string;
    private recommendedItems: RecommendedItems;
    private readonly config: Config<AssistantAgentConfig>;

    constructor(id: string, config: Config<AssistantAgentConfig>) {
        super();
        this.id = id;
        this.config = config;
        let date = now();
        this.recommendedItems = {
            productIds: [],
            productBrands: [],
            createdAt: date,
            updatedAt: date,
        };
    }

    @endpoint({get: '/recommended-items'})
    @prompt("Get recommended items state")
    async getRecommendedItems(): Promise<RecommendedItems> {
        return this.recommendedItems
    }

    @prompt("Recommend items")
    async recommendItems(): Promise<boolean> {
        console.log("Recommend items for user: " + this.id);

        const currentItems = await getOrderItems(this.id);

        const llmRecommendations = await getLLMRecommendations(currentItems, this.config.value);

        if (llmRecommendations) {
            this.recommendedItems.productIds = llmRecommendations.productIds;
            this.recommendedItems.productBrands = llmRecommendations.productBrands;
            this.recommendedItems.updatedAt = now();
            console.log("Recommend items for user: " + this.id + " - productIds count: " + llmRecommendations.productIds.length + ", productBrands count: " + llmRecommendations.productBrands.length);
            return true;
        } else {
            return false;
        }
    }
}