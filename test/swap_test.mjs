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
import {existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, renameSync, symlinkSync, writeFileSync} from 'node:fs'
import {Agent, request} from 'node:http'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import test from 'node:test'
import {pointTo, swap} from '../tools/swap.mjs'
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

/** A bin/ with a link onto its one build, and a directory of someone else's beside them. */
function layout() {
    const bin = join(mkdtempSync(join(tmpdir(), 'webcpp-swap-')), 'bin')
    mkdirSync(join(bin, 'keep-me'), {recursive: true})
    writeFileSync(join(bin, 'keep-me/data'), 'not a build')
    const builds = join(bin, 'site.builds')
    const link = join(bin, 'site')
    return {bin, builds, link}
}

/** Every path under `directory`, with what each file holds, for a before and after. */
function snapshot(directory) {
    return readdirSync(directory, {recursive: true}).sort().map(entry => {
        const path = join(directory, entry)
        const stat = lstatSync(path)
        return [entry, stat.isSymbolicLink() ? `-> ${readlinkSync(path)}` : stat.isFile() ? readFileSync(path, 'utf8') : 'dir']
    })
}

/** The exit status and the standard error of the swap script run with `args`. */
function script(...args) {
    try {
        execFileSync(process.execPath, [join(site, 'tools/swap.mjs'), ...args], {stdio: 'pipe'})
        return {status: 0, stderr: ''}
    } catch (error) {
        return {status: error.status, stderr: error.stderr.toString()}
    }
}

test('swap refuses a build that is not an existing directory, exit 2, and touches nothing', async () => {
    const {bin, builds, link} = layout()
    await swap(link, build(builds, 1))
    const before = snapshot(bin)
    for (const missing of [join(bin, 'typo-build'), join(builds, 'build-missing')]) {
        const {status, stderr} = script(link, missing)
        assert.equal(status, 2, missing)
        assert.match(stderr, /is not a directory/)
        assert.deepEqual(snapshot(bin), before, missing)
    }
    await assert.rejects(swap(link, join(builds, 'build-missing')), /is not a directory/)
    assert.deepEqual(snapshot(bin), before)
})

test("swap refuses a build outside the link's own builds directory, and touches nothing", async () => {
    const {bin, builds, link} = layout()
    await swap(link, build(builds, 1))
    const elsewhere = build(join(bin, 'elsewhere'), 2)
    const before = snapshot(bin)
    const {status, stderr} = script(link, elsewhere)
    assert.equal(status, 2)
    assert.match(stderr, /site\.builds/)
    assert.deepEqual(snapshot(bin), before)
})

test("swap removes only the builds of the link's builds directory, never an entry that is not one", async () => {
    const {bin, builds, link} = layout()
    await swap(link, build(builds, 1))
    writeFileSync(join(builds, 'notes.txt'), 'mine')
    await swap(link, build(builds, 2))
    assert.deepEqual(readdirSync(builds).sort(), ['build-2', 'notes.txt'])
    assert.ok(existsSync(join(bin, 'keep-me/data')))
})

test('pointTo removes only the stale next links it once made, never an entry that merely shares their name', async () => {
    const {bin, builds, link} = layout()
    const target = build(builds, 1)
    symlinkSync(target, join(bin, 'site.next-123'), 'dir')
    writeFileSync(join(bin, 'site.next-notes'), 'mine')
    mkdirSync(join(bin, 'site.next-456'))
    writeFileSync(join(bin, 'site.next-456/data'), 'mine too')
    await pointTo(link, target)
    assert.deepEqual(readdirSync(bin).sort(), ['keep-me', 'site', 'site.builds', 'site.next-456', 'site.next-notes'])
})

test('the link points to its build relatively, so that a checkout moved elsewhere still reads it', async () => {
    const {bin, builds, link} = layout()
    await swap(link, build(builds, 1))
    assert.equal(readlinkSync(link), join('site.builds', 'build-1'))
    const moved = join(dirname(bin), 'moved')
    renameSync(bin, moved)
    assert.match(readFileSync(join(moved, 'site/index.html'), 'utf8'), /home 1/)
})

