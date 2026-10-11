// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'
import {Link} from './link.js'

/** A page's opening: its heading, a line under it, and where to go next. */
export const Hero = defineComponent({
    name: 'Hero',
    description: 'The opening of a page, its first block: the page\'s heading, a subtitle, then links.',
    props: z.object({title: z.string(), subtitle: z.string(), actions: z.array(Link.ref)}),
    component: ({props, renderNode}) => (
        <header className="hero">
            <h1>{props.title}</h1>
            <p className="subtitle">{props.subtitle}</p>
            <p className="actions">{renderNode(props.actions)}</p>
        </header>
    ),
})
