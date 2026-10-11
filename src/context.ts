// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {createContext, useContext} from 'react'

/** One library of the catalogue, as `libraries.json` gives it. */
export type Library = {
    key: string
    name: string
    description: string
    category: string[]
    /** For instance `["emscripten", "native", "wasip2", "wasip3"]`. */
    targets: string[]
    /** The original a port follows; null for a library of webcpp's own. */
    port_of: {name: string; language: string; version: string; url: string; licence: string} | null
    /** `libs/<key>/`, from the site's root. */
    page: string
    /** `https://github.com/webcpporg/<key>`. */
    repository: string
}

/** What the build knows about the site and the page it renders, shared by every component. */
export type SiteContext = {
    channel: 'preview' | 'release'
    /** The commit the site is built from, 40 hex digits. */
    commit: string
    /** The commit's date, YYYY-MM-DD. */
    date: string
    /** The release's version; null on preview. */
    version: string | null
    catalogue: Library[]
    /** From this page to the site's root: `""`, `"../"`, ... */
    root: string
    /** This page's path from the site's root: `""` for the home, `"libraries/"`, ... */
    path: string
}

/** A node of the page's JSON-LD `@graph`. */
export type GraphNode = {'@type': string} & Record<string, unknown>

/**
 * What a component reads while it renders: the site, and where it adds a node of its own to the
 * page's JSON-LD graph.
 * Tip: the server collects the nodes into the head it writes after the body; the browser, which
 * never writes the head, ignores them.
 */
export type Shared = {
    site: SiteContext
    addToGraph: (node: GraphNode) => void
}

export const SharedContext = createContext<Shared | null>(null)

/** The shared context of the page being rendered; a component outside a page is a bug. */
export function useShared(): Shared {
    const shared = useContext(SharedContext)
    if (!shared) {
        throw new Error('a component of the site renders only inside SharedContext')
    }
    return shared
}

