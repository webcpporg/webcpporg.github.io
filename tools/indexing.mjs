// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The files that index the whole site, written once b2 site has laid it out:
//
//   indexing.mjs --site <out> --base <url> --catalogue <libraries.json> --channel <preview|release>
//                [--superproject <dir>]
//
// writes into <out>:
//   robots.txt     every crawler allowed, Google-Extended by name, and, on release, the sitemap;
//   sitemap.xml    on release alone, every <out>/**/index.html as <base><path>, sorted, each with
//                  the date of the last commit that changed its source;
//   llms.txt       what webcpp is (the home's description), then a line for every library and
//                  for every other page, with its title and description;
//   libraries.json the catalogue, copied as it is.
//
// <base> is the channel's absolute URL, ending with "/": the one place the site's URLs are
// absolute. The preview, the development version, is never indexed (every page carries noindex,
// src/head.ts and tools/ci/assemble.py), so it has no sitemap, and its robots.txt still lets every
// crawler in, since a crawler kept out of a page never reads its noindex. A page's source is its
// .oui under this repository's pages/ for the site's own pages; with --superproject, a library's
// repository (libs/<key>) for its page and doc/ for docs/. A page with no known source, or whose
// source was never committed, has no <lastmod>.

import {execFileSync} from 'node:child_process'
import {copyFile, readdir, readFile, writeFile} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {dirname, join, relative, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) {
    console.error(`indexing.mjs: ${message}`)
    process.exit(2)
}

/** Every page under `out`, as its path from the root (`""`, `"cpp/"`), sorted. */
async function pagesUnder(out) {
    const entries = await readdir(out, {recursive: true, withFileTypes: true})
    return entries
        .filter(entry => entry.isFile() && entry.name === 'index.html')
        .map(entry => relative(out, entry.parentPath).split('\\').join('/'))
        .map(directory => directory ? `${directory}/` : '')
        .sort()
}

function decode(text) {
    return text.replace(/&(lt|gt|quot|#x27|#39|amp);/g, (_, name) =>
        ({lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'", amp: '&'})[name])
}

/** A page's title and description, as its head gives them. */
async function describe(out, path) {
    const html = await readFile(join(out, path, 'index.html'), 'utf8')
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1]
    const description = html.match(/<meta name="description" content="([^"]*)">/)?.[1]
    return {path, title: decode(title ?? path), description: description === undefined ? null : decode(description)}
}

/** The date, YYYY-MM-DD, of the last commit that changed `file` in the repository `directory`, or null. */
function committed(directory, file) {
    const date = execFileSync('git', ['-C', directory, 'log', '-1', '--format=%cs', '--', file], {encoding: 'utf8'}).trim()
    return date || null
}

/** The date the source of the page at `path` last changed, or null when none is known. */
function lastmod(path, catalogue, superproject) {
    const name = path.replace(/\/$/, '') || 'index'
    for (const file of [`pages/${name}.oui`, `pages/${name}/index.oui`]) {
        if (existsSync(join(site, file))) {
            return committed(site, file)
        }
    }
    if (!superproject) {
        return null
    }
    const library = catalogue.find(entry => entry.page === path)
    if (library) {
        return committed(join(superproject, 'libs', library.key), '.')
    }
    return path === 'docs/' ? committed(superproject, 'doc') : null
}

function xml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** A Markdown link's text, its brackets escaped. */
function label(text) {
    return text.replace(/[[\]\\]/g, character => `\\${character}`)
}

const {values} = parseArgs({
    options: {
        site: {type: 'string'},
        base: {type: 'string'},
        catalogue: {type: 'string'},
        channel: {type: 'string'},
        superproject: {type: 'string'},
    },
})
if (!values.site || !values.base || !values.catalogue || !values.channel) {
    fail('usage: indexing.mjs --site <out> --base <url> --catalogue <libraries.json> --channel <preview|release> [--superproject <dir>]')
}
if (!['preview', 'release'].includes(values.channel)) {
    fail(`--channel ${values.channel} is no channel of the site: the channels are preview and release`)
}
if (!/^https?:\/\/[^/?#]+\/([^?#]*\/)?$/.test(values.base)) {
    fail(`--base ${values.base} is not an absolute http(s) URL ending with "/"`)
}
const {site: out, base} = values
const release = values.channel === 'release'
const catalogue = JSON.parse(await readFile(values.catalogue, 'utf8'))
const pages = await Promise.all((await pagesUnder(out)).map(path => describe(out, path)))
const home = pages.find(page => page.path === '')
if (!home?.description) {
    fail(`${out} has no index.html with a description, which llms.txt opens with`)
}

await writeFile(join(out, 'robots.txt'), [
    'User-agent: *', 'Allow: /', '',
    'User-agent: Google-Extended', 'Allow: /',
    ...(release ? ['', `Sitemap: ${base}sitemap.xml`] : []), '',
].join('\n'))

if (release) {
    await writeFile(join(out, 'sitemap.xml'), [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...pages.map(({path}) => {
            const date = lastmod(path, catalogue, values.superproject)
            return `<url><loc>${xml(base + path)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`
        }),
        '</urlset>',
        '',
    ].join('\n'))
}

const libraryPages = new Set(catalogue.map(library => library.page))
const line = (text, url, description) => `- [${label(text)}](${url})${description ? `: ${description}` : ''}`
await writeFile(join(out, 'llms.txt'), [
    '# webcpp', '',
    `> ${home.description}`, '',
    '## Libraries', '',
    ...catalogue.map(library => line(library.name, base + library.page, library.description)), '',
    '## Pages', '',
    ...pages.filter(page => !libraryPages.has(page.path)).map(page => line(page.title, base + page.path, page.description)), '',
    '## Data', '',
    line('libraries.json', `${base}libraries.json`, 'the catalogue of every library: its targets, its repository, its page and the original a port follows'), '',
].join('\n'))

await copyFile(values.catalogue, join(out, 'libraries.json'))
