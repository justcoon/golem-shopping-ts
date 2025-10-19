import {
    agent,
    prompt
} from '@golemcloud/golem-ts-sdk';

import {Product, BaseProductAgent} from "common/product";


@agent()
export class ProductAgent extends BaseProductAgent {

    constructor(id: string) {
        super()
    }

    // @prompt("Initialize product")
    // async initializeProduct(name: string, brand: string, description: string, tags: string[]) {
    //
    // }

    @prompt("Get product")
    async get(): Promise<Product | undefined> {
        return undefined
    }
}
