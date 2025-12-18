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
import {ComponentId, parseAgentId} from "golem:agent/host";
import {arrayChunks} from "./common";

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

class ProductQueryMatcher {
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

    private valueMatches(text: string, query: string): boolean {
        if (query === '*') return true;
        return text === query;
    }

    public matches(product: Product): boolean {
        // Check field filters first
        for (const [field, value] of this.fieldFilters.entries()) {
            let matches = false;

            switch (field) {
                case 'productid':
                    matches = this.valueMatches(product.productId, value);
                    break;
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

@agent({ mode: "ephemeral" })
export class ProductSearchAgent extends BaseAgent {
    private readonly componentId: ComponentId | undefined;

    constructor() {
        super()
        this.componentId = resolveComponentId("shopping:shopping");
    }

    @prompt("Get products by ids")
    async getByIds(ids: string): Promise<Result<Product[], string>> {
        if (this.componentId) {
            const productIds = ids.split(",").map((id) => id.trim());
            console.log("Get products - ids: (" + productIds + ")");
            const result: Product[] = [];

            if (productIds.length > 0) {
                const idsChunks = arrayChunks(productIds, 5);

                for (const ids of idsChunks) {
                    console.log("Get products - ids: (" + ids + ")");
                    const promises = ids.map(async (id) => await ProductAgent.get(id).get());
                    const promisesResult = await Promise.all(promises);
                    console.log("Get products - ids: (" + ids + ") fetched: " + promisesResult.length);

                    for (const value of promisesResult) {
                        if (value) {
                            result.push(value);
                        }
                    }
                }
            }

            return Result.ok(result);
        } else {
            return Result.err("Component not found");
        }
    }

    @prompt("Search products")
    async search(query: string): Promise<Result<Product[], string>> {
        if (this.componentId) {
            console.log("Search products - query: " + query);
            const matcher = new ProductQueryMatcher(query);

            const result: Product[] = [];
            const processedIds = new Set<string>();

            const getter = new GetAgents(this.componentId, AGENT_FILTER, true);
            let agents = await getter.getNext();

            while (agents && agents.length > 0) {

                const ids = agents.map((value) => getProductAgentId(value.agentId.agentId))
                    .filter((id) => id !== undefined)
                    .filter((id) => !processedIds.has(id));

                if (ids.length > 0) {
                    const idsChunks = arrayChunks(ids, 5);

                    for (const ids of idsChunks) {
                        console.log("Search products - ids: (" + ids + ")");
                        const promises = ids.map(async (id) => await ProductAgent.get(id).get());

                        const promisesResult = await Promise.all(promises);

                        console.log("Search products - ids: (" + ids + ") fetched: " + promisesResult.length);

                        for (const value of promisesResult) {
                            if (value) {
                                processedIds.add(value.productId);
                                if (matcher.matches(value)) {
                                    result.push(value);
                                }
                            }
                        }
                    }
                }

                agents = await getter.getNext();
            }

            return Result.ok(result);
        } else {
            return Result.err("Component not found");
        }
    }
}
