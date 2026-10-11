// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'
import {inline} from './text.js'

/** What is coming, one line each, with a Text's **bold** and `code`. */
export const Roadmap = defineComponent({
    name: 'Roadmap',
    description: 'A list of what is coming, one string per line, with **bold** and `code` as in a Text.',
    props: z.object({items: z.array(z.string())}),
    component: ({props}) => (
        <ul className="roadmap">
            {props.items.map((item, i) => <li key={i}>{inline(item)}</li>)}
        </ul>
    ),
})
