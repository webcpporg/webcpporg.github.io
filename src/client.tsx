// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {hydrateRoot} from 'react-dom/client'
import type {SiteContext} from './context.js'
import {decodeSource} from './source.js'
import {PageTree} from './tree.js'

/**
 * Hydrates the tree the build prerendered into `#root`, from the page's OpenUI Lang and the
 * site's context the shell carries.
 * Tip: a tree that differs from the prerendered one is logged as an error, which the browser
 * lane's console check turns into a failure.
 */
function hydrate() {
    const root = document.getElementById('root')
    const source = document.getElementById('page-source')?.textContent
    const context = document.getElementById('site-context')?.textContent
    if (!root || source == null || context == null) {
        console.error('webcpp: the page carries no #root, #page-source or #site-context to hydrate')
        return
    }
    const site = JSON.parse(context) as SiteContext
    hydrateRoot(root, <PageTree source={decodeSource(source)} shared={{site, addToGraph: () => {}}} />, {
        onRecoverableError: error => console.error('webcpp: the page hydrated differently from its prerendered tree', error),
    })
}

hydrate()
