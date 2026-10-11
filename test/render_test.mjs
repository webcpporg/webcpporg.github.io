// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {renderPage, PageError} from '../build/server.mjs'

const context = {
    channel: 'preview', commit: '0123456789abcdef0123456789abcdef01234567', date: '2026-10-10',
    version: null, root: '', path: '',
    catalogue: [{
        key: 'pratt', name: 'pratt', description: 'A Pratt parser engine.', category: ['Parsing'],
        targets: ['emscripten', 'native', 'wasip2', 'wasip3'], port_of: null,
        page: 'libs/pratt/', repository: 'https://github.com/webcpporg/pratt',
    }],
}
const page = `root = Page("Home", "Header-only C++20 libraries for the web: compiled to WebAssembly for the browser with Emscripten, to WASI for servers, or natively.", [hero, table])
hero = Hero("Where C++ and the web meet", "C++ libraries for the web.", [docs])
docs = Link("The libraries", "libraries/")
table = LibraryTable()
`

test('a page is a shell that carries its OpenUI Lang and the tree OpenUI rendered', () => {
    const html = renderPage('pages/index.oui', page, context)
    assert.match(html, /^<!doctype html>/)
    assert.ok(html.includes('<script type="text/openui" id="page-source">'))
    assert.ok(html.includes('hero = Hero("Where C++ and the web meet"'))
    assert.match(html, /<div id="root"><[^>]+>[\s\S]*<h1[^>]*>Where C\+\+ and the web meet<\/h1>/)
    assert.match(html, /<a href="libraries\/">The libraries<\/a>/)
    assert.match(html, />pratt<\/a>/)
    assert.match(html, /webcpp's own/)
    assert.match(html, /<script type="module" src="assets\/site\.js"><\/script>/)
    assert.match(html, /<noscript>[^<]*needs JavaScript[^<]*<\/noscript>/)
})

test('the page source in the shell cannot close its script element', () => {
    const tricky = 'root = Page("x", "</script><b> Header-only C++20 libraries for the web: compiled to WebAssembly for the browser with Emscripten, to WASI for servers, o", [])\n'
    const html = renderPage('pages/x.oui', tricky, context)
    assert.equal(html.split('</script>').length - 1, html.match(/<script/g).length)
})

test('the head carries every SEO tag the spec names', () => {
    const html = renderPage('pages/index.oui', page, context)
    for (const tag of [
        /<title>[^<]{1,60}<\/title>/, /<meta name="description" content="[^"]{120,160}">/,
        /<link rel="canonical" href="https:\/\/webcpporg\.github\.io\/">/,
        /<meta name="robots" content="index, follow">/, /<html lang="en"/,
        /<meta property="og:title"/, /<meta property="og:description"/, /<meta property="og:url"/,
        /<meta property="og:type"/, /<meta property="og:site_name" content="webcpp">/,
        /<meta property="og:image" content="https:\/\/[^"]+\.png">/, /<meta property="og:image:alt"/,
        /<meta name="twitter:card" content="summary_large_image">/,
        /<script type="application\/ld\+json">/]) {
        assert.match(html, tag)
    }
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]*)<\/script>/)[1])['@graph']
    assert.deepEqual(graph.map(n => n['@type']).sort(), ['BreadcrumbList', 'Organization', 'WebPage', 'WebSite'])
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1)
})

test('a description outside 120 to 160 characters fails with its file', () => {
    assert.throws(() => renderPage('pages/short.oui', 'root = Page("x", "Too short.", [])\n', context),
        e => e instanceof PageError && e.file === 'pages/short.oui' && /description/.test(e.message))
})

test('the preview band names the commit and its date', () => {
    const html = renderPage('pages/index.oui', page, context)
    assert.match(html, /Preview of main at <code>0123456<\/code>, 2026-10-10/)
})

test('a page that names an unknown component fails with its file and line', () => {
    assert.throws(() => renderPage('pages/bad.oui', 'root = Page("x", "y", [a])\na = Nope("z")\n', context),
        e => e instanceof PageError && e.file === 'pages/bad.oui' && e.line === 2 && /Nope/.test(e.message))
})

test('a link from the server root is refused', () => {
    assert.throws(() => renderPage('pages/x.oui', 'root = Page("x", "y", [l])\nl = Link("a", "/libraries/")\n', context),
        e => e instanceof PageError && /relative/.test(e.message))
})

test('both bundles are production: no devtools widget, no CDN', () => {
    for (const file of ['../build/server.mjs', '../build/client/site.js']) {
        const bundle = readFileSync(new URL(file, import.meta.url), 'utf8')
        assert.doesNotMatch(bundle, /@openuidev\/devtools/, file)
        assert.doesNotMatch(bundle, /https:\/\/(cdn|unpkg|esm\.sh)/, file)
    }
})
