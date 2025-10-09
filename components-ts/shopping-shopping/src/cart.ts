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
    private value: Cart = {
        userId: "",
        items: [],
        email: undefined,
        billingAddress: undefined,
        shippingAddress: undefined,
        total: 0,
        currency: CURRENCY,
        previousOrderIds: []
    };

    constructor(id: string) {
        super()
        this.value.userId = id;
    }

    @prompt("Get cart")
    async get(): Promise<Cart> {
        return this.value;
    }
}
