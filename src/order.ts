import {
    BaseAgent,
    agent,
    endpoint,
    prompt,
    Result
} from '@golemcloud/golem-ts-sdk';
import {Datetime, now} from "wasi:clocks/wall-clock@0.2.3";
import {Address, CURRENCY, PRICING_REGION_DEFAULT} from "./common";
import {ProductAgent} from "./product";
import {PricingAgent} from "./pricing";

export interface ProductNotFoundError {
    message: string;
    productId: string;
}

export interface PricingNotFoundError {
    message: string;
    productId: string;
}

export interface AddressNotValidError {
    message: string;
}

export interface EmailNotValidError {
    message: string;
}

export interface ItemNotFoundError {
    message: string;
    productId: string;
}

export interface ActionNotAllowedError {
    message: string;
    status: OrderStatus
}

export namespace ActionNotAllowedError {
    export function create(status: OrderStatus): ActionNotAllowedError {
        return {
            message: "Can not update order with orderStatus",
            status
        };
    }
}

export type InitOrderError =
    | { tag: 'action-not-allowed'; error: ActionNotAllowedError };

export namespace InitOrderError {
    export function actionNotAllowed(error: ActionNotAllowedError): InitOrderError {
        return {tag: 'action-not-allowed', error};
    }
}

export type CancelOrderError =
    | { tag: 'action-not-allowed'; error: ActionNotAllowedError };

export namespace CancelOrderError {
    export function actionNotAllowed(error: ActionNotAllowedError): CancelOrderError {
        return {tag: 'action-not-allowed', error};
    }
}

export type ShipOrderError =
    | { tag: 'action-not-allowed'; error: ActionNotAllowedError };

export namespace ShipOrderError {
    export function actionNotAllowed(error: ActionNotAllowedError): ShipOrderError {
        return {tag: 'action-not-allowed', error};
    }
}

export type AddItemError =
    | { tag: 'product-not-found'; error: ProductNotFoundError }
    | { tag: 'pricing-not-found'; error: PricingNotFoundError }
    | { tag: 'action-not-allowed'; error: ActionNotAllowedError };

export namespace AddItemError {
    export function productNotFound(error: ProductNotFoundError): AddItemError {
        return {tag: 'product-not-found', error};
    }

    export function pricingNotFound(error: PricingNotFoundError): AddItemError {
        return {tag: 'pricing-not-found', error};
    }

    export function actionNotAllowed(error: ActionNotAllowedError): AddItemError {
        return {tag: 'action-not-allowed', error};
    }
}

export type RemoveItemError =
    | { tag: 'item-not-found'; error: ItemNotFoundError }
    | { tag: 'action-not-allowed'; error: ActionNotAllowedError };

export namespace RemoveItemError {
    export function itemNotFound(error: ItemNotFoundError): RemoveItemError {
        return {tag: 'item-not-found', error};
    }

    export function actionNotAllowed(error: ActionNotAllowedError): RemoveItemError {
        return {tag: 'action-not-allowed', error};
    }
}

export type UpdateItemQuantityError =
    | { tag: 'item-not-found'; error: ItemNotFoundError }
    | { tag: 'action-not-allowed'; error: ActionNotAllowedError };

export namespace UpdateItemQuantityError {
    export function itemNotFound(error: ItemNotFoundError): UpdateItemQuantityError {
        return {tag: 'item-not-found', error};
    }

    export function actionNotAllowed(error: ActionNotAllowedError): UpdateItemQuantityError {
        return {tag: 'action-not-allowed', error};
    }
}

export type UpdateAddressError =
    | { tag: 'address-not-valid'; error: AddressNotValidError }
    | { tag: 'action-not-allowed'; error: ActionNotAllowedError };

export namespace UpdateAddressError {
    export function addressNotValid(error: AddressNotValidError): UpdateAddressError {
        return {tag: 'address-not-valid', error};
    }

    export function actionNotAllowed(error: ActionNotAllowedError): UpdateAddressError {
        return {tag: 'action-not-allowed', error};
    }
}

export type UpdateEmailError =
    | { tag: 'email-not-valid'; error: EmailNotValidError }
    | { tag: 'action-not-allowed'; error: ActionNotAllowedError };

export namespace UpdateEmailError {
    export function emailNotValid(error: EmailNotValidError): UpdateEmailError {
        return {tag: 'email-not-valid', error};
    }

    export function actionNotAllowed(error: ActionNotAllowedError): UpdateEmailError {
        return {tag: 'action-not-allowed', error};
    }
}

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
    orderStatus: OrderStatus;
    items: OrderItem[];
    email?: string;
    billingAddress?: Address;
    shippingAddress?: Address;
    total: number;
    currency: string;
    createdAt: Datetime;
    updatedAt: Datetime;
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
    updatedAt: Datetime;
}

export interface OrderUpdated {
    userId: string;
    orderId: string;
}

export const getItemsTotalPrice = (items: OrderItem[]): number => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

export type InitOrderResult = Result<OrderUpdated, InitOrderError>
export type CancelOrderResult = Result<OrderUpdated, CancelOrderError>
export type ShipOrderResult = Result<OrderUpdated, ShipOrderError>
export type AddItemResult = Result<OrderUpdated, AddItemError>
export type UpdateItemQuantityResult = Result<OrderUpdated, UpdateItemQuantityError>
export type RemoveItemResult = Result<OrderUpdated, RemoveItemError>
export type UpdateAddressResult = Result<OrderUpdated, UpdateAddressError>
export type UpdateEmailResult = Result<OrderUpdated, UpdateEmailError>

@agent({
    mount: '/v1/order/{id}'
})
export class OrderAgent extends BaseAgent {
    private readonly orderId: string;
    private value: Order | undefined = undefined;

    constructor(id: string) {
        super()
        this.orderId = id;
    }

    private updateValue<T>(fn: (value: Order) => T): T {
        if (!this.value) {
            let date = now();
            this.value = {
                orderId: this.orderId,
                userId: "",
                items: [],
                total: 0,
                currency: CURRENCY,
                orderStatus: OrderStatus.new,
                email: undefined,
                billingAddress: undefined,
                shippingAddress: undefined,
                createdAt: date,
                updatedAt: date,
            }
        }
        return fn(this.value)
    }

    @prompt("Create order")
    async create(order: CreateOrder): Promise<InitOrderResult> {
        return this.updateValue(async (value) => {
            if (value.orderStatus == OrderStatus.new) {
                value.userId = order.userId;
                value.items = order.items;
                value.email = order.email;
                value.billingAddress = order.billingAddress;
                value.shippingAddress = order.shippingAddress;
                value.total = order.total;
                value.currency = order.currency;
                value.orderStatus = OrderStatus.new;
                value.updatedAt = now();
                return Result.ok({userId: value.userId, orderId: value.orderId});
            } else {
                return Result.err(InitOrderError.actionNotAllowed(ActionNotAllowedError.create(value.orderStatus)));
            }
        })
    }

    @endpoint({ put: '/items/{productId}' })
    @prompt("Add item to order")
    async addItem(productId: string, quantity: number): Promise<AddItemResult> {
        return this.updateValue(async (value) => {
            if (value.orderStatus == OrderStatus.new) {
                let item = value.items.find(item => item.productId === productId);
                if (item) {
                    item.quantity += quantity;
                    value.total = getItemsTotalPrice(value.items);
                    value.updatedAt = now();
                    return Result.ok({userId: value.userId, orderId: value.orderId});
                } else {
                    let product = await ProductAgent.get(productId).get();
                    let pricing = await PricingAgent.get(productId).getPrice(value.currency, PRICING_REGION_DEFAULT);

                    if (!product) {
                        return Result.err(AddItemError.productNotFound({
                            message: `Product with productId ${productId} not found`,
                            productId
                        }));
                    } else if (!pricing) {
                        return Result.err(AddItemError.pricingNotFound({
                            message: `Pricing for product with productId ${productId} not found`,
                            productId
                        }))
                    } else {
                        value.items.push({
                            productId,
                            productName: product.name,
                            productBrand: product.brand,
                            price: pricing.price,
                            quantity: quantity
                        });
                        value.total = getItemsTotalPrice(value.items);
                        value.updatedAt = now();
                        return Result.ok({userId: value.userId, orderId: value.orderId});
                    }
                }
            } else {
                return Result.err(AddItemError.actionNotAllowed(ActionNotAllowedError.create(value.orderStatus)));
            }
        });
    }

    @prompt("Update item quantity in order")
    async updateItemQuantity(productId: string, quantity: number): Promise<UpdateItemQuantityResult> {
        return this.updateValue(async (value) => {
            if (value.orderStatus == OrderStatus.new) {
                let item = value.items.find(item => item.productId === productId);
                if (item) {
                    item.quantity = quantity;
                    value.total = getItemsTotalPrice(value.items);
                    value.updatedAt = now();
                    return Result.ok({userId: value.userId, orderId: value.orderId});
                } else {
                    return Result.err(UpdateItemQuantityError.itemNotFound({
                        message: `Item with productId ${productId} not found in order`,
                        productId
                    }));
                }
            } else {
                return Result.err(UpdateItemQuantityError.actionNotAllowed(ActionNotAllowedError.create(value.orderStatus)));
            }
        });
    }

    @endpoint({ delete: '/items/{productId}' })
    @prompt("Remove item from order")
    async removeItem(productId: string): Promise<RemoveItemResult> {
        return this.updateValue(async (value) => {
            if (value.orderStatus == OrderStatus.new) {
                let newItems = value.items.filter(item => item.productId !== productId)
                if (value.items.length !== newItems.length) {
                    value.items = newItems
                    value.total = getItemsTotalPrice(newItems);
                    value.updatedAt = now();
                    return Result.ok({userId: value.userId, orderId: value.orderId});
                } else {
                    return Result.err(RemoveItemError.itemNotFound({
                        message: `Item with productId ${productId} not found in order`,
                        productId
                    }));
                }
            } else {
                return Result.err(RemoveItemError.actionNotAllowed(ActionNotAllowedError.create(value.orderStatus)));
            }
        })
    }

    @endpoint({ put: '/billing-address' })
    @prompt("Update billing address in order")
    async updateBillingAddress(
        street: string,
        city: string,
        stateOrRegion: string,
        country: string,
        postalCode: string,
        name?: string,
        phoneNumber?: string
    ): Promise<UpdateAddressResult> {
        return this.updateValue(async (value) => {
            if (value.orderStatus == OrderStatus.new) {
                value.billingAddress = {
                    street,
                    city,
                    stateOrRegion,
                    country,
                    postalCode,
                    name,
                    phoneNumber
                };
                value.updatedAt = now();
                return Result.ok({userId: value.userId, orderId: value.orderId});
            } else {
                return Result.err(UpdateAddressError.actionNotAllowed(ActionNotAllowedError.create(value.orderStatus)));
            }
        })
    }

    @endpoint({ put: '/shipping-address' })
    @prompt("Update shipping address in order")
    async updateShippingAddress(
        street: string,
        city: string,
        stateOrRegion: string,
        country: string,
        postalCode: string,
        name?: string,
        phoneNumber?: string
    ): Promise<UpdateAddressResult> {
        return this.updateValue(async (value) => {
            if (value.orderStatus == OrderStatus.new) {
                value.shippingAddress = {
                    street,
                    city,
                    stateOrRegion,
                    country,
                    postalCode,
                    name,
                    phoneNumber
                };
                value.updatedAt = now();
                return Result.ok({userId: value.userId, orderId: value.orderId});
            } else {
                return Result.err(UpdateAddressError.actionNotAllowed(ActionNotAllowedError.create(value.orderStatus)));
            }
        })
    }

    @endpoint({ put: '/email' })
    @prompt("Update email in order")
    async updateEmail(email: string): Promise<UpdateEmailResult> {
        return this.updateValue(async (value) => {
            if (value.orderStatus == OrderStatus.new) {
                value.email = email;
                value.updatedAt = now();
                return Result.ok({userId: value.userId, orderId: value.orderId});
            } else {
                return Result.err(UpdateEmailError.actionNotAllowed(ActionNotAllowedError.create(value.orderStatus)));
            }
        })
    }

    @endpoint({ post: '/cancel-order' })
    @prompt("Cancel order")
    async cancelOrder(): Promise<CancelOrderResult> {
        return this.updateValue(async (value) => {
            if (value.orderStatus == OrderStatus.new) {
                value.orderStatus = OrderStatus.cancelled;
                value.updatedAt = now();
                return Result.ok({userId: value.userId, orderId: value.orderId});
            } else {
                return Result.err(CancelOrderError.actionNotAllowed(ActionNotAllowedError.create(value.orderStatus)));
            }
        })
    }

    @endpoint({ post: '/ship-order' })
    @prompt("Ship order")
    async shipOrder(): Promise<ShipOrderResult> {
        return this.updateValue(async (value) => {
            if (value.orderStatus == OrderStatus.new) {
                value.orderStatus = OrderStatus.shipped;
                value.updatedAt = now();
                return Result.ok({userId: value.userId, orderId: value.orderId});
            } else {
                return Result.err(ShipOrderError.actionNotAllowed(ActionNotAllowedError.create(value.orderStatus)));
            }
        })
    }

    @endpoint({ get: '/' })
    @prompt("Get order")
    async get(): Promise<Order | undefined> {
        return this.value;
    }
}
