// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {renderFragment, renderPage, PageError} from '../build/server.mjs'

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

test("the header, the band and the footer are OpenUI's, inside #root, and the docs header is the same", () => {
    const html = renderPage('pages/index.oui', page, context)
    const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('<script type="text/openui"'))
    assert.match(root, /<header class="site">[\s\S]*<p class="band">[\s\S]*<main>[\s\S]*<\/main><footer class="site">/)
    assert.equal(html.split('<header class="site">').length, 2)
    assert.ok(root.includes(renderFragment('docs-header', context)))
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

// Every host a URL in a bundle may name, and why it is there; none is fetched but the site's own.
const hosts = new Map([
    ['webcpporg.github.io', "the preview's base: canonical URLs, cards, JSON-LD"],
    ['webcpp.org', "the release's base"],
    ['github.com', "webcpp's organization and source, in JSON-LD and the footer"],
    ['www.boost.org', 'the licence, linked from the footer'],
    ['schema.org', 'the JSON-LD @context'],
    ['json-schema.org', 'the $schema of the JSON Schema zod writes for OpenUI'],
    ['www.w3.org', 'the SVG and MathML namespaces react-dom names'],
    ['react.dev', 'the page a minified React error points to'],
    ['zod.dev', 'the page an OpenUI error about zod versions points to'],
    ['example.com', 'an example in the prompt text OpenUI can write for a model'],
])

test('both bundles are production: no devtools widget, no CDN, no analytics', () => {
    for (const file of ['../build/server.mjs', '../build/client/site.js']) {
        const bundle = readFileSync(new URL(file, import.meta.url), 'utf8')
        assert.doesNotMatch(bundle, /@openuidev\/devtools/, file)
        assert.doesNotMatch(bundle, /https:\/\/(cdn|unpkg|esm\.sh)/, file)
        assert.deepEqual(bundle.match(/posthog|phc_\w+/gi) ?? [], [], file)
        const named = new Set([...bundle.matchAll(/https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)].map(m => m[1].toLowerCase()))
        assert.deepEqual([...named].filter(host => !hosts.has(host)), [], file)
    }
})

test('a comment, with an apostrophe or a quote in it, leaves the lines of a fault right', () => {
    const source = `// The home's page
root = Page("x", "y", [a, b])
a = Text("z") # the "first" block
b = Nope("z")
`
    assert.throws(() => renderPage('pages/bad.oui', source, context),
        e => e instanceof PageError && e.line === 4 && /Nope/.test(e.message))
    assert.throws(() => renderPage('pages/bad.oui', source.replace('# the "first" block', '# a "Nope" here'), context),
        e => e instanceof PageError && e.line === 4 && /Nope/.test(e.message))
    assert.throws(() => renderPage('pages/bad.oui', '// c comes later\nroot = Page("x", "y", [c])\n', context),
        e => e instanceof PageError && e.line === 2 && /\bc\b/.test(e.message))
})
