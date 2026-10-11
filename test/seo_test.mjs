// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import test from 'node:test'
import {base, catalogue, decode, graphOf, pageAt, pages, renderSite, site} from './site.mjs'

const out = renderSite()
const queries = JSON.parse(readFileSync(join(site, 'seo/queries.json'), 'utf8'))

/** The words a query is matched without: articles and prepositions. */
const short = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'from', 'with', 'by'])

/** What a search engine reads first on a page: its title, its `<h1>` and its description. */
function headline(html) {
    const title = html.match(/<title>([^<]*)<\/title>/)[1]
    const h1 = html.match(/<h1>([^<]*)<\/h1>/)[1]
    const description = html.match(/<meta name="description" content="([^"]*)">/)[1]
    return decode(`${title}\n${h1}\n${description}`).toLowerCase()
}

test("seo/queries.json holds the spec's first set of queries, each with a page of the site", () => {
    const first = [
        'C++ for the web', 'C++ in the browser', 'C++ WebAssembly libraries',
        'Emscripten C++ library', 'WASI C++', 'C++ wasmtime', 'WebAssembly containers C++',
        'header-only C++20 libraries',
        'C++ WebRTC', 'C++ peer to peer browser',
        'C++ state machine XState',
        'C++ Pratt parser',
        'use C++ from JavaScript', 'call JavaScript from C++',
    ]
    const asked = queries.map(entry => entry.query)
    for (const query of first) {
        assert.ok(asked.includes(query), query)
    }
    const paths = new Set(pages.map(page => page.path))
    for (const {query, page} of queries) {
        assert.ok(paths.has(page), `${query}: ${page} is not a page of pages/`)
    }
})

test("each query's words are in its page's title, h1 or description", () => {
    for (const {query, page} of queries) {
        const text = headline(pageAt(out, page))
        for (const word of query.toLowerCase().split(/\s+/).filter(word => !short.has(word))) {
            assert.ok(text.includes(word), `"${query}": ${page || 'the home'} never says "${word}"`)
        }
    }
})

test('every page has its head: limits, canonical, one h1, and a social card of 1200 by 630', () => {
    for (const {path} of pages) {
        const html = pageAt(out, path)
        assert.ok(html.match(/<title>([^<]*)<\/title>/)[1].length <= 60, path)
        assert.match(html, /<meta name="description" content="[^"]{120,160}">/, path)
        assert.ok(html.includes(`<link rel="canonical" href="${base}${path}">`), path)
        assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, path)
        const card = html.match(/<meta property="og:image" content="([^"]+)">/)[1]
        assert.equal(card, `${base}cards/${path.replace(/\/$/, '') || 'home'}.png`, path)
        const png = readFileSync(join(out, card.slice(base.length)))
        assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${card} is a PNG`)
        assert.equal(png.toString('latin1', 12, 16), 'IHDR')
        assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], card)
    }
})

test('the libraries page describes every library as SoftwareSourceCode in an ItemList', () => {
    const list = graphOf(pageAt(out, 'libraries/')).filter(node => node['@type'] === 'ItemList')
    assert.equal(list.length, 1)
    const items = list[0].itemListElement
    assert.equal(items.length, catalogue.length)
    const platforms = {
        trystero: ['WebAssembly', 'Emscripten', 'native'],
        xactor: ['WebAssembly', 'WASI 0.2', 'WASI 0.3', 'native'],
    }
    items.forEach((element, i) => {
        const library = catalogue[i]
        assert.equal(element['@type'], 'ListItem')
        assert.equal(element.position, i + 1)
        const code = element.item
        assert.equal(code['@type'], 'SoftwareSourceCode')
        assert.equal(code.name, library.name)
        assert.equal(code.url, base + library.page)
        assert.equal(code.programmingLanguage, 'C++')
        assert.equal(code.codeRepository, library.repository)
        assert.equal(code.license, 'https://www.boost.org/LICENSE_1_0.txt')
        assert.deepEqual(code.runtimePlatform, platforms[library.key])
        assert.equal(code.isBasedOn?.url, library.port_of?.url)
    })
})

test('every other page keeps the four nodes of the site', () => {
    for (const {path} of pages.filter(page => page.path !== 'libraries/')) {
        assert.deepEqual(graphOf(pageAt(out, path)).map(node => node['@type']).sort(),
            ['BreadcrumbList', 'Organization', 'WebPage', 'WebSite'], path)
    }
})
