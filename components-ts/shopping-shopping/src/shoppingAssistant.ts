import {agent, BaseAgent, prompt} from "@golemcloud/golem-ts-sdk";

import * as llm from 'golem:llm/llm@1.0.0';
import {CartAgent} from "./cart";
import {OrderAgent, OrderItem} from "./order";
import {arrayChunks} from "./common";
import {Datetime, now} from "wasi:clocks/wall-clock@0.2.3";
import {ProductAgent, Product} from "./product";

export const RECOMMENDATION_INPUT_COUNT = 100;
export const RECOMMENDATION_COUNT = 4;

export interface RecommendedItems {
    productIds: string[];
    createdAt: Datetime;
    updatedAt: Datetime;
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

async function getProducts(ids: string[]): Promise<Product[]> {
    const promises = ids.map(async (id) => await ProductAgent.get(id).get());
    const promisesResult = await Promise.all(promises);
    return promisesResult.filter((value) => value !== undefined);
}

async function getLLMRecommendations(input: OrderItem[]): Promise<string[] | undefined> {
    let llmResponse: string | undefined = undefined;
    try {
        const currentItemsString = JSON.stringify(input);
        let response = llm.send([{
                tag: "message",
                val: {
                    role: "user",
                    content: [{
                        tag: "text",
                        val: `We have a list of order items: ${currentItemsString}. 
                        Can you do ${RECOMMENDATION_COUNT} recommendations for items to buy. Return the list of productId-s as a valid JSON array. Return JSON only.`
                    }]
                }
            }],
            {
                model: "tngtech/deepseek-r1t2-chimera:free",
                providerOptions: [{
                    key: "responseFormat",
                    value: "json_object"
                }]
            }
        );
        const responseContent =
            response.content.filter(c => c.tag === "text").map(c => c.val).join();

        llmResponse = cleanMarkdownJsonString(responseContent.trim())
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

@agent()
export class ShoppingAssistantAgent extends BaseAgent {
    private readonly id: string;
    private recommendedItems: RecommendedItems;

    constructor(id: string) {
        super();
        this.id = id;
        let date = now();
        this.recommendedItems = {
            productIds: [],
            createdAt: date,
            updatedAt: date,
        };
    }

    @prompt("Get recommended items")
    async getRecommendedProducts(): Promise<Product[]> {
        const products = await getProducts(this.recommendedItems.productIds);
        return products;
    }

    @prompt("Get recommended items state")
    async getRecommendedItems(): Promise<RecommendedItems> {
        return this.recommendedItems
    }

    @prompt("Recommend items")
    async recommendItems(): Promise<boolean> {
        console.log("Recommend items for user: " + this.id);

        const currentItems = await getOrderItems(this.id);

        const llmRecommendations = await getLLMRecommendations(currentItems);

        if (llmRecommendations) {
            this.recommendedItems.productIds = llmRecommendations;
            this.recommendedItems.updatedAt = now();
            console.log("Recommend items for user: " + this.id + " - count: " + llmRecommendations.length);
            return true;
        } else {
            return false;
        }
    }
}