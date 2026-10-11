// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The serve script's server: a built site on 127.0.0.1, each file with its type, wasm, the web
// manifest and modules among them; a directory is its index.html, reached with its final slash,
// which the site's relative links need; nothing outside the directory is served.

import assert from 'node:assert/strict'
import {mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync} from 'node:fs'
import {request} from 'node:http'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import {setTimeout as sleep} from 'node:timers/promises'
import {opened, serve} from '../tools/serve.mjs'

const work = mkdtempSync(join(tmpdir(), 'webcpp-serve-'))
const root = join(work, 'site')
mkdirSync(join(root, 'docs'), {recursive: true})
writeFileSync(join(root, 'index.html'), '<!doctype html><title>home</title>')
writeFileSync(join(root, 'docs/index.html'), '<!doctype html><title>docs</title>')
writeFileSync(join(root, 'app.wasm'), Buffer.from([0, 97, 115, 109]))
writeFileSync(join(root, 'manifest.webmanifest'), '{}')
writeFileSync(join(root, 'module.mjs'), 'export {}')
writeFileSync(join(work, 'secret.txt'), 'outside the site')

/** The answer to GET `path`, sent as written, without the client normalizing it. */
function get(port, path) {
    return new Promise((resolve, reject) => {
        request({host: '127.0.0.1', port, path}, response => {
            const chunks = []
            response.on('data', chunk => chunks.push(chunk))
            response.on('end', () => resolve({status: response.statusCode, headers: response.headers,
                body: Buffer.concat(chunks).toString()}))
        }).on('error', reject).end()
    })
}

test('the server answers on 127.0.0.1 with each file\'s type', async t => {
    const server = await serve({roots: [root], port: 0})
    t.after(() => server.close())
    const {address, port} = server.address()
    assert.equal(address, '127.0.0.1')
    const types = {
        '/': 'text/html; charset=utf-8',
        '/docs/': 'text/html; charset=utf-8',
        '/app.wasm': 'application/wasm',
        '/manifest.webmanifest': 'application/manifest+json',
        '/module.mjs': 'text/javascript; charset=utf-8',
    }
    for (const [path, type] of Object.entries(types)) {
        const answer = await get(port, path)
        assert.equal(answer.status, 200, path)
        assert.equal(answer.headers['content-type'], type, path)
    }
    assert.match((await get(port, '/docs/')).body, /<title>docs<\/title>/)
})

test('a directory without its slash is redirected to it, and nothing outside the site is served', async t => {
    const server = await serve({roots: [root], port: 0})
    t.after(() => server.close())
    const {port} = server.address()
    const redirect = await get(port, '/docs?x=1')
    assert.equal(redirect.status, 301)
    assert.equal(redirect.headers.location, '/docs/?x=1')
    for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/docs/%2e%2e/%2e%2e/secret.txt', '/missing']) {
        const answer = await get(port, path)
        assert.equal(answer.status, 404, path)
        assert.doesNotMatch(answer.body, /outside the site/, path)
    }
})

test('a file briefly missing on its own is retried and opens once it is back', async () => {
    const file = join(work, 'swap.txt')
    writeFileSync(file, 'first')
    unlinkSync(file)
    const timer = setTimeout(() => writeFileSync(file, 'second'), 20)
    try {
        const handle = await opened(file)
        assert.ok(handle, 'opened retried until the file came back')
        assert.equal(await handle.readFile('utf8'), 'second')
        await handle.close()
    } finally {
        clearTimeout(timer)
    }
})

test('a file still missing past every retry answers null, never an unhandled stream error', async () => {
    assert.equal(await opened(join(work, 'never written.txt')), null)
})

test('a root that has been there and goes briefly missing is waited for, never answered the 404 that root would otherwise get at once', async t => {
    const swapped = join(work, 'swapped-root')
    mkdirSync(swapped)
    writeFileSync(join(swapped, 'index.html'), '<!doctype html><title>swapped</title>')
    const server = await serve({roots: [swapped], port: 0})
    t.after(() => server.close())
    const {port} = server.address()
    assert.equal((await get(port, '/')).status, 200, 'the root is there to begin with')
    rmSync(swapped, {recursive: true, force: true})
    const timer = setTimeout(() => {
        mkdirSync(swapped)
        writeFileSync(join(swapped, 'index.html'), '<!doctype html><title>back</title>')
    }, 40)
    try {
        const answer = await get(port, '/')
        assert.equal(answer.status, 200, answer.body)
        assert.match(answer.body, /back/)
    } finally {
        clearTimeout(timer)
    }
})

test('a root that has been there and stays missing is answered 503, never a 404 that would misreport a build in progress', async t => {
    const swapped = join(work, 'swapped-root-gone')
    mkdirSync(swapped)
    writeFileSync(join(swapped, 'index.html'), '<!doctype html><title>gone soon</title>')
    const server = await serve({roots: [swapped], port: 0})
    t.after(() => server.close())
    const {port} = server.address()
    assert.equal((await get(port, '/')).status, 200)
    rmSync(swapped, {recursive: true, force: true})
    const answer = await get(port, '/')
    assert.equal(answer.status, 503, answer.body)
    assert.equal(answer.headers['retry-after'], '1')
    mkdirSync(swapped)
    writeFileSync(join(swapped, 'index.html'), '<!doctype html><title>restored</title>')
    await sleep(0)
})

test('a root that has never held anything is never waited for: a missing file there is a plain 404', async t => {
    const never = join(work, 'never-built')
    const server = await serve({roots: [never], port: 0})
    t.after(() => server.close())
    const {port} = server.address()
    const started = Date.now()
    const answer = await get(port, '/')
    assert.equal(answer.status, 404, answer.body)
    assert.ok(Date.now() - started < 50, 'a root that never existed is answered at once, not waited for')
})

test('a file missing from the first directory is served from the next', async t => {
    const extra = join(work, 'wasm')
    mkdirSync(join(extra, 'examples'), {recursive: true})
    writeFileSync(join(extra, 'examples/calculator.wasm'), Buffer.from([0, 97, 115, 109]))
    const server = await serve({roots: [root, extra], port: 0})
    t.after(() => server.close())
    const {port} = server.address()
    const answer = await get(port, '/examples/calculator.wasm')
    assert.equal(answer.status, 200)
    assert.equal(answer.headers['content-type'], 'application/wasm')
})
