import {describe, it, expect} from 'vitest';
import {getProductAgentId} from '../src/productSearch';

describe('getProductAgentId', () => {
    it('should extract ID from valid agent ID string', () => {
        const agentId = 'product-agent("p039")';
        expect(getProductAgentId(agentId)).toBe('p039');
    });

    it('should handle different IDs', () => {
        const agentId1 = 'product-agent("abc123")';
        const agentId2 = 'product-agent("xyz-789")';
        expect(getProductAgentId(agentId1)).toBe('abc123');
        expect(getProductAgentId(agentId2)).toBe('xyz-789');
    });

    it('should return undefined for malformed agent ID', () => {
        const malformed1 = 'product-agent("unclosed';
        const malformed2 = 'wrong-prefix("p039")';
        const malformed3 = 'product-agent()';
        const malformed4 = 'product-agent("")';

        expect(getProductAgentId(malformed1)).toBeUndefined();
        expect(getProductAgentId(malformed2)).toBeUndefined();
        expect(getProductAgentId(malformed3)).toBeUndefined();
        expect(getProductAgentId(malformed4)).toBeUndefined();
    });

    it('should handle empty or invalid input', () => {
        expect(getProductAgentId('')).toBeUndefined();
        expect(getProductAgentId('just some text')).toBeUndefined();
        // @ts-ignore - testing invalid input
        expect(getProductAgentId({})).toBeUndefined();
        // @ts-ignore - testing invalid input
        expect(getProductAgentId(null)).toBeUndefined();
        // @ts-ignore - testing invalid input
        expect(getProductAgentId(undefined)).toBeUndefined();
    });
});