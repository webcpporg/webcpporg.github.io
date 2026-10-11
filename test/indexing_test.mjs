// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import assert from 'node:assert/strict'
import {execFileSync, spawnSync} from 'node:child_process'
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import {base, catalogue, site} from './site.mjs'

const indexing = join(site, 'tools/indexing.mjs')
const catalogueFile = join(site, 'test/fixtures/catalogue.json')

/** A site of three pages, the home, the C++ door and a library's page, as `b2 site` lays them out. */
function fakeSite() {
    const out = mkdtempSync(join(tmpdir(), 'webcpp-indexing-'))
    const pages = [
        ['', 'C++ for the web - webcpp', 'The home &amp; its description.'],
        ['cpp/', 'C++ for WebAssembly - webcpp', "The C++ door's description."],
        ['libs/trystero/', 'trystero: Serverless WebRTC rooms - webcpp', 'Serverless WebRTC rooms.'],
    ]
    for (const [path, title, description] of pages) {
        mkdirSync(join(out, path), {recursive: true})
        writeFileSync(join(out, path, 'index.html'),
            `<!doctype html>\n<html lang="en">\n<head>\n<title>${title}</title>\n<meta name="description" content="${description}">\n</head>\n<body></body>\n</html>\n`)
    }
    return out
}

function run(out, ...more) {
    return spawnSync(process.execPath, [indexing, '--site', out, '--base', base, '--catalogue', catalogueFile, ...more],
        {encoding: 'utf8'})
}

/** The date of the last commit that changed `file` in the repository `directory`, or ''. */
function committed(directory, file) {
    return execFileSync('git', ['-C', directory, 'log', '-1', '--format=%cs', '--', file], {encoding: 'utf8'}).trim()
}

test('robots.txt allows every crawler, Google-Extended by name, and names the sitemap', () => {
    const out = fakeSite()
    assert.equal(run(out).status, 0)
    assert.equal(readFileSync(join(out, 'robots.txt'), 'utf8'),
        `User-agent: *\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nSitemap: ${base}sitemap.xml\n`)
})

test('sitemap.xml lists every page under the base, sorted, each with the date its source last changed', () => {
    const out = fakeSite()
    assert.equal(run(out).status, 0)
    const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8')
    assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\n/)
    const urls = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)]
    assert.deepEqual(urls.map(url => url[1]), [base, `${base}cpp/`, `${base}libs/trystero/`])
    // A page of the site's own has the date of its .oui; a page it does not render, none without --superproject.
    for (const [url, file] of [[urls[0], 'pages/index.oui'], [urls[1], 'pages/cpp.oui']]) {
        assert.equal(url[2] ?? '', committed(site, file), file)
    }
    assert.equal(urls[2][2], undefined)
})

test("with --superproject, a library's page has the date of its repository's last commit", () => {
    const superproject = mkdtempSync(join(tmpdir(), 'webcpp-superproject-'))
    const library = join(superproject, 'libs/trystero')
    mkdirSync(library, {recursive: true})
    const git = (...args) => execFileSync('git', ['-C', library, ...args], {
        env: {...process.env, GIT_AUTHOR_DATE: '2026-01-02T03:04:05Z', GIT_COMMITTER_DATE: '2026-01-02T03:04:05Z'},
    })
    git('init', '-q')
    writeFileSync(join(library, 'README.md'), 'trystero\n')
    git('add', 'README.md')
    git('-c', 'commit.gpgsign=false', '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '-m', 'trystero')
    const out = fakeSite()
    assert.equal(run(out, '--superproject', superproject).status, 0)
    assert.ok(readFileSync(join(out, 'sitemap.xml'), 'utf8')
        .includes(`<url><loc>${base}libs/trystero/</loc><lastmod>2026-01-02</lastmod></url>`))
})

test('llms.txt says what webcpp is, then a line for every library and every other page', () => {
    const out = fakeSite()
    assert.equal(run(out).status, 0)
    const llms = readFileSync(join(out, 'llms.txt'), 'utf8')
    assert.match(llms, /^# webcpp\n\n> The home & its description\.\n/)
    const lines = llms.split('\n')
    for (const library of catalogue) {
        assert.ok(lines.includes(`- [${library.name}](${base}libs/${library.key}/): ${library.description}`), library.key)
    }
    assert.ok(lines.includes(`- [C++ for the web - webcpp](${base}): The home & its description.`))
    assert.ok(lines.includes(`- [C++ for WebAssembly - webcpp](${base}cpp/): The C++ door's description.`))
    assert.equal(lines.filter(line => line.includes(`${base}libs/trystero/`)).length, 1, "a library's page is listed once")
})

test('the catalogue is copied to libraries.json as it is', () => {
    const out = fakeSite()
    assert.equal(run(out).status, 0)
    assert.equal(readFileSync(join(out, 'libraries.json'), 'utf8'), readFileSync(catalogueFile, 'utf8'))
})

test('a base without its final slash fails, naming the option', () => {
    const out = fakeSite()
    const result = spawnSync(process.execPath, [indexing, '--site', out, '--base', 'https://webcpporg.github.io',
        '--catalogue', catalogueFile], {encoding: 'utf8'})
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /--base/)
})
