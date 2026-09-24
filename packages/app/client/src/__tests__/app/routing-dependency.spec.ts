import queryString from 'query-string';
import { expect, it } from 'vitest';

it('decodes route parameters through the patched CommonJS-to-ESM boundary', () => {
    expect(queryString.parse('code=abc%FF%F0%9F%98%80&email=a%2Bb%40example.com')).toEqual({
        code: 'abc%FF😀',
        email: 'a+b@example.com',
    });
});
