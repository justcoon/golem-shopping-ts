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
    orderId: string,
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
    new = "new",
    shipped = "shipped",
    cancelled = "cancelled",
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
    private readonly orderId: string;
    private value: Order | undefined = undefined;

    constructor(id: string) {
        super()
        this.orderId = id;
    }

    @prompt("Create order")
    async create(order: CreateOrder) {
        this.value = {
            orderId: this.orderId,
            userId: order.userId,
            status: OrderStatus.new,
            items: [],
            email: order.email,
            billingAddress: order.billingAddress,
            shippingAddress: order.shippingAddress,
            total: order.total,
            currency: order.currency,
        };
    }

    @prompt("Get order")
    async get(): Promise<Order | undefined> {
        return this.value;
    }
}
