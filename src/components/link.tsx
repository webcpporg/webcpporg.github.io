// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'
import {useShared} from '../context.js'

/**
 * A link: to another site when its href has a scheme, else to a page of this site, from its root.
 * Tip: a path from the server's root, `/x`, is refused by the server before this renders, so the
 * same site serves at a domain's root and under a prefix.
 */
export const Link = defineComponent({
    name: 'Link',
    description: 'A link: its text, then its href, a URL or a path from the site\'s root such as libraries/.',
    props: z.object({text: z.string(), href: z.string()}),
    component: ({props}) => <a href={resolve(useShared().site.root, props.href)}>{props.text}</a>,
})

function resolve(root: string, href: string): string {
    return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#') ? href : root + href
}
