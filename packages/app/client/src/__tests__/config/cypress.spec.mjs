import { afterEach, expect, it, vi } from 'vitest';
import config from '../../../cypress.config.mjs';

afterEach(() => vi.unstubAllGlobals());

it('refuses remote sites and remote API proxies before browser tests can mutate data', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const setup = (baseUrl) => config.e2e.setupNodeEvents(() => {}, { baseUrl });

    await expect(setup('https://tally.example.com')).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();

    for (const origin of ['https://api.example.com', 'http://localhost.example.com', 'not a URL']) {
        fetch.mockResolvedValueOnce(new Response(origin));
        await expect(setup('http://localhost:8081')).rejects.toThrow();
    }

    fetch.mockResolvedValueOnce(new Response('http://localhost:3000'));
    await expect(setup('http://localhost:8081')).resolves.toBeUndefined();
});
