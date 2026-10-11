// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// What b2 site asks of the build script beyond the pages: the docs header, with its links from
// the site's root, which assemble.py moves to each page it heads; a social card for every
// library's page, which the site does not render; and the indexing files, which --index writes
// into a site laid out whole.

import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import {base, catalogue, site} from './site.mjs'

const build = join(site, 'tools/build.mjs')

/** A PNG's width and height, from its IHDR chunk. */
function size(file) {
    const png = readFileSync(file)
    return [png.readUInt32BE(16), png.readUInt32BE(20)]
}

test('--render --chrome writes the docs header, its links from the site\'s root, a card per library and the icons', () => {
    const work = mkdtempSync(join(tmpdir(), 'webcpp-build-'))
    const context = join(work, 'context.json')
    writeFileSync(context, JSON.stringify({
        channel: 'preview', commit: '0123456789abcdef0123456789abcdef01234567', date: '2026-10-10',
        version: null, catalogue,
    }))
    const out = join(work, 'pages')
    const chrome = join(work, 'docs-header.html')
    execFileSync(process.execPath, [build, '--render', '--pages', join(site, 'pages'), '--out', out,
        '--context', context, '--chrome', chrome], {stdio: 'inherit'})
    const header = readFileSync(chrome, 'utf8')
    assert.match(header, /^<header class="site"><a class="logo" href="\.\/"><picture><img src="assets\/logo\.svg"/)
    assert.match(header, /<a href="libraries\/">Libraries<\/a>/)
    assert.match(header, /<p class="band">Preview of main at <code>0123456<\/code>, 2026-10-10<\/p>$/)
    assert.doesNotMatch(header, /aria-current/)
    for (const library of catalogue) {
        assert.deepEqual(size(join(out, `cards/${library.page.replace(/\/$/, '')}.png`)), [1200, 630], library.key)
    }
    assert.deepEqual(size(join(out, 'assets/icons/icon-accent-512.png')), [512, 512])
    assert.deepEqual(size(join(out, 'assets/icons/apple-touch-icon.png')), [180, 180])
    assert.ok(existsSync(join(out, 'favicon.ico')))
})

test('--index writes robots.txt, sitemap.xml, llms.txt and libraries.json into a laid-out site', () => {
    const work = mkdtempSync(join(tmpdir(), 'webcpp-build-'))
    const out = join(work, 'site')
    mkdirSync(out)
    writeFileSync(join(out, 'index.html'), '<title>webcpp</title>\n<meta name="description" content="C++ for the web.">\n')
    execFileSync(process.execPath, [build, '--index', out, '--base', base, '--catalogue',
        join(site, 'test/fixtures/catalogue.json')], {stdio: 'inherit'})
    for (const file of ['robots.txt', 'sitemap.xml', 'llms.txt', 'libraries.json']) {
        assert.ok(existsSync(join(out, file)), file)
    }
    assert.match(readFileSync(join(out, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/webcpporg\.github\.io\/<\/loc>/)
})

test('--index without --base or --catalogue is a usage error', () => {
    assert.throws(() => execFileSync(process.execPath, [build, '--index', tmpdir()], {stdio: 'pipe'}),
        error => error.status === 2 && /--index needs --base and --catalogue/.test(error.stderr.toString()))
})
