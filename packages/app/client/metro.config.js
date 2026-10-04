const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { createHash } = require('node:crypto');
const http = require('node:http');
const https = require('node:https');

const config = getSentryExpoConfig(__dirname);
// Production transforms inline public values, even when CI reuses Metro's cache.
const publicEnv = Object.keys(process.env)
    .filter((key) => key.startsWith('EXPO_PUBLIC_'))
    .sort()
    .map((key) => [key, process.env[key]]);
config.cacheVersion += createHash('sha256').update(JSON.stringify(publicEnv)).digest('hex');

const target = new URL(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000');
const transport = target.protocol === 'https:' ? https : http;
const enhanceMiddleware = config.server.enhanceMiddleware;

config.server.enhanceMiddleware = (middleware, server) => {
    const metro = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;

    return (req, res, next) => {
        if (req.url === '/__tally_dev__/api-origin') {
            res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
            return res.end(target.origin);
        }
        if (!/^\/(users|counters|billing|health|socket\.io)(\/|\?|$)/.test(req.url)) return metro(req, res, next);

        // Only the dev site's requests may use its authenticated proxy.
        const origin = req.headers.origin;
        if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) {
            res.writeHead(403);
            return res.end();
        }

        const headers = { ...req.headers, host: target.host };
        delete headers.origin;
        const upstream = transport.request(new URL(req.url, target), { method: req.method, headers }, (response) => {
            // Scope cookies to the dev host, including plain HTTP on the local network.
            if (response.headers['set-cookie']) {
                response.headers['set-cookie'] = response.headers['set-cookie'].map((cookie) =>
                    cookie
                        .replace(/;\s*Domain=[^;]*/gi, '')
                        .replace(/;\s*Secure\b/gi, '')
                        .replace(/;\s*SameSite=[^;]*/gi, '; SameSite=Lax'),
                );
            }
            res.writeHead(response.statusCode, response.headers);
            response.on('error', () => res.destroy());
            response.pipe(res);
        });

        upstream.on('error', () => {
            if (res.destroyed) return;
            if (res.headersSent) return res.destroy();
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Cannot reach the API through the development proxy.' }));
        });
        res.on('close', () => upstream.destroy());
        req.on('error', () => upstream.destroy());
        req.pipe(upstream);
    };
};

module.exports = config;
