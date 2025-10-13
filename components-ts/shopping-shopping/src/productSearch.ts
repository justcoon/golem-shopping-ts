import {
    BaseAgent,
    agent,
    prompt,
    GetAgents,
    resolveComponentId,
    AgentAnyFilter,
    Result
} from '@golemcloud/golem-ts-sdk';
import {Product, ProductAgent} from "./product";
import {parseAgentId} from "golem:agent/host";

const AGENT_FILTER: AgentAnyFilter = {
    filters: [{
        filters: [
            {
                tag: "name",
                val: {
                    comparator: "starts-with",
                    value: "product-agent("
                }
            }
        ]
    }]
}

function getProductAgentId(agentName: string): string | undefined {
    // parseAgentId(agentName)
    const match = agentName.match(/^product-agent\("([^"]+)"\)$/);
    return match ? match[1] : undefined;
}

function arrayChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }

    return chunks;
}

export class ProductQueryMatcher {
    private terms: string[];
    private fieldFilters: Map<string, string>;

    constructor(query: string) {
        const {terms, fieldFilters} = this.parseQuery(query);
        this.terms = terms;
        this.fieldFilters = fieldFilters;
    }

    private parseQuery(query: string): { terms: string[], fieldFilters: Map<string, string> } {
        const terms: string[] = [];
        const fieldFilters = new Map<string, string>();
        const tokens = this.tokenize(query);

        for (const part of tokens) {
            const fieldMatch = part.match(/^([a-zA-Z]+):(.*)$/);
            if (fieldMatch) {
                const [_, field, value] = fieldMatch;
                if (field && value) {
                    fieldFilters.set(field.toLowerCase(), value);
                }
            } else {
                terms.push(part);
            }
        }

        return {terms, fieldFilters};
    }

    private tokenize(query: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of query) {
            if (char === ' ' && !inQuotes) {
                if (current.trim()) {
                    tokens.push(current.trim());
                    current = '';
                }
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            tokens.push(current.trim());
        }

        return tokens;
    }

    private textMatches(text: string, query: string): boolean {
        if (query === '*') return true;
        return text.toLowerCase().includes(query.toLowerCase());
    }

    public matches(product: Product): boolean {
        // Check field filters first
        for (const [field, value] of this.fieldFilters.entries()) {
            let matches = false;

            switch (field) {
                case 'name':
                    matches = this.textMatches(product.name, value);
                    break;
                case 'brand':
                    matches = this.textMatches(product.brand, value);
                    break;
                case 'description':
                    matches = this.textMatches(product.description, value);
                    break;
                case 'tag':
                case 'tags':
                    matches = product.tags?.some(tag => this.textMatches(tag, value)) ?? false;
                    break;
                default:
                    // Unknown field
                    return false;
            }

            if (!matches) {
                return false;
            }
        }

        // If no terms to match, just check if field filters passed
        if (this.terms.length === 0) {
            return true;
        }

        // Check search terms against all searchable fields
        return this.terms.every(term => {
            const searchText = [
                product.name,
                product.brand,
                product.description,
                ...(product.tags || [])
            ].join(' ').toLowerCase();

            return searchText.includes(term.toLowerCase());
        });
    }
}

@agent()
export class ProductSearchAgent extends BaseAgent {
    constructor() {
        super()
    }

    @prompt("Search products")
    async search(query: string): Promise<Result<Product[], string>> {
        const componentId = resolveComponentId("shopping:shopping");
        if (componentId) {
            console.log("Search products - query:  "+ query);
            const matcher = new ProductQueryMatcher(query);

            const products: Product[] = [];

            const getter = new GetAgents(componentId, AGENT_FILTER, true);
            let values = await getter.getNext();

            const processedIds = new Set<string>();
            // while (values && values.length > 0) {
            //
            //     const ids = values.map((value) => getProductAgentId(value.agentId.agentId))
            //         .filter((id) => id !== undefined)
            //         .filter((id) =>  !processedIds.has(id));
            //
            //
            //     if (ids.length > 0) {
            //         const idsChunks = arrayChunks(ids, 5);
            //
            //         for (const ids of idsChunks) {
            //             console.log("Search products - ids:  "+ ids);
            //             const promises = ids.map(async (id) => await ProductAgent.get(id).get());
            //
            //             const products = await Promise.all(promises);
            //
            //             for (const product of products) {
            //                 if (product) {
            //                     processedIds.add(product.productId);
            //                     if (matcher.matches(product)) {
            //                         products.push(product);
            //                     }
            //                 }
            //             }
            //         }
            //     }
            //
            //     // for (const id of ids) {
            //     //     let product = await ProductAgent.get(id).get();
            //     //     processedIds.add(id);
            //     //     if (product && matcher.matches(product)) {
            //     //         products.push(product);
            //     //     }
            //     // }
            //     values = await getter.getNext();
            // }

            while (values && values.length > 0) {
                values.map((value) => getProductAgentId(value.agentId.agentId))
                    .filter((id) => id !== undefined)
                    .forEach((id) => processedIds.add(id));
                values = await getter.getNext();
            }


            if (processedIds.size > 0) {
                const idsChunks = arrayChunks(Array.from(processedIds), 5);

                for (const ids of idsChunks) {
                    console.log("Search products - ids: "+ ids);
                    const promises = ids.map(async (id) => await ProductAgent.get(id).get());

                    const products = await Promise.all(promises);

                    for (const product of products) {
                        if (product) {
                            processedIds.add(product.productId);
                            if (matcher.matches(product)) {
                                products.push(product);
                            }
                        }
                    }
                }
            }

            return Result.ok(products);
        } else {
            return Result.err("Component not found");
        }
    }

    @prompt("test")
    async test(): Promise<number> {
        const p1 = test(1);
        const p2 = test(2);
        const p3 = test(3);

        const vs = await Promise.all([p1, p2, p3]);
        return vs.reduce((a, b) => a + b);
    }

    @prompt("test2")
    async test2(): Promise<Product[]> {

        const products: Product[] = [];
        const p1 = ProductAgent.get("p001").get();
        const p2 =  ProductAgent.get("p003").get();
        const p3 =  ProductAgent.get("p004").get();

        const values = await Promise.all([p1, p2, p3]);
        for(const value of values) {
            if(value) {
                products.push(value);
            }
        }
        return products;
    }

    @prompt("test3")
    async test3(): Promise<Product[]> {

        const ids = ["p001", "p002", "p003", "p004", "p005"];

        console.log("Get products - ids:  "+ ids);
        const promises = ids.map(async (id) => await ProductAgent.get(id).get());

        const values = await Promise.all(promises);

        const products: Product[] = [];
        for(const value of values) {
            if(value) {
                products.push(value);
            }
        }
        return products;
    }
}


async function test(v: number): Promise<number> {
    return v;
}
