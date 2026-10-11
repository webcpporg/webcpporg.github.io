// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'
import {block} from './blocks.js'

/** A part of a page under its own heading. */
export const Section = defineComponent({
    name: 'Section',
    description: 'A part of a page: its heading, then its blocks.',
    props: z.object({title: z.string(), body: z.array(block)}),
    component: ({props, renderNode}) => (
        <section>
            <h2>{props.title}</h2>
            {renderNode(props.body)}
        </section>
    ),
})
