import legacy from '@vitejs/plugin-legacy';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const API_URL = env.VITE_API_URL || 'http://localhost:3000';
    console.log(`⚡️ Vite Proxy pointing to: ${API_URL}`);

    return {
        plugins: [vue(), legacy()],
        css: {
            preprocessorOptions: {
                scss: {
                    api: 'modern-compiler',
                    additionalData: `
                    @use "@/assets/styles/_variables.scss" as *;
                    @use "@/assets/styles/_utils.scss" as *;
                `,
                },
            },
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        test: {
            globals: true,
            environment: 'jsdom',
            include: ['src/**/*.{test,spec}.{js,ts}'],
        },
        server: {
            port: 8100,
            host: true,

            /**
             * Proxies forward requests to the remote API during web development.
             * cookieDomainRewrite rewrites the Set-Cookie domain from the remote
             * host to localhost so the browser accepts it. See: docs/diagrams/sequence/auth/dev-vite-proxy.md
             */
            proxy: {
                '/users': {
                    target: API_URL,
                    changeOrigin: true,
                    secure: true,
                    cookieDomainRewrite: 'localhost',
                    configure: (proxy, _options) => {
                        proxy.on('error', (err, _req, _res) => {
                            console.log('proxy error', err);
                        });
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            console.log('Sending Request to the Target:', req.method, req.url);
                        });
                        proxy.on('proxyRes', (proxyRes, req, _res) => {
                            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
                        });
                    },
                },
                '/counters': {
                    target: API_URL,
                    changeOrigin: true,
                    secure: true,
                    cookieDomainRewrite: 'localhost',
                },
                '/health': {
                    target: API_URL,
                    changeOrigin: true,
                    secure: true,
                    cookieDomainRewrite: 'localhost',
                },
            },
        },
    };
});
