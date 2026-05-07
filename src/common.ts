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
export const PRICING_REGION_DEFAULT = "global";

export function arrayChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }

    return chunks;
}
