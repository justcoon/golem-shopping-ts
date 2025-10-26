import {agent, BaseAgent, prompt} from "@golemcloud/golem-ts-sdk";

import * as llm from 'golem:llm/llm@1.0.0';
import {CartAgent} from "./cart";
import {OrderAgent, OrderItem} from "./order";
import {arrayChunks} from "./common";
import {Datetime, now} from "wasi:clocks/wall-clock@0.2.3";
import {ProductAgent, Product} from "./product";

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
            // If the item already exists, update the quantity
            existingItem.quantity += item.quantity;
        } else {
            // Create a new item with the same properties
            itemMap.set(item.productId, {
                ...item
            });
        }
    }

    return Array.from(itemMap.values());
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
    const result: Product[]  = promisesResult.filter((value) => value !== undefined);
    return result;
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
    async getRecommendedItems(): Promise<Product[]> {
        const products = await getProducts(this.recommendedItems.productIds);
        return products;
    }

    @prompt("Recommend items")
    async recommendItems(): Promise<boolean> {
        console.log("Recommend items for user: " + this.id);
        const currentItems = await getOrderItems(this.id);

        const currentItemsString = JSON.stringify(currentItems);
        let response = llm.send([{
                tag: "message",
                val: {
                    role: "user",
                    content: [{
                        tag: "text",
                        val: `We have a list of order items: ${currentItemsString}. 
                        Can you do 5 recommendations for items to buy. Return them as a valid JSON array with same format as the input. Return JSON only.`
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

        const raw = cleanMarkdownJsonString(responseContent.trim());

        try {
            console.log("Recommend items for user: " + this.id + " - processing LLM's result ...");
            const result: OrderItem[] = JSON.parse(raw);
            this.recommendedItems.productIds = result.map((value) => value.productId);
            this.recommendedItems.updatedAt = now();
            console.log("Recommend items for user: " + this.id + " - count: " + result.length);
            return true;
        } catch (err) {
            console.warn(`Recommend items for user: ${this.id} - failed to parse LLM's result: ${raw}: ${err}`)
            return false;
        }
    }
}