import { userAgents } from '../constants/index.js';

const apiCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 8000; // 8 seconds
const pendingRequests = new Map();

export const useFetch = async ({ endpoint, params, context }) => {
    const url = new URL('https://www.jiosaavn.com/api.php');
    url.searchParams.append('__call', endpoint.toString());
    url.searchParams.append('_format', 'json');
    url.searchParams.append('_marker', '0');
    url.searchParams.append('api_version', '4');
    url.searchParams.append('ctx', context || 'web6dot0');

    const sortedKeys = Object.keys(params).sort();
    sortedKeys.forEach((key) => url.searchParams.append(key, String(params[key])));

    const cacheKey = url.toString();
    const cached = apiCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        apiCache.delete(cacheKey);
        apiCache.set(cacheKey, cached);
        return { data: cached.data, ok: true, cached: true };
    }
    if (cached) {
        apiCache.delete(cacheKey);
    }

    const pending = pendingRequests.get(cacheKey);
    if (pending) {
        const result = await pending;
        return { ...result, cached: true };
    }

    const request = (async () => {
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

        try {
            const response = await fetch(url.toString(), {
                headers: { 'Content-Type': 'application/json', 'User-Agent': randomUserAgent },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
            });

            const data = await response.json();

            if (response.ok && data) {
                if (apiCache.size >= MAX_CACHE_SIZE) {
                    const firstKey = apiCache.keys().next().value;
                    apiCache.delete(firstKey);
                }
                apiCache.set(cacheKey, { data, timestamp: Date.now() });
            }

            return { data, ok: response.ok, cached: false };
        } catch (err) {
            return { data: null, ok: false, error: err.message, cached: false };
        }
    })();

    pendingRequests.set(cacheKey, request);
    try {
        return await request;
    } finally {
        if (pendingRequests.get(cacheKey) === request) {
            pendingRequests.delete(cacheKey);
        }
    }
};
