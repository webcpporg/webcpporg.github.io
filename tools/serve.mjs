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
// redirected there. Nothing outside the directory is served. dev.mjs serves through a link it
// swaps onto a fresh build (pointTo): a root that has been there and goes briefly missing (the
// swap's own gap, real only on Windows, which cannot rename a link onto one already there) is
// waited for, bounded, then answered 503, never the 404 a root that simply never held the path
// gets at once; a file that goes missing once its root is there is retried the same way, then
// answered 503 too. Neither case, nor a fault of the stream itself, ever ends the process on it.

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

// dev.mjs swaps the link it serves through onto a fresh build (tools/dev.mjs, pointTo()): on
// Windows alone, which cannot rename a link onto one already there, the old link is removed
// first, a real gap. Five retries, 20ms apart, cover it without a reader noticing; a file within
// an otherwise-present root is retried the same way, for the narrower case of one file gone on
// its own; past either, the request is answered 503, to try again, never left to a 404 that would
// misreport a build in progress as a missing page, nor to an unhandled stream error, which would
// otherwise end the process.
const SWAP_RETRIES = 5
const SWAP_DELAY_MS = 20

/** Waits, bounded, for `missing()` (a root or a file, each checked its own way) to stop being
 * true, retrying `found()` after each wait; its result once `missing()` is false, or null once
 * it still is after every retry. */
async function retried(missing, found) {
    for (let attempt = 0; ; attempt++) {
        if (!(await missing())) {
            return await found()
        }
        if (attempt === SWAP_RETRIES) {
            return null
        }
        await sleep(SWAP_DELAY_MS)
    }
}

/** Whether `root` is there right now, a directory or what resolves to one (a symlink or a
 * junction): false only in the gap pointTo's own rename may leave on Windows, or before the first
 * build ever runs. */
async function exists(root) {
    const entry = await stat(root).catch(() => null)
    return entry !== null && entry.isDirectory()
}

/** Whether `file` is there right now, a plain file. */
async function fileExists(file) {
    const entry = await stat(file).catch(() => null)
    return entry !== null && entry.isFile()
}

/**
 * `file`, open for reading, retried while it is missing on its own (its root is there, as
 * `fileOf` already found it, but the file itself briefly is not), or null once it still is after
 * every retry: a stream only ever opens a file this found, so a fault once it is reading is
 * never this gap, and is let through as the stream's own 'error'.
 */
export async function opened(file) {
    return retried(
        async () => !(await fileExists(file)),
        () => open(file, 'r').catch(() => null),
    )
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

const unavailable = response => response.writeHead(503, {'content-type': types['.txt'], 'retry-after': '1'})
    .end('The site is being built again; try once more.\n')

/** Answers `found` (fileOf's), a redirect to its final slash for a directory without one, its
 * type and no caching otherwise, HEAD ending there, GET streamed from the file opened (retried),
 * 503 if that still fails. */
async function respond(found, path, url, request, response) {
    if (found.directory && !path.endsWith('/')) {
        response.writeHead(301, {location: `${url.pathname}/${url.search}`}).end()
        return
    }
    const headers = {
        'content-type': types[extname(found.file)] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
    }
    if (request.method === 'HEAD') {
        response.writeHead(200, headers).end()
        return
    }
    const handle = await opened(found.file)
    if (!handle) {
        unavailable(response)
        return
    }
    response.writeHead(200, headers)
    // The stream closes handle itself once it is done: handle.close() afterwards would race it.
    const stream = handle.createReadStream()
    stream.once('error', () => response.destroy())
    stream.pipe(response)
}

/** The answer to one request, from the first of `roots` that holds its path: `everSeen`, shared
 * across requests, remembers which roots have been there, so a root that simply never held
 * anything (serve({roots: [out, cache]})'s cache, before an example has wasm) is never waited for,
 * only one that was there and has gone briefly missing, the swap's own gap. */
async function answer(roots, everSeen, request, response) {
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
        if (await exists(root)) {
            everSeen.add(root)
        } else if (everSeen.has(root)) {
            // root has been there before and is briefly gone now: pointTo's own gap
            // (tools/dev.mjs), waited for, bounded, rather than answered the 404 a root that
            // simply never held path would get at once.
            if (!(await retried(async () => !(await exists(root)), async () => true))) {
                unavailable(response)
                return
            }
        } else {
            continue
        }
        const found = await fileOf(root, path)
        if (!found) {
            continue
        }
        await respond(found, path, url, request, response)
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
    const everSeen = new Set()
    const server = createServer((request, response) => {
        answer(absolute, everSeen, request, response).catch(error => {
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
