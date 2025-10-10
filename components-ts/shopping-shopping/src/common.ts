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

export type Result<T, E> = { tag: "ok", val: T } | { tag: "err", val: E }

export namespace Result {
    export function ok<T, E>(val: T): Result<T, E> {
        return {tag: "ok", val};
    }

    export function err<T, E>(val: E): Result<T, E> {
        return {tag: "err", val};
    }

    export function isErr<T, E>(this: Result<T, E>) {
        return this.tag === "err";
    }

    export function isOk<T, E>(this: Result<T, E>) {
        return this.tag === "ok";
    }
}
