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
    private readonly productId: string;
    private value: Product | undefined = undefined;

    constructor(id: string) {
        super()
        this.productId = id;
    }

    @prompt("Initialize product")
    async initializeProduct(name: string, brand: string, description: string, tags: string[]) {
        this.value =  {
            productId: this.productId,
            name: name,
            brand: brand,
            description: description,
            tags: tags
        };
    }

    @prompt("Get product")
    async get(): Promise<Product | undefined> {
        return this.value;
    }
}
