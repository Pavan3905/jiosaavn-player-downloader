import { userAgents } from '../constants/index.js';

const apiCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 8000; // 8 seconds

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
        return { data: cached.data, ok: true, cached: true };
    }

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
        // If abort or network error, return clean response without unhandled crash
        return { data: null, ok: false, error: err.message, cached: false };
    }
};
