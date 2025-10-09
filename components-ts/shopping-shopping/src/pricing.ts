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
    private value: Pricing = {
        productId: "",
        msrpPrices: [],
        listPrices: []
    };

    constructor(id: string) {
        super()
        this.value.productId = id;
    }

    @prompt("Initialize pricing")
    async initialize(msrpPrices: PricingItem[], listPrices: PricingItem[]) {
        this.value.msrpPrices = msrpPrices;
        this.value.listPrices = listPrices;
    }

    @prompt("Update pricing")
    async update(msrpPrices: PricingItem[], listPrices: PricingItem[]) {
        this.value.msrpPrices = mergePricingItems(this.value.msrpPrices, msrpPrices);
        this.value.listPrices = mergePricingItems(this.value.listPrices, listPrices);
    }

    @prompt("Get price by currency and zone")
    async getPrice(currency: string, zone: string): Promise<PricingItem | undefined> {
        let maybePrice = this.value.listPrices.find((p) => p.currency === currency && p.zone === zone);

        if (maybePrice) {
            return maybePrice;
        } else {
            return this.value.msrpPrices.find((p) => p.currency === currency && p.zone === zone);
        }
    }

    @prompt("Get pricing")
    async get(): Promise<Pricing> {
        return this.value;
    }
}
