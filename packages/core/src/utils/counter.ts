import { z } from 'zod';

const COUNTER_SCALE = 1_000_000;
export const COUNTER_MAX = 999_999_999.999999;

export const counterValueSchema = z
    .number()
    .min(-COUNTER_MAX)
    .max(COUNTER_MAX)
    .refine((value) => value === Math.round(value * COUNTER_SCALE) / COUNTER_SCALE, 'Use at most 6 decimal places.');
export const counterIncrementSchema = counterValueSchema.positive('Enter an increment greater than 0.');
export const counterMetricSchema = z.string().trim().max(80, 'Metric must be 80 characters or less.').nullable();

export function addCounterAmount(count: number, amount: number) {
    // Add scaled integers so repeated decimal taps remain exact within the database range.
    return (Math.round(count * COUNTER_SCALE) + Math.round(amount * COUNTER_SCALE)) / COUNTER_SCALE;
}
