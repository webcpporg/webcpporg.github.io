// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The dev script, for working on the site's pages and components without the superproject:
//
//   dev.mjs [port]
//
// builds the site's own pages with test/fixtures/catalogue.json and a fixed context into a fresh
// directory under build/dev/builds/ each time, serves them through build/dev/site, a symlink
// (a junction on Windows) swapped onto the new one with one rename (pointTo), on 127.0.0.1, by
// default on port 8765, and builds them again on a change under pages/, src/ or assets/; a build
// that fails is reported and the last good one stays served. Swapping a link, never the directory
// itself, means a request already resolving the old one keeps reading it, whichever of build()'s
// steps a swap in progress is at (test/dev_test.mjs fires one at each); the previous build is
// removed only once the swap itself has succeeded. The examples' wasm is served from build/dev/wasm/:
// copied from the superproject's bin/site/ when its b2 site built some, else downloaded once from
// the published preview and checked against the preview's precache.json. That download is the one
// access to the network outside `npm ci`, and it happens only here, never in a build or a test;
// without the network the pages are still served, without the examples' wasm.

import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync, realpathSync, watch} from 'node:fs'
import {cp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises'
import {dirname, join, relative, resolve, sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {defaultPort, host, serve} from './serve.mjs'
import {pointTo} from './swap.mjs'

export {pointTo}

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Where the published preview serves the site, and its precache.json. */
export const preview = 'https://webcpporg.github.io/'

/** What the pages are built with: the fixture catalogue, on the preview channel. */
const context = {
    channel: 'preview',
    commit: '0'.repeat(40),
    date: '2026-01-01',
    version: null,
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

/** Every `.wasm` file under `directory`, as paths relative to it with `/`, sorted; none when it does not exist. */
async function wasmUnder(directory) {
    const entries = await readdir(directory, {recursive: true, withFileTypes: true}).catch(() => [])
    return entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.wasm'))
        .map(entry => relative(directory, join(entry.parentPath, entry.name)).split(sep).join('/'))
        .sort()
}

/** Whether `path`, from precache.json, names a file under the site's root: relative, without `..`. */
function inside(path) {
    return typeof path === 'string' && path !== '' && !path.startsWith('/') && !path.includes('\\') &&
        path.split('/').every(part => part !== '' && part !== '.' && part !== '..')
}

/**
 * The examples' wasm, gathered into `cache`: copied from `local`, the superproject's bin/site/,
 * when it holds some, else each `.wasm` the preview at `base` lists in its precache.json, fetched
 * with `fetch` unless `cache` holds it already with the listed SHA-256. Returns where they came
 * from and their paths. A download whose SHA-256 is not the one listed is refused, named, and
 * never written.
 */
export async function exampleWasm({local, cache, base = preview, fetch = globalThis.fetch}) {
    const built = await wasmUnder(local)
    if (built.length > 0) {
        await rm(cache, {recursive: true, force: true})
        for (const path of built) {
            await mkdir(dirname(join(cache, path)), {recursive: true})
            await cp(join(local, path), join(cache, path))
        }
        return {from: local, files: built}
    }
    const list = await fetch(`${base}precache.json`)
    if (!list.ok) {
        throw new Error(`${base}precache.json: HTTP ${list.status}`)
    }
    const entries = ((await list.json()).files ?? []).filter(entry => entry.path?.endsWith('.wasm'))
    const files = []
    for (const {path, sha256: listed} of entries) {
        if (!inside(path)) {
            throw new Error(`${base}precache.json lists ${JSON.stringify(path)}, which is not a path under the site`)
        }
        const file = join(cache, path)
        if (existsSync(file) && sha256(await readFile(file)) === listed) {
            files.push(path)
            continue
        }
        const answer = await fetch(base + path)
        if (!answer.ok) {
            throw new Error(`${base}${path}: HTTP ${answer.status}`)
        }
        const bytes = Buffer.from(await answer.arrayBuffer())
        const hash = sha256(bytes)
        if (hash !== listed) {
            throw new Error(`${path}: its SHA-256 is ${hash}, and precache.json lists ${listed}`)
        }
        await mkdir(dirname(file), {recursive: true})
        await writeFile(file, bytes)
        files.push(path)
    }
    return {from: base, files}
}

let builds = 0

/**
 * Builds the pages into a fresh directory under dev/builds/, then swaps the link `out` onto it
 * (pointTo) and removes the directory the swap moved it away from, so a failed build leaves the
 * link as it was and a reader is never served half of a new one. `hook(step)` runs after each
 * step ('built', the pages are there but out still reads the last build; 'linked', out already
 * reads this one; 'cleaned', the last build is gone), for a test to fire a request in the gap it
 * names; it does nothing by default.
 */
export async function build(dev, out, hook = () => {}) {
    const builtInto = join(dev, 'builds', `${Date.now()}-${process.pid}-${builds++}`)
    const contextFile = join(dev, 'context.json')
    const catalogue = JSON.parse(await readFile(join(site, 'test/fixtures/catalogue.json'), 'utf8'))
    await writeFile(contextFile, JSON.stringify({...context, catalogue}))
    await mkdir(dirname(builtInto), {recursive: true})
    execFileSync(process.execPath, [join(site, 'tools/build.mjs'), '--bundle', '--render', '--pages',
        join(site, 'pages'), '--out', builtInto, '--context', contextFile], {stdio: 'inherit'})
    await hook('built')
    const previous = await pointTo(out, builtInto)
    await hook('linked')
    if (previous) {
        await rm(previous, {recursive: true, force: true})
    }
    await hook('cleaned')
}

async function main() {
    const port = process.argv[2] ?? String(defaultPort)
    if (!/^\d+$/.test(port)) {
        console.error('usage: dev.mjs [port]')
        process.exit(2)
    }
    const dev = join(site, 'build/dev')
    const out = join(dev, 'site')
    const cache = join(dev, 'wasm')
    await mkdir(dev, {recursive: true})
    await build(dev, out)
    try {
        const {from, files} = await exampleWasm({local: resolve(site, '../bin/site'), cache})
        console.log(files.length > 0 ? `The examples' wasm, from ${from}: ${files.join(', ')}` : 'No example has wasm yet')
    } catch (error) {
        console.warn(`dev.mjs: the examples' wasm is not served: ${error.message}`)
    }
    await serve({roots: [out, cache], port: Number(port)})
    console.log(`Serving the site's pages at http://${host}:${port}/, built again on a change under pages/, src/ or assets/`)

    let building = false
    let again = false
    let timer = null
    const rebuild = async () => {
        if (building) {
            again = true
            return
        }
        building = true
        try {
            await build(dev, out)
            console.log('Built again')
        } catch {
            console.error('dev.mjs: the build failed; the last one is still served')
        }
        building = false
        if (again) {
            again = false
            await rebuild()
        }
    }
    for (const directory of ['pages', 'src', 'assets']) {
        watch(join(site, directory), {recursive: true}, () => {
            clearTimeout(timer)
            timer = setTimeout(rebuild, 150)
        })
    }
}

// node resolves this module's own path through links, and argv[1] keeps them: compared as real
// paths, a script started through a path that holds a link (a checkout under /var on macOS) runs.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main()
}
