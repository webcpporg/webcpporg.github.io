// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {createElement, Fragment} from 'react'
import {renderToString} from 'react-dom/server'
import {Mark, renderFragment, renderPage, PageError} from '../build/server.mjs'

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
    // The chrome's tokens first, which site.css turns dark.
    assert.match(html, /<link rel="stylesheet" href="assets\/chrome\.css">\n<link rel="stylesheet" href="assets\/site\.css">/)
    assert.match(html, /<noscript>[^<]*needs JavaScript[^<]*<\/noscript>/)
})

test("the header, the band and the footer are OpenUI's, inside #root, and the docs header is the same but for its light mark", () => {
    const html = renderPage('pages/index.oui', page, context)
    const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('<script type="text/openui"'))
    assert.match(root, /<header class="site">[\s\S]*<p class="band">[\s\S]*<main>[\s\S]*<\/main><footer class="site">/)
    assert.equal(html.split('<header class="site">').length, 2)
    const docs = renderFragment('docs-header', context)
    // The libraries' pages are light alone, so their header draws the mark in light colours alone,
    // never through the theme's media query, which an image follows as its browser decides.
    assert.ok(docs.includes('<img src="assets/logo-light.svg"'), docs)
    assert.ok(root.includes('<img src="assets/logo.svg"'))
    assert.ok(root.includes(docs.replace('assets/logo-light.svg', 'assets/logo.svg')))
})

test("the site header, for a page of the site's own that b2 site heads (the report's), is a Page's, its mark the theme's", () => {
    const html = renderPage('pages/index.oui', page, context)
    const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('<script type="text/openui"'))
    const header = renderFragment('site-header', context)
    assert.ok(header.includes('<img src="assets/logo.svg"'), header)
    assert.ok(!header.includes('logo-light'), header)
    assert.ok(root.includes(header))
})

test('the head links the favicon, its fallback and the Apple touch icon, from the site\'s root', () => {
    const html = renderPage('pages/libraries.oui', page, {...context, root: '../', path: 'libraries/'})
    assert.match(html, /<link rel="icon" href="\.\.\/favicon\.ico" sizes="32x32">\n<link rel="icon" href="\.\.\/assets\/logo\.svg" type="image\/svg\+xml">/)
    assert.match(html, /<link rel="apple-touch-icon" href="\.\.\/assets\/icons\/apple-touch-icon\.png">/)
})

test("the hero draws the mark inline, its clip paths' ids its own, and every reference to them resolves", () => {
    const html = renderPage('pages/index.oui', page, context)
    const mark = html.match(/<svg class="mark opening"[^>]*>[\s\S]*?<\/svg>/)?.[0]
    assert.ok(mark, 'the hero holds the mark')
    assert.match(mark, /aria-hidden="true"/)
    const ids = [...mark.matchAll(/ id="([^"]+)"/g)].map(found => found[1])
    assert.ok(ids.length >= 2)
    for (const id of ids) {
        assert.match(id, /^mark[\w-]+-(arms|angles)$/, `${id} carries the copy's prefix`)
    }
    for (const [, reference] of mark.matchAll(/url\(#([^)]+)\)/g)) {
        assert.ok(ids.includes(reference), `url(#${reference}) resolves`)
    }
    for (const part of ['arms', 'angles', 'globe']) {
        assert.match(mark, new RegExp(`class="[^"]*\\b${part}\\b`), part)
    }
    assert.doesNotMatch(mark, /<style|<title/)
})

test('two marks rendered together each clip with ids of their own, and every reference resolves within its copy', () => {
    const html = renderToString(createElement(Fragment, null,
        createElement(Mark, {className: 'mark'}), createElement(Mark, {className: 'mark'})))
    const marks = [...html.matchAll(/<svg class="mark"[^>]*>[\s\S]*?<\/svg>/g)].map(found => found[0])
    assert.equal(marks.length, 2)
    const ids = marks.map(mark => [...mark.matchAll(/ id="([^"]+)"/g)].map(found => found[1]))
    for (const [i, mark] of marks.entries()) {
        assert.ok(ids[i].length >= 2)
        for (const [, reference] of mark.matchAll(/url\(#([^)]+)\)/g)) {
            assert.ok(ids[i].includes(reference), `mark ${i}: url(#${reference}) resolves within it`)
        }
    }
    assert.deepEqual(ids[0].filter(id => ids[1].includes(id)), [], 'no id of one copy is the other\'s')
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
        /<html lang="en"/,
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

test('a preview page is not indexed: its one robots meta says noindex', () => {
    const html = renderPage('pages/index.oui', page, context)
    assert.deepEqual(html.match(/<meta name="robots" content="[^"]*">/g), ['<meta name="robots" content="noindex">'])
})

test('a release page is indexed and followed, never noindex', () => {
    const html = renderPage('pages/index.oui', page, {...context, channel: 'release', version: '1.2.3'})
    assert.deepEqual(html.match(/<meta name="robots" content="[^"]*">/g), ['<meta name="robots" content="index, follow">'])
    assert.doesNotMatch(html, /noindex/)
})

test('a description outside 120 to 160 characters fails with its file', () => {
    assert.throws(() => renderPage('pages/short.oui', 'root = Page("x", "Too short.", [])\n', context),
        e => e instanceof PageError && e.file === 'pages/short.oui' && /description/.test(e.message))
})

test('the preview band names the commit and its date', () => {
    const html = renderPage('pages/index.oui', page, context)
    assert.match(html, /Preview of main at <code>0123456<\/code>, 2026-10-10/)
})

test('the release band names the version, with no commit', () => {
    const release = {...context, channel: 'release', version: '1.2.3'}
    const html = renderPage('pages/index.oui', page, release)
    assert.match(html, /<p class="band">webcpp 1\.2\.3<\/p>/)
})

test("the release's canonical URL is the release's own base", () => {
    const release = {...context, channel: 'release', version: '1.2.3', path: 'libraries/', root: '../'}
    const html = renderPage('pages/libraries.oui', page, release)
    assert.match(html, /<link rel="canonical" href="https:\/\/webcpp\.org\/libraries\/">/)
    assert.match(html, /<meta property="og:url" content="https:\/\/webcpp\.org\/libraries\/">/)
})

test('a preview build carries no version', () => {
    assert.throws(() => renderPage('pages/index.oui', page, {...context, version: '1.2.3'}),
        e => e instanceof PageError && e.file === 'pages/index.oui' && /preview/.test(e.message) && /version/.test(e.message))
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
    ['www.google.com', "the search page's form, a Google search restricted to the site"],
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
