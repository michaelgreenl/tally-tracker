import { describe, expect, it } from 'vitest';
import { addCounterAmount, COUNTER_MAX, counterIncrementSchema, counterValueSchema } from '@tally/core/client';

describe('decimal counter values', () => {
    it('keeps repeated taps exact and reversible at both ends of the supported range', () => {
        let count = 0;
        for (let tap = 0; tap < 10; tap += 1) count = addCounterAmount(count, 0.1);
        expect(count).toBe(1);
        for (let tap = 0; tap < 10; tap += 1) count = addCounterAmount(count, -0.1);
        expect(count).toBe(0);
        expect(addCounterAmount(999_999_999.999998, 0.000001)).toBe(COUNTER_MAX);
        expect(addCounterAmount(-999_999_999.999998, -0.000001)).toBe(-COUNTER_MAX);
    });

    it('accepts decimal steps but rejects zero, negative, nonfinite, excess precision, and out-of-range steps', () => {
        for (const value of [0.000001, 0.1, 1.25, 16, COUNTER_MAX]) {
            expect(counterIncrementSchema.safeParse(value).success, String(value)).toBe(true);
        }
        for (const value of [0, -0.5, NaN, Infinity, 0.0000001, 1_000_000_000]) {
            expect(counterIncrementSchema.safeParse(value).success, String(value)).toBe(false);
        }
        expect(counterValueSchema.safeParse(addCounterAmount(COUNTER_MAX, 0.000001)).success).toBe(false);
    });
});
