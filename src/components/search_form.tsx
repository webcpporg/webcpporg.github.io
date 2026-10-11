// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import {useEffect, useRef} from 'react'
import * as z from 'zod'
import {useShared} from '../context.js'
import {bases} from '../head.js'

/**
 * The site's search: a Google search whose first `q`, hidden, restricts it to the channel's host,
 * and whose second is the reader's. Opened as `search/?q=<terms>`, the JSON-LD's SearchAction,
 * the box starts with those terms.
 * Tip: Google joins the two `q` into one query; the Programmable Search element replaces this form
 * once the owner creates its engine (the spec's section 9).
 */
export const SearchForm = defineComponent({
    name: 'SearchForm',
    description: 'The search box: Google\'s search, restricted to the site.',
    props: z.object({}),
    component: function Search() {
        const {site} = useShared()
        const terms = useRef<HTMLInputElement>(null)
        useEffect(() => {
            const asked = new URLSearchParams(window.location.search).get('q')
            if (asked && terms.current && !terms.current.value) {
                terms.current.value = asked
            }
        }, [])
        return (
            <form className="search" role="search" action="https://www.google.com/search" method="get">
                <input type="hidden" name="q" value={`site:${new URL(bases[site.channel]).host}`} />
                <label htmlFor="search-terms">Search webcpp's pages and every library's documentation</label>
                <div className="search-row">
                    <input id="search-terms" type="search" name="q" required autoComplete="off" spellCheck={false} ref={terms} />
                    <button type="submit">Search</button>
                </div>
            </form>
        )
    },
})
