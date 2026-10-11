// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The serve script: a built site, served on 127.0.0.1 with node's http module alone.
//
//   serve.mjs <dir> [port]
//
// serves <dir>, by default on port 8765, until it is stopped. A relative <dir> is read from the
// directory npm was started in (INIT_CWD), so that `npm run serve -- ../bin/site` from this
// repository, and b2 site-serve from the superproject's root with bin/site, each name what they
// mean. Each file is served with its type, wasm, the web manifest and modules among them, and
// without caching, so that a reload shows the last build. A directory is its index.html, reached
// with its final slash, which the site's relative links need: a path to one without it is
// redirected there. Nothing outside the directory is served. A file that goes missing for the
// moment dev's rebuild swaps the directory (tools/dev.mjs) is retried, then answered 503; the
// server never ends on it.

import {open, stat} from 'node:fs/promises'
import {createServer} from 'node:http'
import {extname, join, resolve, sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'

export const host = '127.0.0.1'
export const defaultPort = 8765

/** The type of each kind of file a site holds. */
const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.woff2': 'font/woff2',
}

// dev.mjs rebuilds by removing the served directory and renaming the next build onto it
// (tools/dev.mjs, build()): a request already resolved to a file there may find it gone for the
// moment the swap takes. Ten retries, 10ms apart, cover that window without the reader noticing;
// past it, the file is answered 503, to try again, never left to an unhandled stream error, which
// would otherwise end the process.
const REBUILD_RETRIES = 10
const REBUILD_DELAY_MS = 10

/**
 * `file`, open for reading, retried while it is missing (dev's rebuild swapping the directory),
 * or null once it still is after every retry: a stream only ever opens a file this found, so a
 * fault once it is reading is never the swap, and is let through as the stream's own 'error'.
 */
export async function opened(file) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await open(file, 'r')
        } catch (error) {
            if (error.code !== 'ENOENT' || attempt === REBUILD_RETRIES) {
                return null
            }
            await sleep(REBUILD_DELAY_MS)
        }
    }
}

/** The file of `root` that `path` names, a directory standing for its index.html, or null. */
async function fileOf(root, path) {
    const file = resolve(root, `.${path}`)
    if (file !== root && !file.startsWith(root + sep)) {
        return null
    }
    const entry = await stat(file).catch(() => null)
    if (entry?.isDirectory()) {
        return (await stat(join(file, 'index.html')).catch(() => null))?.isFile() ? {file: join(file, 'index.html'), directory: true} : null
    }
    return entry?.isFile() ? {file, directory: false} : null
}

/** The answer to one request, from the first of `roots` that holds its path. */
async function answer(roots, request, response) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, {allow: 'GET, HEAD'}).end()
        return
    }
    const url = new URL(request.url, `http://${host}`)
    let path = null
    try {
        path = decodeURIComponent(url.pathname)
    } catch {
        // A malformed escape names no file.
    }
    for (const root of path === null || path.includes('\0') ? [] : roots) {
        const found = await fileOf(root, path)
        if (!found) {
            continue
        }
        if (found.directory && !path.endsWith('/')) {
            response.writeHead(301, {location: `${url.pathname}/${url.search}`}).end()
            return
        }
        if (request.method === 'HEAD') {
            response.writeHead(200, {
                'content-type': types[extname(found.file)] ?? 'application/octet-stream',
                'cache-control': 'no-cache',
            }).end()
            return
        }
        const handle = await opened(found.file)
        if (!handle) {
            response.writeHead(503, {'content-type': types['.txt'], 'retry-after': '1'})
                .end('The site is being built again; try once more.\n')
            return
        }
        response.writeHead(200, {
            'content-type': types[extname(found.file)] ?? 'application/octet-stream',
            'cache-control': 'no-cache',
        })
        // The stream closes handle itself once it is done: handle.close() afterwards would race it.
        const stream = handle.createReadStream()
        stream.once('error', () => response.destroy())
        stream.pipe(response)
        return
    }
    response.writeHead(404, {'content-type': types['.txt']}).end(`Not found: ${url.pathname}\n`)
}

/**
 * A server of the directories `roots`, the first that holds a path answering it, listening on
 * 127.0.0.1 at `port` (0 for any free port) once the promise resolves.
 */
export function serve({roots, port = defaultPort}) {
    const absolute = roots.map(root => resolve(root))
    const server = createServer((request, response) => {
        answer(absolute, request, response).catch(error => {
            response.writeHead(500, {'content-type': types['.txt']}).end(`${error.message}\n`)
        })
    })
    return new Promise((done, failed) => {
        server.once('error', failed)
        server.listen(port, host, () => done(server))
    })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const [directory, port = String(defaultPort)] = process.argv.slice(2)
    if (!directory || !/^\d+$/.test(port)) {
        console.error('usage: serve.mjs <dir> [port]')
        process.exit(2)
    }
    const root = resolve(process.env.INIT_CWD ?? process.cwd(), directory)
    if (!(await stat(root).catch(() => null))?.isDirectory()) {
        console.error(`serve.mjs: ${root} is not a directory; build the site first`)
        process.exit(1)
    }
    await serve({roots: [root], port: Number(port)})
    console.log(`Serving ${root} at http://${host}:${port}/`)
}
