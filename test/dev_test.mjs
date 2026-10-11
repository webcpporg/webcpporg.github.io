// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// dev's own swap: build() writes each rebuild into a fresh directory and swaps the link `out`
// onto it with one rename (pointTo), so a request already resolving the old build keeps reading
// it, whichever of build()'s steps it lands in, and the server never answers a swap in progress
// with a 404.

import assert from 'node:assert/strict'
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {request} from 'node:http'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import {build, pointTo} from '../tools/dev.mjs'
import {serve} from '../tools/serve.mjs'

/** The answer to GET `path`. */
function get(port, path) {
    return new Promise((resolve, reject) => {
        request({host: '127.0.0.1', port, path}, response => {
            const chunks = []
            response.on('data', chunk => chunks.push(chunk))
            response.on('end', () => resolve({status: response.statusCode,
                body: Buffer.concat(chunks).toString()}))
        }).on('error', reject).end()
    })
}

test('pointTo swaps the link onto a new target with one rename, and returns what it replaced', async () => {
    const work = mkdtempSync(join(tmpdir(), 'webcpp-point-to-'))
    const link = join(work, 'current')
    const a = join(work, 'a')
    mkdirSync(a)
    writeFileSync(join(a, 'f'), 'A')
    const b = join(work, 'b')
    mkdirSync(b)
    writeFileSync(join(b, 'f'), 'B')
    assert.equal(await pointTo(link, a), null, 'nothing to replace the first time')
    assert.equal(readFileSync(join(link, 'f'), 'utf8'), 'A')
    assert.equal(await pointTo(link, b), a, 'the second call returns what it replaced')
    assert.equal(readFileSync(join(link, 'f'), 'utf8'), 'B')
})

test("a request fired in every gap of dev's own rebuild still gets the site, never a 404", async t => {
    // The bug this proves fixed: dev.mjs used to remove the served directory, then rename the
    // next build onto it, two separate steps with a real gap between them where the path simply
    // did not exist; a request landing there got a plain 404 (reproduced in review). build() now
    // only ever swaps a link (pointTo), which a request resolves through either side of: fired
    // right after each of build()'s own steps, every one of them must still answer 200.
    const work = mkdtempSync(join(tmpdir(), 'webcpp-dev-swap-'))
    const dev = join(work, 'dev')
    const out = join(dev, 'site')
    mkdirSync(dev, {recursive: true})
    await build(dev, out)
    const server = await serve({roots: [out], port: 0})
    t.after(() => server.close())
    const {port} = server.address()
    assert.equal((await get(port, '/')).status, 200, 'the first build serves')
    const seen = []
    await build(dev, out, async step => {
        const answer = await get(port, '/')
        seen.push([step, answer.status])
    })
    assert.deepEqual(seen, [['built', 200], ['linked', 200], ['cleaned', 200]], seen)
})
