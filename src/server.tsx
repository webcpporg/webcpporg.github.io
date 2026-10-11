// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {renderToStaticMarkup, renderToString} from 'react-dom/server'
import {checkPage, PageError} from './check.js'
import {Band} from './components/band.js'
import {Header} from './components/header.js'
import {type GraphNode, SharedContext, type SiteContext} from './context.js'
import {attribute, describe, writeHead} from './head.js'
import {encodeSource, scriptJson} from './source.js'
import {PageTree} from './tree.js'

export {PageError}
export {cardPath} from './head.js'
export type {Library, SiteContext} from './context.js'

/**
 * A whole HTML document for the page `file` whose OpenUI Lang is `source`: the shell (its head and
 * the `<noscript>` message), the tree OpenUI renders, prerendered inside `<div id="root">` (the
 * header, band and footer are its Page's), and the page's source and context, which the browser
 * hydrates from.
 * A fault of the page, or a preview context carrying a release's version, throws a PageError
 * naming `file` and its line.
 */
export function renderPage(file: string, source: string, context: SiteContext): string {
    if (context.channel === 'preview' && context.version !== null) {
        throw new PageError(file, 1, `the preview carries no version, and this context's is ${context.version}: build the release with its own channel, or leave the version out`)
    }
    const root = checkPage(file, source)
    const graph: GraphNode[] = []
    const body = markup(renderToString(<PageTree source={source} shared={{site: context, addToGraph: node => graph.push(node)}} />))
    const {title, description} = root.props as {title: string; description: string}
    const head = describe(context, title, description, graph)
    return [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        writeHead(head),
        `<link rel="stylesheet" href="${attribute(context.root)}assets/chrome.css">`,
        `<link rel="stylesheet" href="${attribute(context.root)}assets/site.css">`,
        `<script type="module" src="${attribute(context.root)}assets/site.js"></script>`,
        '</head>',
        '<body>',
        '<noscript>This site needs JavaScript for its examples; every page still reads without it.</noscript>',
        `<div id="root">${body}</div>`,
        `<script type="text/openui" id="page-source">${encodeSource(source)}</script>`,
        `<script type="application/json" id="site-context">${scriptJson(context)}</script>`,
        '</body>',
        '</html>',
        '',
    ].join('\n')
}

/**
 * The title the Page of `file` gives, without the site's name the head adds: what the page's
 * social card shows. A fault of the page throws as renderPage's does.
 */
export function pageTitle(file: string, source: string): string {
    return (checkPage(file, source).props as {title: string}).title
}

/**
 * A part of a page for the pages the site does not render itself, which assemble.py inserts:
 * `docs-header`, the Header and the Band every Page shows, after the `<body>` of every library's
 * page. Its links start with `context.root`, which the caller chooses for the pages it inserts it
 * into.
 */
export function renderFragment(name: 'docs-header', context: SiteContext): string {
    if (name !== 'docs-header') {
        throw new Error(`${name} is not a fragment of the site`)
    }
    const renderNode = () => null
    return markup(renderToStaticMarkup(
        <SharedContext.Provider value={{site: context, addToGraph: () => {}}}>
            <Header.component props={{}} renderNode={renderNode} />
            <Band.component props={{}} renderNode={renderNode} />
        </SharedContext.Provider>,
    ))
}

/**
 * React's HTML with each apostrophe written as itself: React writes `&#x27;`, which the browser
 * reads back as the same `'`, but a reader of the page's source and a search over it see `'`.
 * Tip: React quotes every attribute with `"`, so an apostrophe is never markup in its output.
 */
function markup(html: string): string {
    return html.replaceAll('&#x27;', "'")
}
