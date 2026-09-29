import { expect, it } from 'vitest';
import { relativeTime } from '../../utils/relative-time';

it.each([
    [-1, '0s ago'],
    [1, '1s ago'],
    [59, '59s ago'],
    [60, '1m ago'],
    [3599, '59m ago'],
    [3600, '1h ago'],
    [86400, '1d ago'],
])('formats an action age of %s seconds', (seconds, expected) => {
    expect(relativeTime('2026-09-28T00:00:00Z', Date.parse('2026-09-28T00:00:00Z') + Number(seconds) * 1000)).toBe(
        expected,
    );
});
