// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The README's two ways in, kept true: every npm and b2 command it shows exists, the section for
// C++ developers names no npm, package.json or bundler, and the section for JavaScript developers
// has both its paths. And what the first path promises of `npm run dev`: the examples' wasm built
// locally when there is some, else the published preview's, downloaded once and checked against
// its precache.json; tested with a fake fetch, without the network.

import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import {exampleWasm} from '../tools/dev.mjs'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts

/** The npm commands the README may show besides `npm run <script>` and `npm test`. */
const npmCommands = new Set(['ci', 'install', 'test', 'run'])
/** The b2 targets the build declares for the site. */
const b2Targets = new Set(['site', 'site-serve', '/webcpp/site//test', '/webcpp/site//browser-test'])

/** The text of every code span and code block of `markdown`, one entry each. */
function code(markdown) {
    const blocks = [...markdown.matchAll(/^```[^\n]*\n([\s\S]*?)^```$/gm)].map(found => found[1])
    const indented = [...markdown.matchAll(/(?:^(?: {4}|\t).*\n?)+/gm)].map(found => found[0])
    const spans = [...markdown.replace(/^```[\s\S]*?^```$/gm, '').matchAll(/`([^`\n]+)`/g)].map(found => found[1])
    return [...blocks, ...indented, ...spans]
}

/** Each command of `tool` the code of `markdown` shows, as its words after the tool's name. */
function commands(markdown, tool) {
    const found = []
    for (const text of code(markdown)) {
        for (const match of text.matchAll(new RegExp(`(?:^|[\\s;&|(])${tool}((?: +[^\\s;&|)]+)*)`, 'gm'))) {
            found.push(match[1].trim().split(/ +/).filter(Boolean))
        }
    }
    return found
}

/** The section of the README under the heading `## <title>`, up to the next `## `. */
function section(title) {
    const start = readme.indexOf(`\n## ${title}\n`)
    assert.ok(start >= 0, `the README has a section "${title}"`)
    const end = readme.indexOf('\n## ', start + 1)
    return readme.slice(start, end < 0 ? undefined : end)
}

test('every npm command the README shows is an npm command or a script of package.json', () => {
    const shown = commands(readme, 'npm')
    assert.ok(shown.length > 0, 'the README shows npm commands')
    for (const words of shown) {
        const [command, script] = words.filter(word => !word.startsWith('-'))
        assert.ok(npmCommands.has(command), `npm ${words.join(' ')}: ${command} is not an npm command the README may show`)
        if (command === 'run') {
            assert.ok(script in scripts, `npm ${words.join(' ')}: ${script} is no script of package.json`)
        }
        if (command === 'test') {
            assert.ok('test' in scripts, 'npm test: package.json has no test script')
        }
    }
})

test('every b2 command the README shows names a target the build declares', () => {
    const shown = commands(readme, 'b2')
    assert.ok(shown.length > 0, 'the README shows b2 commands')
    for (const words of shown) {
        const targets = words.filter(word => !word.startsWith('-') && !word.includes('='))
        assert.ok(targets.length > 0, `b2 ${words.join(' ')} names no target`)
        for (const target of targets) {
            assert.ok(b2Targets.has(target), `b2 ${words.join(' ')}: ${target} is not a target of the site`)
        }
    }
})

test('the section for C++ developers names no npm, package.json or bundler', () => {
    const text = section('For C++ developers')
    for (const word of [/\bnpm\b/i, /package\.json/i, /esbuild/i, /\bbundler?\b/i]) {
        assert.doesNotMatch(text, word)
    }
    assert.match(text, /`b2 site`/)
    assert.match(text, /`b2 site-serve`/)
})

test('the section for JavaScript developers has both paths', () => {
    const text = section('For JavaScript developers')
    const second = text.indexOf('Path 2')
    assert.ok(text.indexOf('Path 1') >= 0 && second > text.indexOf('Path 1'), 'Path 1, then Path 2')
    // Words wrapped across lines read as one text.
    const [first, whole] = [text.slice(0, second), text.slice(second)].map(part => part.replace(/\s+/g, ' '))
    for (const command of ['OPENUI_TELEMETRY_DISABLED=1 npm ci', 'npm run dev', 'npm test']) {
        assert.ok(first.includes(command), `Path 1 shows ${command}`)
    }
    assert.doesNotMatch(first, /\bb2\b/, 'Path 1 needs no b2')
    // Each tool with its exact version: b2, Boost, the emsdk, node and MrDocs.
    for (const text of ['git clone --recursive', 'b2 site-serve', 'B2 5.5.3', 'Boost 1.92.0',
        'emsdk install 6.0.11', 'node 26.7.0', 'MrDocs 2026.9.29']) {
        assert.ok(whole.includes(text), `Path 2 shows ${text}`)
    }
})

/** A fetch that answers `files`, by URL, and records each URL it was asked for. */
function fakeFetch(files) {
    const asked = []
    const fetch = async url => {
        asked.push(url)
        const body = files[url]
        if (body === undefined) {
            return {ok: false, status: 404}
        }
        return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(body),
            arrayBuffer: async () => new Uint8Array(Buffer.from(body)).buffer,
        }
    }
    return {fetch, asked}
}

const sha256 = text => createHash('sha256').update(text).digest('hex')
const base = 'https://webcpporg.github.io/'

test('dev takes the examples\' wasm from bin/site when the superproject built it, without the network', async () => {
    const work = mkdtempSync(join(tmpdir(), 'webcpp-dev-'))
    const local = join(work, 'bin/site')
    mkdirSync(join(local, 'examples/calculator'), {recursive: true})
    writeFileSync(join(local, 'examples/calculator/calculator.wasm'), 'local wasm')
    const {fetch, asked} = fakeFetch({})
    const found = await exampleWasm({local, cache: join(work, 'build/dev/wasm'), base, fetch})
    assert.deepEqual(found, {from: local, files: ['examples/calculator/calculator.wasm']})
    assert.equal(readFileSync(join(work, 'build/dev/wasm/examples/calculator/calculator.wasm'), 'utf8'), 'local wasm')
    assert.deepEqual(asked, [])
})

test('dev otherwise downloads the preview\'s wasm once, checked against its precache.json', async () => {
    const work = mkdtempSync(join(tmpdir(), 'webcpp-dev-'))
    const cache = join(work, 'build/dev/wasm')
    const precache = JSON.stringify({version: 'v', total: 14, files: [
        {path: 'examples/calculator/calculator.wasm', sha256: sha256('preview wasm'), size: 12},
        {path: 'index.html', sha256: sha256('<html>'), size: 6},
    ]})
    const {fetch, asked} = fakeFetch({
        [`${base}precache.json`]: precache,
        [`${base}examples/calculator/calculator.wasm`]: 'preview wasm',
    })
    const local = join(work, 'no bin/site')
    const found = await exampleWasm({local, cache, base, fetch})
    assert.deepEqual(found, {from: base, files: ['examples/calculator/calculator.wasm']})
    assert.equal(readFileSync(join(cache, 'examples/calculator/calculator.wasm'), 'utf8'), 'preview wasm')
    assert.deepEqual(asked, [`${base}precache.json`, `${base}examples/calculator/calculator.wasm`])
    // The second start finds the file with its hash, and downloads nothing but the list.
    asked.length = 0
    await exampleWasm({local, cache, base, fetch})
    assert.deepEqual(asked, [`${base}precache.json`])
})

test('dev refuses a downloaded wasm whose hash is not the one precache.json lists', async () => {
    const work = mkdtempSync(join(tmpdir(), 'webcpp-dev-'))
    const precache = JSON.stringify({version: 'v', total: 12, files: [
        {path: 'examples/calculator/calculator.wasm', sha256: sha256('the real wasm'), size: 13},
    ]})
    const {fetch} = fakeFetch({
        [`${base}precache.json`]: precache,
        [`${base}examples/calculator/calculator.wasm`]: 'a tampered wasm',
    })
    await assert.rejects(exampleWasm({local: join(work, 'none'), cache: join(work, 'cache'), base, fetch}),
        /examples\/calculator\/calculator\.wasm: its SHA-256 is [0-9a-f]{64}, and precache\.json lists [0-9a-f]{64}/)
})
