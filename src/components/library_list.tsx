// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'
import {useShared} from '../context.js'

/**
 * The libraries of the catalogue, each its name linked to its page and its description; with a
 * target, only those built for it.
 * Tip: a page names a library through this list, never in its own text, so that the list follows
 * the catalogue.
 */
export const LibraryList = defineComponent({
    name: 'LibraryList',
    description: 'A list of the libraries, each linked to its page with its description; optionally only those of a target, such as emscripten.',
    props: z.object({target: z.string().optional()}),
    component: function Libraries({props}) {
        const {site} = useShared()
        const libraries = site.catalogue.filter(library => !props.target || library.targets.includes(props.target))
        return (
            <ul className="library-list">
                {libraries.map(library => (
                    <li key={library.key}>
                        <a href={site.root + library.page}>{library.name}</a>
                        <p>{library.description}</p>
                    </li>
                ))}
            </ul>
        )
    },
})
