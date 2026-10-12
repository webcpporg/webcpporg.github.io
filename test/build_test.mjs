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
import {execFileSync, spawnSync} from 'node:child_process'
import {closeSync, existsSync, fstatSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync,
    readSync, statSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import test from 'node:test'
import {base, catalogue, site} from './site.mjs'

const build = join(site, 'tools/build.mjs')

/** A PNG's width and height, from its IHDR chunk. */
function size(file) {
    const png = readFileSync(file)
    return [png.readUInt32BE(16), png.readUInt32BE(20)]
}

/** Every byte of the file open as `fd`, read from its start whatever was read before. */
function whole(fd) {
    const bytes = Buffer.alloc(fstatSync(fd).size)
    readSync(fd, bytes, 0, bytes.length, 0)
    return bytes
}

test('--render --chrome --site-chrome writes the docs header and the site header, their links from the site\'s root, a card per library and the icons', () => {
    const work = mkdtempSync(join(tmpdir(), 'webcpp-build-'))
    const context = join(work, 'context.json')
    writeFileSync(context, JSON.stringify({
        channel: 'preview', commit: '0123456789abcdef0123456789abcdef01234567', date: '2026-10-10',
        version: null, catalogue,
    }))
    const out = join(work, 'pages')
    const chrome = join(work, 'docs-header.html')
    const siteChrome = join(work, 'site-header.html')
    execFileSync(process.execPath, [build, '--render', '--pages', join(site, 'pages'), '--out', out,
        '--context', context, '--chrome', chrome, '--site-chrome', siteChrome], {stdio: 'inherit'})
    const siteHeader = readFileSync(siteChrome, 'utf8')
    assert.match(siteHeader, /^<header class="site"><a class="logo" href="\.\/"><picture><img src="assets\/logo\.svg"/)
    assert.match(siteHeader, /<p class="band">Preview of main at <code>0123456<\/code>, 2026-10-10<\/p>$/)
    const header = readFileSync(chrome, 'utf8')
    assert.match(header, /^<header class="site"><a class="logo" href="\.\/"><picture><img src="assets\/logo-light\.svg"/)
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

test('--bundle replaces each bundle whole, by one rename, so a reader never sees one empty or half written', t => {
    // The bug this proves fixed: esbuild wrote build/server.mjs in place, truncating it first, so
    // render_test.mjs, importing it while dev_test.mjs's rebuild bundled again in the same npm
    // test, once read it empty and failed in CI with "does not provide an export named 'Mark'".
    // Each bundle is held open across --bundle, as a reader holds it: the path must then name
    // another file, and the one held must still read whole, as it was. The file is held, not its
    // inode only noted, because dev_test.mjs bundles in the same npm test: its rename frees the
    // inode, ext4 gives it to the next file created, and a bundle renamed onto the path then had
    // the inode noted before (CI run 38189325411). That bundle's own `.next` file may be there
    // too, so only this --bundle's are looked for.
    const bundles = ['build/server.mjs', 'build/client/site.js'].map(file => join(site, file))
    const held = new Map(bundles.map(file => {
        const fd = openSync(file, 'r')
        return [file, {fd, contents: whole(fd)}]
    }))
    t.after(() => held.forEach(({fd}) => closeSync(fd)))
    const {pid, status} = spawnSync(process.execPath, [build, '--bundle'], {stdio: 'inherit'})
    assert.equal(status, 0)
    for (const file of bundles) {
        const {fd, contents} = held.get(file)
        assert.notEqual(statSync(file).ino, fstatSync(fd).ino, `${file} is a new file`)
        assert.deepEqual(whole(fd), contents, `${file} as it was still reads whole`)
        assert.deepEqual(readdirSync(dirname(file)).filter(entry => entry.endsWith(`.${pid}.next`)), [],
            `no file being written is left beside ${file}`)
    }
    assert.match(readFileSync(bundles[0], 'utf8'), /^export \{\n {2}Mark,$/m)
})

test("the client bundle carries the mark's drawing alone, never logo.svg's comments and licence", () => {
    const bundle = readFileSync(join(site, 'build/client/site.js'), 'utf8')
    assert.ok(bundle.includes('clip-path=\\"url(#angles)\\"') || bundle.includes('clip-path="url(#angles)"'), 'the drawing is there')
    assert.ok(!bundle.includes("webcpp's mark, as the owner chose it"), 'logo.svg\'s comment is not')
})

for (const [channel, files, absent] of [
    ['release', ['robots.txt', 'sitemap.xml', 'llms.txt', 'libraries.json'], []],
    ['preview', ['robots.txt', 'llms.txt', 'libraries.json'], ['sitemap.xml']],
]) {
    test(`--index --channel ${channel} writes ${files.join(', ')} into a laid-out site${absent.length ? `, and no ${absent.join(', ')}` : ''}`, () => {
        const work = mkdtempSync(join(tmpdir(), 'webcpp-build-'))
        const out = join(work, 'site')
        mkdirSync(out)
        writeFileSync(join(out, 'index.html'), '<title>webcpp</title>\n<meta name="description" content="C++ for the web.">\n')
        execFileSync(process.execPath, [build, '--index', out, '--base', base, '--catalogue',
            join(site, 'test/fixtures/catalogue.json'), '--channel', channel], {stdio: 'inherit'})
        for (const file of files) {
            assert.ok(existsSync(join(out, file)), file)
        }
        for (const file of absent) {
            assert.ok(!existsSync(join(out, file)), file)
        }
        assert.match(readFileSync(join(out, 'llms.txt'), 'utf8'), /\(https:\/\/webcpporg\.github\.io\/\)/)
    })
}

test('--index without --base, --catalogue or --channel is a usage error', () => {
    assert.throws(() => execFileSync(process.execPath, [build, '--index', tmpdir()], {stdio: 'pipe'}),
        error => error.status === 2 && /--index needs --base, --catalogue and --channel/.test(error.stderr.toString()))
})
