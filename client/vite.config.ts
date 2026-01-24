/// <reference types="vitest" />
import legacy from '@vitejs/plugin-legacy';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
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
    },
    server: {
        port: 8100,
        host: true,
        proxy: {
            '/users': {
                target: 'https://tally-tracker-server.onrender.com',
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
                target: 'https://tally-tracker-server.onrender.com',
                changeOrigin: true,
                secure: true,
                cookieDomainRewrite: 'localhost',
            },
            '/health': {
                target: 'https://tally-tracker-server.onrender.com',
                changeOrigin: true,
                secure: true,
                cookieDomainRewrite: 'localhost',
            },
        },
    },
});
