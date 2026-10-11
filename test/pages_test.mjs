// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import test from 'node:test'
import {renderPage} from '../build/server.mjs'
import {catalogue, decode, pageAt, pages, renderSite, site} from './site.mjs'

const out = renderSite()

test('the site has its eight pages', () => {
    assert.deepEqual(pages.map(page => page.path).sort(),
        ['', 'ai/', 'community/', 'cpp/', 'examples/', 'javascript/', 'libraries/', 'search/'])
})

test('every page has a title and a description', () => {
    for (const {path} of pages) {
        const html = pageAt(out, path)
        assert.match(html, /<title>[^<]+<\/title>/, path)
        assert.match(html, /<meta name="description" content="[^"]+">/, path)
    }
})

test('every page of a preview build carries noindex, the preview being the development version alone', () => {
    for (const {path} of pages) {
        assert.ok(pageAt(out, path).includes('<meta name="robots" content="noindex">'), path || 'the home')
    }
})

test("every page's header links to the libraries and the three doors, relative to the page", () => {
    for (const {path} of pages) {
        const header = pageAt(out, path).match(/<header class="site">[\s\S]*?<\/header>/)[0]
        const root = '../'.repeat(path.split('/').filter(Boolean).length)
        for (const target of ['libraries/', 'cpp/', 'javascript/', 'ai/']) {
            assert.ok(header.includes(`href="${root}${target}"`), `${path || 'the home'} links to ${target}`)
        }
    }
})

test('the home says where C++ and the web meet, and opens the three doors', () => {
    const main = pageAt(out, '').match(/<main>[\s\S]*<\/main>/)[0]
    assert.match(main, /<h1>Where C\+\+ and the web meet<\/h1>/)
    for (const door of ['cpp/', 'javascript/', 'ai/', 'examples/']) {
        assert.ok(main.includes(`href="${door}"`), door)
    }
})

test('the libraries page has one row per library of the catalogue, each linked to its page', () => {
    const html = pageAt(out, 'libraries/')
    const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1]
    assert.equal(body.match(/<tr>/g).length, catalogue.length)
    for (const library of catalogue) {
        assert.ok(body.includes(`<a href="../${library.page}">${library.name}</a>`), library.key)
    }
})

test("the C++ door links the documentation's index and every library's page", () => {
    const html = pageAt(out, 'cpp/')
    assert.ok(html.includes('href="../docs/"'))
    for (const library of catalogue) {
        assert.ok(html.includes(`href="../${library.page}"`), library.key)
    }
})

test('the JavaScript door lists the libraries that build for emscripten, and only those', () => {
    const main = pageAt(out, 'javascript/').match(/<main>[\s\S]*<\/main>/)[0]
    for (const library of catalogue) {
        assert.equal(main.includes(`href="../${library.page}"`), library.targets.includes('emscripten'), library.key)
    }
})

test("the search page is a Google search restricted to the site", () => {
    const html = pageAt(out, 'search/')
    const form = html.match(/<form[^>]*>[\s\S]*?<\/form>/)[0]
    assert.match(form, /^<form[^>]* action="https:\/\/www\.google\.com\/search"/)
    assert.match(form, /<input type="hidden" name="q" value="site:webcpporg\.github\.io"\/?>/)
    assert.match(form, /<input[^>]* type="search"[^>]* name="q"/)
})

test("every page carries its OpenUI Lang, and its body holds nothing but the shell and OpenUI's tree", () => {
    for (const {file, path} of pages) {
        const html = pageAt(out, path)
        const source = readFileSync(join(site, 'pages', file), 'utf8')
        const carried = decode(html.match(/<script type="text\/openui" id="page-source">([\s\S]*?)<\/script>/)[1])
        assert.equal(carried, source, file)
        // The shell is these four elements, in this order, and nothing else.
        const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
        assert.match(body, /^\n<noscript>[^<]*<\/noscript>\n<div id="root">[\s\S]*<\/div>\n<script type="text\/openui" id="page-source">[^<]*<\/script>\n<script type="application\/json" id="site-context">[^<]*<\/script>\n$/, file)
        // What #root holds is what OpenUI renders from the carried source and context, as the
        // browser hydrates it; and no string of the source holds a tag, which React would show
        // as text: a page's markup is its components'. `<name>` in a command is text.
        const context = JSON.parse(html.match(/<script type="application\/json" id="site-context">([^<]*)<\/script>/)[1])
        const rendered = renderPage(file, carried, context)
        const tree = text => text.slice(text.indexOf('<div id="root">'), text.indexOf('<script type="text/openui"'))
        assert.equal(tree(html), tree(rendered), file)
        for (const string of source.match(/"(?:[^"\\]|\\.)*"/g) ?? []) {
            assert.doesNotMatch(string, /<\/?(a|b|i|em|strong|br|p|div|span|code|pre|ul|ol|li|img|h[1-6]|table|script|style)\b[^>]*>/i, `${file}: ${string}`)
        }
    }
})
