import {
    BaseAgent,
    agent,
    prompt,
} from '@golemcloud/golem-ts-sdk';
import {Address, CURRENCY} from "./common";


export interface OrderItem {
    productId: string;
    productName: string;
    productBrand: string;
    price: number;
    quantity: number;
}

export interface Order {
    orderId: String,
    userId: string;
    status: OrderStatus;
    items: OrderItem[];
    email?: string;
    billingAddress?: Address;
    shippingAddress?: Address;
    total: number;
    currency: string;
    // "updated-at": DateTime;
}

export enum OrderStatus {
    new,
    shipped,
    cancelled,
}

export interface CreateOrder {
    userId: string;
    items: OrderItem[];
    email?: string;
    billingAddress?: Address;
    shippingAddress?: Address;
    total: number;
    currency: string;
    // "updated-at": DateTime;
}

@agent()
export class OrderAgent extends BaseAgent {
    private value: Order = {
        orderId: "",
        userId: "",
        status: OrderStatus.new,
        items: [],
        email: undefined,
        billingAddress: undefined,
        shippingAddress: undefined,
        total: 0,
        currency: CURRENCY
    };

    constructor(id: string) {
        super()
        this.value.orderId = id;
    }

    @prompt("Create order")
    async create(order: CreateOrder) {
        this.value.userId = order.userId;
        this.value.items = order.items;
        this.value.email = order.email;
        this.value.billingAddress = order.billingAddress;
        this.value.shippingAddress = order.shippingAddress;
        this.value.total = order.total;
        this.value.currency = order.currency;
    }

    @prompt("Get order")
    async get(): Promise<Order> {
        return this.value;
    }
}
