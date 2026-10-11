// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'
import {Band} from './band.js'
import {block} from './blocks.js'
import {Footer} from './footer.js'
import {Header} from './header.js'
import {Hero} from './hero.js'
import {Section} from './section.js'

/**
 * A page: the site's header and band, the document's `<main>`, and the footer. Its title and
 * description are the head's, which the shell writes.
 * Tip: a page has one `<h1>`: its Hero's title when its first block is a Hero, else its own.
 */
export const Page = defineComponent({
    name: 'Page',
    description: 'A page of the site: its title, its description (120 to 160 characters), then its blocks.',
    props: z.object({
        title: z.string(),
        description: z.string(),
        body: z.array(z.union([Hero.ref, Section.ref, block])),
    }),
    component: ({props, renderNode}) => (
        <>
            <Header.component props={{}} renderNode={renderNode} />
            <Band.component props={{}} renderNode={renderNode} />
            <main>
                {startsWithHero(props.body) ? null : <h1>{props.title}</h1>}
                {renderNode(props.body)}
            </main>
            <Footer.component props={{}} renderNode={renderNode} />
        </>
    ),
})

function startsWithHero(body: unknown[]): boolean {
    const first = body[0] as {typeName?: string} | undefined
    return first?.typeName === Hero.name
}
