// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import type {GraphNode, Library} from './context.js'

/** The licence every library of webcpp is under. */
export const licence = 'https://www.boost.org/LICENSE_1_0.txt'

/** What schema.org's `runtimePlatform` names for each of a library's targets. */
const platforms: Record<string, string> = {
    emscripten: 'Emscripten',
    wasip2: 'WASI 0.2',
    wasip3: 'WASI 0.3',
    native: 'native',
}

/**
 * The platforms a library runs on, from its targets: WebAssembly first when one of them is, then
 * each target's platform in this table's order, then a target the table does not know, by its name.
 */
export function runtimePlatform(targets: string[]): string[] {
    const wasm = targets.some(target => target === 'emscripten' || target.startsWith('wasip'))
    return [
        ...(wasm ? ['WebAssembly'] : []),
        ...Object.keys(platforms).filter(target => targets.includes(target)).map(target => platforms[target]),
        ...targets.filter(target => !(target in platforms)),
    ]
}

/** A library as schema.org's `SoftwareSourceCode`, its page under `base`. */
export function softwareSourceCode(base: string, library: Library): GraphNode {
    const original = library.port_of
    return {
        '@type': 'SoftwareSourceCode',
        name: library.name,
        description: library.description,
        url: base + library.page,
        codeRepository: library.repository,
        programmingLanguage: 'C++',
        license: licence,
        runtimePlatform: runtimePlatform(library.targets),
        ...(original ? {
            isBasedOn: {
                '@type': 'SoftwareSourceCode',
                name: original.name,
                url: original.url,
                version: original.version,
                programmingLanguage: original.language,
            },
        } : {}),
    }
}

/** The catalogue as the `ItemList` of the libraries page, whose URL is `canonical`. */
export function libraryList(base: string, canonical: string, catalogue: Library[]): GraphNode {
    return {
        '@type': 'ItemList',
        '@id': `${canonical}#libraries`,
        name: 'The libraries of webcpp',
        numberOfItems: catalogue.length,
        itemListElement: catalogue.map((library, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: softwareSourceCode(base, library),
        })),
    }
}
