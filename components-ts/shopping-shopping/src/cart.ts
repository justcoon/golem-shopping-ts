import {
    BaseAgent,
    agent,
    prompt
} from '@golemcloud/golem-ts-sdk';
import {v4 as uuidv4} from 'uuid';
import {Address, CURRENCY, PRICING_ZONE_DEFAULT, Result} from "./common";
import {ProductAgent} from "./product";
import {PricingAgent} from "./pricing";
import {OrderAgent} from "./order";

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

export interface EmptyItemsError {
    message: string;
}

export interface BillingAddressNotSetError {
    message: string;
}

export interface EmptyEmailError {
    message: string;
}

export interface OrderCreateError {
    message: string;
}

export type AddItemError =
    | { tag: 'product-not-found'; error: ProductNotFoundError }
    | { tag: 'pricing-not-found'; error: PricingNotFoundError };

export namespace AddItemError {
    export function productNotFound(error: ProductNotFoundError): AddItemError {
        return {tag: 'product-not-found', error};
    }

    export function pricingNotFound(error: PricingNotFoundError): AddItemError {
        return {tag: 'pricing-not-found', error};
    }
}

export type RemoveItemError =
    | { tag: 'item-not-found'; error: ItemNotFoundError };

export namespace RemoveItemError {
    export function itemNotFound(error: ItemNotFoundError): RemoveItemError {
        return {tag: 'item-not-found', error};
    }
}

export type UpdateItemQuantityError =
    | { tag: 'item-not-found'; error: ItemNotFoundError };

export namespace UpdateItemQuantityError {
    export function itemNotFound(error: ItemNotFoundError): UpdateItemQuantityError {
        return {tag: 'item-not-found', error};
    }
}

export type UpdateAddressError =
    | { tag: 'address-not-valid'; error: AddressNotValidError };

export namespace UpdateAddressError {
    export function addressNotValid(error: AddressNotValidError): UpdateAddressError {
        return {tag: 'address-not-valid', error};
    }
}

export type UpdateEmailError =
    | { tag: 'email-not-valid'; error: EmailNotValidError };

export namespace UpdateEmailError {
    export function emailNotValid(error: EmailNotValidError): UpdateEmailError {
        return {tag: 'email-not-valid', error};
    }
}

export type CheckoutError =
    | { tag: 'product-not-found'; error: ProductNotFoundError }
    | { tag: 'pricing-not-found'; error: PricingNotFoundError }
    | { tag: 'empty-items'; error: EmptyItemsError }
    | { tag: 'empty-email'; error: EmptyEmailError }
    | { tag: 'billing-address-not-set'; error: BillingAddressNotSetError }
    | { tag: 'order-create'; error: OrderCreateError };

export namespace CheckoutError {
    export function productNotFound(error: ProductNotFoundError): CheckoutError {
        return {tag: 'product-not-found', error};
    }

    export function pricingNotFound(error: PricingNotFoundError): CheckoutError {
        return {tag: 'pricing-not-found', error};
    }

    export function emptyItems(error: EmptyItemsError): CheckoutError {
        return {tag: 'empty-items', error};
    }

    export function emptyEmail(error: EmptyEmailError): CheckoutError {
        return {tag: 'empty-email', error};
    }

    export function billingAddressNotSet(error: BillingAddressNotSetError): CheckoutError {
        return {tag: 'billing-address-not-set', error};
    }

    export function orderCreate(error: OrderCreateError): CheckoutError {
        return {tag: 'order-create', error};
    }
}


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
}

export interface OrderConfirmation {
    orderId: string;
}

export const getItemsTotalPrice = (items: CartItem[]): number => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

function generateOrderId(): string {
    return uuidv4()
}

export type AddItemResult = Result<boolean, AddItemError>
export type UpdateItemQuantityResult = Result<boolean, UpdateItemQuantityError>
export type RemoveItemResult = Result<boolean, RemoveItemError>
export type UpdateAddressResult = Result<boolean, UpdateAddressError>
export type UpdateEmailResult = Result<boolean, UpdateEmailError>
export type CheckoutResult = Result<OrderConfirmation, CheckoutError>


@agent()
export class CartAgent extends BaseAgent {
    private readonly userId: string;
    private value: Cart | undefined = undefined;

    constructor(id: string) {
        super()
        this.userId = id;
    }

    private updateValue<T>(fn: (value: Cart) => T): T {
        if (!this.value) {
            this.value = {
                userId: this.userId,
                items: [],
                total: 0,
                currency: CURRENCY,
                previousOrderIds: [],
            }
        }
        return fn(this.value)
    }

    @prompt("Add item to cart")
    async addItem(productId: string, quantity: number): Promise<AddItemResult> {
        return this.updateValue(async (value) => {
            let item = value.items.find(item => item.productId === productId);
            if (item) {
                item.quantity = quantity;
                return Result.ok(true);
            } else {
                let product = await ProductAgent.get(productId).get();
                let pricing = await PricingAgent.get(productId).getPrice(value.currency, PRICING_ZONE_DEFAULT);

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
                        quantity
                    });
                    value.total = getItemsTotalPrice(value.items)
                    return Result.ok(true);
                }
            }
        });
    }

    @prompt("Update item quantity in cart")
    async updateItemQuantity(productId: string, quantity: number): Promise<UpdateItemQuantityResult> {
        return this.updateValue(async (value) => {
            let item = value.items.find(item => item.productId === productId);
            if (item) {
                item.quantity = quantity;
                value.total = getItemsTotalPrice(value.items)
                return Result.ok(true);
            } else {
                return Result.err(UpdateItemQuantityError.itemNotFound({
                    message: `Item with productId ${productId} not found in cart`,
                    productId
                }));
            }
        });
    }

    @prompt("Remove item from cart")
    async removeItem(productId: string): Promise<RemoveItemResult> {
        return this.updateValue(async (value) => {
            let newItems = value.items.filter(item => item.productId !== productId)
            if (value.items.length !== newItems.length) {
                value.items = newItems
                value.total = getItemsTotalPrice(newItems)
                return Result.ok(true);
            } else {
                return Result.err(RemoveItemError.itemNotFound({
                    message: `Item with productId ${productId} not found in cart`,
                    productId
                }));
            }
        })
    }

    @prompt("Update billing address in cart")
    async updateBillingAddress(address: Address): Promise<UpdateAddressResult> {
        return this.updateValue(async (value) => {
            value.billingAddress = address;
            return Result.ok(true);
        })
    }

    @prompt("Update shipping address in cart")
    async updateShippingAddress(address: Address): Promise<UpdateAddressResult> {
        return this.updateValue(async (value) => {
            value.shippingAddress = address;
            return Result.ok(true);
        })
    }

    @prompt("Update email in cart")
    async updateEmail(email: string): Promise<UpdateEmailResult> {
        return this.updateValue(async (value) => {
            value.email = email;
            return Result.ok(true);
        })
    }

    @prompt("Checkout cart")
    async checkout(): Promise<CheckoutResult> {
        return this.updateValue(async (value) => {
            if (value.items.length === 0) {
                return Result.err(CheckoutError.emptyItems({
                    message: `Cart is empty`
                }));
            }
            if (!value.email) {
                return Result.err(CheckoutError.emptyEmail({
                    message: `Email is empty`
                }));
            }
            if (!value.billingAddress) {
                return Result.err(CheckoutError.billingAddressNotSet({
                    message: `Billing address is not set`
                }));
            }

            let orderId = generateOrderId()

            let order = {
                userId: value.userId,
                items: value.items,
                email: value.email,
                billingAddress: value.billingAddress,
                shippingAddress: value.shippingAddress,
                total: value.total,
                currency: value.currency
            }

            let result = await OrderAgent.get(orderId).create(order);

            if (result.tag === 'err') {
                return Result.err(CheckoutError.orderCreate({
                    message: `Order creation failed`
                }));
            } else {
                value.items = [];
                value.total = 0;
                value.billingAddress = undefined;
                value.shippingAddress = undefined;
                value.previousOrderIds.push(orderId);

                return Result.ok({orderId});
            }
        })
    }

    @prompt("Clear cart content")
    async clear() {
        this.updateValue(async (value) => {
            value.items = [];
            value.total = 0;
            value.billingAddress = undefined;
            value.shippingAddress = undefined;
        })
    }

    @prompt("Get cart")
    async get(): Promise<Cart | undefined> {
        return this.value;
    }
}
