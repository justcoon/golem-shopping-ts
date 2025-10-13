export interface Address {
    street: string;
    city: string;
    stateOrRegion: string;
    country: string;
    postalCode: string;
    name?: string;
    phoneNumber?: string;
}

export const CURRENCY = "USD";
export const PRICING_ZONE_DEFAULT = "global";