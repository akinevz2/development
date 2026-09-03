import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

export type StaticFileHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

/**
 * Serves the built web viewer (Vite `dist/`) from the collector's HTTP
 * server, so the dashboard lives on the same port and origin as the API
 * (11367) and no separate webserver process is needed. Claims exactly:
 *   `/`, `/index.html`  → dist/index.html (Cache-Control: no-cache)
 *   `/assets/*`         → hashed build assets (immutable caching)
 * Any other path returns false so the API router keeps handling it
 * (unknown routes 404 as before). Malformed/traversal paths are rejected.
 */
export function createStaticHandler(distDir: string): StaticFileHandler {
    const root = path.resolve(distDir);
    return (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return false;
        const raw = (req.url ?? '/').split('?')[0];
        let decoded: string;
        try {
            decoded = decodeURIComponent(raw);
        } catch {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad request');
            return true;
        }
        let relative: string | null = null;
        if (decoded === '/' || decoded === '/index.html') {
            relative = 'index.html';
        } else if (decoded.startsWith('/assets/')) {
            relative = decoded.slice(1);
        } else {
            return false;
        }
        const filePath = path.resolve(root, relative);
        if (filePath !== root && !filePath.startsWith(root + path.sep)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return true;
        }
        void serveFile(res, filePath, decoded.startsWith('/assets/'), req.method === 'HEAD');
        return true;
    };
}

async function serveFile(
    res: ServerResponse,
    filePath: string,
    isAsset: boolean,
    headOnly: boolean
): Promise<void> {
    try {
        const info = await stat(filePath);
        if (!info.isFile()) throw new Error('not a file');
        const body = headOnly ? undefined : await readFile(filePath);
        const type = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
        // hashed build assets never change; the entrypoint must always be
        // revalidated so a new build is picked up on reload
        res.setHeader('Cache-Control', isAsset ? 'public, max-age=31536000, immutable' : 'no-cache');
        res.setHeader('Content-Type', type);
        res.setHeader('Content-Length', String(info.size));
        res.writeHead(200);
        res.end(body);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }
}
