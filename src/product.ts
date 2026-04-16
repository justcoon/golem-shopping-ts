import {
    BaseAgent,
    agent,
    endpoint,
    prompt,
} from '@golemcloud/golem-ts-sdk';
import {Datetime, now} from "wasi:clocks/wall-clock@0.2.3";

export interface ProductRequest {
    name: string;
    brand: string;
    description: string;
    tags: string[];
}

export interface Product {
    productId: string;
    name: string;
    brand: string;
    description: string;
    tags: string[];
    createdAt: Datetime;
    updatedAt: Datetime;
}

@agent({
    mount: '/v1/product/{id}'
})
export class ProductAgent extends BaseAgent {
    private readonly productId: string;
    private value: Product | undefined = undefined;

    constructor(id: string) {
        super()
        this.productId = id;
    }

    @endpoint({ post: '/' })
    @prompt("Initialize product")
    async initializeProduct(request: ProductRequest) {
        let date = now();
        this.value = {
            productId: this.productId,
            name: request.name,
            brand: request.brand,
            description: request.description,
            tags: request.tags,
            createdAt: date,
            updatedAt: date
        };
    }

    @endpoint({ get: '/' })
    @prompt("Get product")
    async get(): Promise<Product | undefined> {
        return this.value;
    }
}
