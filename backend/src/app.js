import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { compress } from 'hono/compress';
import { AlbumController, ArtistController, SearchController, SongController } from './modules/index.js';
import { PlaylistController } from './modules/playlists/controllers/index.js';

const isAllowedMediaUrl = (value) => {
    if (!value || typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' &&
            (url.hostname === 'saavncdn.com' || url.hostname.endsWith('.saavncdn.com')));
    } catch {
        return false;
    }
};

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;

const rateLimiter = async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 
               c.req.header('x-real-ip') || 
               'anonymous';
    const now = Date.now();
    const clientData = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

    if (now > clientData.resetTime) {
        clientData.count = 1;
        clientData.resetTime = now + RATE_LIMIT_WINDOW;
    } else {
        clientData.count++;
    }

    if (rateLimitMap.size > 5000) {
        const firstKey = rateLimitMap.keys().next().value;
        rateLimitMap.delete(firstKey);
    }
    rateLimitMap.set(ip, clientData);

    if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
        c.header('Retry-After', '60');
        return c.json({ success: false, message: 'Too many requests. Please slow down.' }, 429);
    }

    await next();
};
export class App {
    app;
    constructor(routes) {
        this.app = new OpenAPIHono();
        this.initializeGlobalMiddlewares();
        this.initializeRoutes(routes);
        this.initializeSwaggerUI();
        this.initializeRouteFallback();
        this.initializeErrorHandler();
    }
    initializeRoutes(routes) {
        routes.forEach((route) => {
            route.initRoutes();
            this.app.route('/api', route.controller);
        });
        // Audio streaming proxy with HTTP 206 Partial Content range support
        this.app.get('/api/stream', async (c) => {
            const targetUrl = c.req.query('url');
            if (!targetUrl)
                return c.text('Missing url parameter', 400);
            try {
                if (!isAllowedMediaUrl(targetUrl))
                    return c.text('Forbidden host', 403);
                const rangeHeader = c.req.header('range');
                const requestHeaders = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                };
                if (rangeHeader) {
                    requestHeaders['Range'] = rangeHeader;
                }
                const upstream = await fetch(targetUrl, { headers: requestHeaders });
                const headers = new Headers();
                const forwardHeaders = [
                    'content-type',
                    'content-length',
                    'content-range',
                    'accept-ranges',
                    'cache-control',
                    'last-modified',
                    'etag'
                ];
                forwardHeaders.forEach((h) => {
                    const val = upstream.headers.get(h);
                    if (val)
                        headers.set(h, val);
                });
                if (!headers.has('content-type')) {
                    headers.set('content-type', 'audio/mp4');
                }
                headers.set('accept-ranges', 'bytes');
                headers.set('access-control-allow-origin', '*');
                headers.set('access-control-allow-headers', '*');
                return new Response(upstream.body, {
                    status: upstream.status,
                    headers
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'unknown error';
                return c.text(`Streaming error: ${message}`, 502);
            }
        });
        // Media download proxy
        this.app.get('/api/download', async (c) => {
            const targetUrl = c.req.query('url');
            const filename = c.req.query('filename') || 'track.m4a';
            if (!targetUrl)
                return c.text('Missing url parameter', 400);
            try {
                if (!isAllowedMediaUrl(targetUrl))
                    return c.text('Forbidden host', 403);
                const upstream = await fetch(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                if (!upstream.ok) {
                    return new Response(`Upstream media request failed (${upstream.status})`, {
                        status: upstream.status
                    });
                }
                const headers = new Headers();
                const pathname = new URL(targetUrl).pathname.toLowerCase();
                const fallbackContentType = pathname.endsWith('.png')
                    ? 'image/png'
                    : /\.jpe?g$/.test(pathname)
                        ? 'image/jpeg'
                        : 'audio/mp4';
                headers.set('content-type', upstream.headers.get('content-type') || fallbackContentType);
                const cl = upstream.headers.get('content-length');
                if (cl)
                    headers.set('content-length', cl);
                const safeFilename = filename.replaceAll(/[\\/\r\n"]/g, '_');
                headers.set('content-disposition', `attachment; filename="${safeFilename.replaceAll(/[^\u0020-\u007E]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
                headers.set('access-control-allow-origin', '*');
                return new Response(upstream.body, {
                    status: upstream.status,
                    headers
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'unknown error';
                return c.text(`Download error: ${message}`, 502);
            }
        });
        this.app.get('/', (c) => {
            return c.json({
                success: true,
                message: 'JioSaavn API backend is running',
                docs: '/docs',
                openapi: '/swagger'
            });
        });
    }
    initializeGlobalMiddlewares() {
        this.app.use(compress());
        this.app.use(logger());
        this.app.use(prettyJSON());
        this.app.use(cors());
        this.app.use(rateLimiter);

        this.app.use('/api/*', async (c, next) => {
            await next();
            if (c.req.method === 'GET' && c.res.status === 200 && !c.res.headers.has('cache-control')) {
                c.header('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
            }
        });
    }
    initializeSwaggerUI() {
        this.app.doc31('/swagger', (c) => {
            const { protocol: urlProtocol, hostname, port } = new URL(c.req.url);
            const protocol = c.req.header('x-forwarded-proto') ? `${c.req.header('x-forwarded-proto')}:` : urlProtocol;
            return {
                openapi: '3.1.0',
                info: {
                    version: '1.0.0',
                    title: 'JioSaavn API',
                    description: `# Introduction 
        \nJioSaavn API, accessible at [saavn.dev](https://saavn.dev), is an unofficial API that allows users to download high-quality songs from [JioSaavn](https://jiosaavn.com). 
        It offers a fast, reliable, and easy-to-use API for developers. \n`
                },
                servers: [{ url: `${protocol}//${hostname}${port ? `:${port}` : ''}`, description: 'Current environment' }]
            };
        });
        this.app.get('/docs', apiReference({
            pageTitle: 'JioSaavn API Documentation',
            theme: 'deepSpace',
            isEditable: false,
            layout: 'modern',
            darkMode: true,
            metaData: {
                applicationName: 'JioSaavn API',
                author: 'Sumit Kolhe',
                creator: 'Sumit Kolhe',
                publisher: 'Sumit Kolhe',
                robots: 'index, follow',
                description: 'JioSaavn API is an unofficial wrapper written in TypeScript for jiosaavn.com providing programmatic access to a vast library of songs, albums, artists, playlists, and more.'
            },
            url: '/swagger'
        }));
    }
    initializeRouteFallback() {
        this.app.notFound((ctx) => {
            return ctx.json({ success: false, message: 'route not found, check docs at https://saavn.dev/docs' }, 404);
        });
    }
    initializeErrorHandler() {
        this.app.onError((err, ctx) => {
            const error = err;
            return ctx.json({ success: false, message: error.message }, error.status || 500);
        });
    }
    getApp() {
        return this.app;
    }
}

export const createApp = () => {
    return new App([
        new SearchController(),
        new SongController(),
        new AlbumController(),
        new ArtistController(),
        new PlaylistController()
    ]).getApp();
};

const app = createApp();

export default app;
