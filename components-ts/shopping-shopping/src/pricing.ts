import {
    BaseAgent,
    agent,
    prompt,
} from '@golemcloud/golem-ts-sdk';
import {Datetime, now} from "wasi:clocks/wall-clock@0.2.3";

export interface PricingItem {
    price: number;
    currency: string;
    zone: string;
}

export interface SalePricingItem extends PricingItem {
    start?: Datetime;
    end?: Datetime;
}

export interface Pricing {
    productId: string;
    msrpPrices: PricingItem[];
    listPrices: PricingItem[];
    salePrices: SalePricingItem[];
    createdAt: Datetime;
    updatedAt: Datetime;
}

export const mergePricingItems = (first: PricingItem[], second: PricingItem[]): PricingItem[] => {
    const map = new Map<string, PricingItem>();
    for (const item of first) {
        map.set(`${item.currency}-${item.zone}`, item);
    }
    for (const item of second) {
        map.set(`${item.currency}-${item.zone}`, item);
    }
    return Array.from(map.values());
}

export const mergeSalePricingItems = (first: SalePricingItem[], second: SalePricingItem[]): SalePricingItem[] => {
    const map = new Map<string, SalePricingItem>();
    
    // Add items from first array
    for (const item of first) {
        map.set(`${item.currency}-${item.zone}-${item.start?.toString()}-${item.end?.toString()}`, item);
    }
    
    // Add or update items from second array
    for (const item of second) {
        map.set(`${item.currency}-${item.zone}-${item.start?.toString()}-${item.end?.toString()}`, item);
    }

    return Array.from(map.values())
}

@agent()
export class PricingAgent extends BaseAgent {
    private readonly productId: string;
    private value: Pricing | undefined = undefined;

    constructor(id: string) {
        super()
        this.productId = id;
    }

    @prompt("Initialize pricing")
    async initializePricing(msrpPrices: PricingItem[], listPrices: PricingItem[], salePrices: SalePricingItem[]) {
        let date = now();
        this.value = {
            productId: this.productId,
            msrpPrices: msrpPrices,
            listPrices: listPrices,
            salePrices: salePrices,
            createdAt: date,
            updatedAt: date
        }
    }

    @prompt("Update pricing")
    async updatePricing(msrpPrices: PricingItem[], listPrices: PricingItem[], salePrices: SalePricingItem[]) {
        if (this.value) {
            this.value.msrpPrices = mergePricingItems(this.value.msrpPrices, msrpPrices);
            this.value.listPrices = mergePricingItems(this.value.listPrices, listPrices);
            this.value.salePrices = mergeSalePricingItems(this.value.salePrices, salePrices);
            this.value.updatedAt = now();
        }
    }

    @prompt("Get price by currency and zone")
    async getPrice(currency: string, zone: string): Promise<PricingItem | undefined> {
        if (this.value) {
            let maybePrice = this.value.listPrices.find((p) => p.currency === currency && p.zone === zone);

            if (maybePrice) {
                return maybePrice;
            } else {
                return this.value.msrpPrices.find((p) => p.currency === currency && p.zone === zone);
            }
        } else {
            return undefined;
        }
    }

    @prompt("Get pricing")
    async get(): Promise<Pricing | undefined> {
        return this.value;
    }
}
