// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'
import {type Library, useShared} from '../context.js'
import {bases} from '../head.js'
import {libraryList} from '../software.js'

/** The page whose JSON-LD lists the catalogue, the one the header names Libraries. */
const librariesPage = 'libraries/'

/**
 * Every library of the catalogue, one row each, as Boost's list gives them. On the libraries page
 * it also adds the catalogue to the page's JSON-LD, as an `ItemList` of `SoftwareSourceCode`.
 * Tip: a phone's style stacks each row and shows a cell's `data-label` above it, in place of the
 * column's header.
 */
export const LibraryTable = defineComponent({
    name: 'LibraryTable',
    description: 'The table of every library: its name, description, category, targets and original.',
    props: z.object({}),
    component: function Libraries() {
        const {site, addToGraph} = useShared()
        if (site.path === librariesPage) {
            const base = bases[site.channel]
            addToGraph(libraryList(base, base + site.path, site.catalogue))
        }
        return (
            <div className="table">
                <table className="libraries">
                    <thead>
                        <tr>
                            <th scope="col">Library</th>
                            <th scope="col">Description</th>
                            <th scope="col">Category</th>
                            <th scope="col">Targets</th>
                            <th scope="col">Original</th>
                        </tr>
                    </thead>
                    <tbody>
                        {site.catalogue.map(library => (
                            <tr key={library.key}>
                                <th scope="row"><a href={site.root + library.page}>{library.name}</a></th>
                                <td>{library.description}</td>
                                <td data-label="Category">{library.category.join(', ')}</td>
                                <td data-label="Targets">{library.targets.join(', ')}</td>
                                <td data-label="Original"><Original library={library} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    },
})

function Original({library}: {library: Library}) {
    const original = library.port_of
    if (!original) {
        return <>webcpp's own</>
    }
    return <><a href={original.url}>{original.name} {original.version}</a> ({original.language})</>
}
