import {
    BaseAgent,
    agent,
    prompt,
} from '@golemcloud/golem-ts-sdk';
import {Datetime, now} from "wasi:clocks/wall-clock@0.2.3";

export interface Product {
    productId: string;
    name: string;
    brand: string;
    description: string;
    tags: string[];
    createdAt: Datetime;
    updatedAt: Datetime;
}

@agent()
export class ProductAgent extends BaseAgent {
    private readonly productId: string;
    private value: Product | undefined = undefined;

    constructor(id: string) {
        super()
        this.productId = id;
    }

    @prompt("Initialize product")
    async initializeProduct(name: string, brand: string, description: string, tags: string[]) {
        let date = now();
        this.value = {
            productId: this.productId,
            name: name,
            brand: brand,
            description: description,
            tags: tags,
            createdAt: date,
            updatedAt: date
        };
    }

    @prompt("Get product")
    async get(): Promise<Product | undefined> {
        return this.value;
    }
}
