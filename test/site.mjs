// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// What the page tests share: the site's pages rendered, as the build's --render step renders
// them, with a fixed context and the catalogue of test/fixtures/, into a directory of their own.

import {execFileSync} from 'node:child_process'
import {mkdtempSync, readdirSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'

export const site = fileURLToPath(new URL('..', import.meta.url))
export const catalogue = JSON.parse(readFileSync(join(site, 'test/fixtures/catalogue.json'), 'utf8'))
export const base = 'https://webcpporg.github.io/'

/** Every page of `pages/`, as its file and its path from the site's root (`""`, `"libraries/"`). */
export const pages = readdirSync(join(site, 'pages'), {recursive: true, withFileTypes: true})
    .filter(entry => entry.isFile() && entry.name.endsWith('.oui'))
    .map(entry => relative(join(site, 'pages'), join(entry.parentPath, entry.name)).split('\\').join('/'))
    .sort()
    .map(file => {
        const name = file.replace(/\.oui$/, '')
        return {file, path: name === 'index' ? '' : name.replace(/\/index$/, '') + '/'}
    })

/** Renders the site's pages into a new directory and returns it. */
export function renderSite() {
    const work = mkdtempSync(join(tmpdir(), 'webcpp-site-'))
    const context = join(work, 'context.json')
    writeFileSync(context, JSON.stringify({
        channel: 'preview', commit: '0123456789abcdef0123456789abcdef01234567', date: '2026-10-10',
        version: null, catalogue,
    }))
    const out = join(work, 'out')
    execFileSync(process.execPath, [join(site, 'tools/build.mjs'), '--render', '--pages', join(site, 'pages'),
        '--out', out, '--context', context], {stdio: 'inherit'})
    return out
}

/** The HTML of the page at `path` under `out`. */
export function pageAt(out, path) {
    return readFileSync(join(out, path, 'index.html'), 'utf8')
}

/** The text of an element's content or an attribute, its entities read back. */
export function decode(text) {
    return text.replace(/&(lt|gt|quot|#x27|#39|amp);/g, (_, name) =>
        ({lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'", amp: '&'})[name])
}

/** The page's `@graph` of JSON-LD. */
export function graphOf(html) {
    return JSON.parse(html.match(/<script type="application\/ld\+json">([^<]*)<\/script>/)[1])['@graph']
}
