import {
    BaseAgent,
    agent,
    prompt,
} from '@golemcloud/golem-ts-sdk';


export interface Product {
    productId: string;
    name: string;
    brand: string;
    description: string;
    tags: string[];
}

@agent()
export class ProductAgent extends BaseAgent {
    private value: Product = {
        productId: "",
        name: "",
        brand: "",
        description: "",
        tags: []
    };

    constructor(id: string) {
        super()
        this.value.productId = id;
    }

    @prompt("Initialize product")
    async initialize(name: string, brand: string, description: string, tags: string[]) {
        this.value.name = name;
        this.value.brand = brand;
        this.value.description = description;
        this.value.tags = tags;
    }

    @prompt("Get product")
    async get(): Promise<Product> {
        return this.value;
    }
}
