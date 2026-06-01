import { agent, BaseAgent, endpoint, prompt, Config, Secret, Policy, Duration, withRetryPolicy, NamedPolicy } from "@golemcloud/golem-ts-sdk";

import { CartAgent } from "./cart";
import { OrderAgent, OrderItem } from "./order";
import { arrayChunks } from "./common";
import { Datetime, now } from "wasi:clocks/wall-clock@0.2.3";

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
    try {
        const llmRetryPolicy = NamedPolicy.named(
            'shopping-assistant-llm-retry',
            Policy.exponential(Duration.milliseconds(400), 2)
                .withJitter(0.15)
                .maxRetries(3)
        );
        return await withRetryPolicy(llmRetryPolicy, async () => {
            const currentItemsString = JSON.stringify(input);
            const apiKey = config.llm.apiKey.get();
            const model = config.llm.model.get();

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
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
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`LLM recommendations - failed to get result: ${response.status} ${response.statusText}: ${errorText}`);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json() as { choices: Array<{ message: { content: string } }> };
            const concatenated = data.choices.map(c => c.message?.content ?? "").join("");
            let llmResponse = cleanMarkdownJsonString(concatenated);

            if (llmResponse) {
                try {
                    return JSON.parse(llmResponse);
                } catch (err) {
                    console.warn(`LLM recommendations - failed to parse LLM's result: ${llmResponse}: ${err}`);
                    return undefined;
                }
            }
            return undefined;
        });
    } catch (err) {
        console.warn(`LLM recommendations - failed to get result: ${err}`);
        return undefined;
    }
}

type AssistantAgentConfig = {
    llm: {
        apiKey: Secret<string>;
        model: Secret<string>;
    };
};

@agent({
    mount: '/v1/assistant/{id}'
})
export class ShoppingAssistantAgent extends BaseAgent {
    private readonly id: string;
    private readonly config: Config<AssistantAgentConfig>;
    private recommendedItems: RecommendedItems;

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

    @endpoint({ get: '/recommended-items' })
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