import {
    BaseAgent,
    agent,
    prompt,
} from '@golemcloud/golem-ts-sdk';


export interface PricingItem {
    price: number;
    currency: string;
    zone: string;
}

// export interface SalePricingItem extends PricingItem {
//     start?: DateTime;
//     end?: DateTime;
// }

export interface Pricing {
    productId: string;
    msrpPrices: PricingItem[];
    listPrices: PricingItem[];
    // "salePrices": SalePricingItem[];
    // "updated-at": DateTime;
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

@agent()
export class PricingAgent extends BaseAgent {
    private readonly productId: string;
    private value: Pricing | undefined = undefined;

    constructor(id: string) {
        super()
        this.productId = id;
    }

    @prompt("Initialize pricing")
    async initializePricing(msrpPrices: PricingItem[], listPrices: PricingItem[]) {
        this.value = {
            productId: this.productId,
            msrpPrices: msrpPrices,
            listPrices: listPrices
        }
    }

    @prompt("Update pricing")
    async updatePricing(msrpPrices: PricingItem[], listPrices: PricingItem[]) {
        if (this.value) {
            this.value.msrpPrices = mergePricingItems(this.value.msrpPrices, msrpPrices);
            this.value.listPrices = mergePricingItems(this.value.listPrices, listPrices);
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
