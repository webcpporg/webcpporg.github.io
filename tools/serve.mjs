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
// redirected there. Nothing outside the directory is served.

import {createReadStream} from 'node:fs'
import {stat} from 'node:fs/promises'
import {createServer} from 'node:http'
import {extname, join, resolve, sep} from 'node:path'
import {fileURLToPath} from 'node:url'

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
        response.writeHead(200, {
            'content-type': types[extname(found.file)] ?? 'application/octet-stream',
            'cache-control': 'no-cache',
        })
        if (request.method === 'HEAD') {
            response.end()
        } else {
            createReadStream(found.file).pipe(response)
        }
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
