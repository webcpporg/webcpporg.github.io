// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The swap script, through which b2 site moves each build it finishes onto bin/site, as dev.mjs
// moves its own: a link renamed in one step onto the new build (pointTo), the builds it replaced
// removed only afterwards, so that a server on the link never answers a rebuild with a 404 or a
// 503. b2 site once removed bin/site and moved the new build there, two steps with a window
// between them: a server running on it answered thousands of requests of a rebuild 404 and 503.

import assert from 'node:assert/strict'
import {execFileSync, spawn} from 'node:child_process'
import {existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync} from 'node:fs'
import {Agent, request} from 'node:http'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import {swap} from '../tools/swap.mjs'
import {serve} from '../tools/serve.mjs'
import {site} from './site.mjs'

/** A build of `n` under `builds`: a home, a page and many small files, as a site has. */
function build(builds, n) {
    const directory = join(builds, `build-${n}`)
    mkdirSync(join(directory, 'libraries'), {recursive: true})
    mkdirSync(join(directory, 'assets'))
    writeFileSync(join(directory, 'index.html'), `<!doctype html><title>home ${n}</title>`)
    writeFileSync(join(directory, 'libraries/index.html'), `<!doctype html><title>libraries ${n}</title>`)
    for (let i = 0; i < 400; i++) {
        writeFileSync(join(directory, `assets/file-${i}.css`), `/* ${n} */`)
    }
    return directory
}

/** The status of GET `path`, on a connection kept alive by `agent`. */
function status(agent, port, path) {
    return new Promise((resolve, reject) => {
        request({host: '127.0.0.1', port, path, agent}, response => {
            response.resume()
            response.on('end', () => resolve(response.statusCode))
        }).on('error', reject).end()
    })
}

test('a server on the link answers every request of a run of rebuilds 200, never 404 or 503', async t => {
    const work = mkdtempSync(join(tmpdir(), 'webcpp-swap-'))
    const builds = join(work, 'site.builds')
    const link = join(work, 'site')
    await swap(link, build(builds, 0))
    const server = await serve({roots: [link], port: 0})
    const agent = new Agent({keepAlive: true, maxSockets: 16})
    t.after(() => {
        agent.destroy()
        server.close()
    })
    const {port} = server.address()
    const answers = new Map()
    let swapping = true
    const client = async () => {
        for (let i = 0; swapping; i++) {
            const path = ['/', '/libraries/', `/assets/file-${i % 400}.css`][i % 3]
            const code = await status(agent, port, path)
            answers.set(code, (answers.get(code) ?? 0) + 1)
        }
    }
    const clients = Array.from({length: 16}, client)
    for (let n = 1; n <= 30; n++) {
        await swap(link, build(builds, n))
    }
    swapping = false
    await Promise.all(clients)
    const total = [...answers.values()].reduce((a, b) => a + b, 0)
    assert.ok(total > 300, `only ${total} requests were made across the rebuilds`)
    assert.deepEqual([...answers.keys()], [200], JSON.stringify(Object.fromEntries(answers)))
})

test('swap leaves the link on the new build and removes the one it replaced and any stale one', async () => {
    const work = mkdtempSync(join(tmpdir(), 'webcpp-swap-'))
    const builds = join(work, 'site.builds')
    const link = join(work, 'site')
    await swap(link, build(builds, 1))
    const stale = build(builds, 2)
    const next = build(builds, 3)
    await swap(link, next)
    assert.ok(lstatSync(link).isSymbolicLink())
    assert.match(readFileSync(join(link, 'index.html'), 'utf8'), /home 3/)
    assert.deepEqual(readdirSync(builds), ['build-3'], 'the replaced build and the stale one are gone')
    assert.ok(!existsSync(stale))
})

test('the swap and serve scripts run when started through a path that holds a link, as a checkout under /var on macOS is', async t => {
    // node resolves the main module's own path through links, and process.argv[1] keeps them: a
    // script that compared the two never ran its command line from such a path, silently.
    const work = mkdtempSync(join(tmpdir(), 'webcpp-swap-'))
    const tools = join(work, 'tools-link')
    symlinkSync(join(site, 'tools'), tools, 'dir')
    const link = join(work, 'site')
    execFileSync(process.execPath, [join(tools, 'swap.mjs'), link, build(join(work, 'site.builds'), 1)])
    assert.ok(lstatSync(link).isSymbolicLink(), 'swap.mjs ran')
    const port = String(40000 + (process.pid % 20000))
    const server = spawn(process.execPath, [join(tools, 'serve.mjs'), link, port], {stdio: ['ignore', 'pipe', 'inherit']})
    t.after(() => server.kill())
    const said = await new Promise(resolve => {
        server.stdout.once('data', chunk => resolve(chunk.toString()))
        server.once('exit', code => resolve(`exited ${code}`))
    })
    assert.match(said, /^Serving /, 'serve.mjs ran')
})

test('swap replaces a real directory at the link, the layout bin/site had before it was a link', async () => {
    const work = mkdtempSync(join(tmpdir(), 'webcpp-swap-'))
    const link = join(work, 'site')
    mkdirSync(link)
    writeFileSync(join(link, 'index.html'), 'the old layout')
    const next = build(join(work, 'site.builds'), 1)
    execFileSync(process.execPath, [join(site, 'tools/swap.mjs'), link, next])
    assert.ok(lstatSync(link).isSymbolicLink())
    assert.match(readFileSync(join(link, 'index.html'), 'utf8'), /home 1/)
})
