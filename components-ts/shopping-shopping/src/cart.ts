import {
    BaseAgent,
    agent,
    prompt,
} from '@golemcloud/golem-ts-sdk';
import {Address, CURRENCY} from "./common";


export interface CartItem {
    productId: string;
    productName: string;
    productBrand: string;
    price: number;
    quantity: number;
}

export interface Cart {
    userId: string;
    items: CartItem[];
    email?: string;
    billingAddress?: Address;
    shippingAddress?: Address;
    total: number;
    currency: string;
    previousOrderIds: string[];
    // "updated-at": DateTime;
}

export interface OrderConfirmation {
    orderId: string;
}


@agent()
export class CartAgent extends BaseAgent {
    private readonly userId: string;
    private value: Cart | undefined = undefined;

    constructor(id: string) {
        super()
        this.userId = id;
    }

    @prompt("Get cart")
    async get(): Promise<Cart | undefined> {
        return this.value;
    }
}
