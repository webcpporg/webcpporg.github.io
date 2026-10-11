// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'
import {Link} from './link.js'
import {Mark} from './mark.js'

/**
 * A page's opening: its heading, a line under it, and where to go next, beside its figure, the
 * site's mark, whose arms close round the rest as the page opens.
 * Tip: the figure is the place the home's live example takes when the visualizer comes.
 */
export const Hero = defineComponent({
    name: 'Hero',
    description: 'The opening of a page, its first block: the page\'s heading, a subtitle, then links, beside the site\'s mark.',
    props: z.object({title: z.string(), subtitle: z.string(), actions: z.array(Link.ref)}),
    component: ({props, renderNode}) => (
        <header className="hero">
            <div className="hero-text">
                <h1>{props.title}</h1>
                <p className="subtitle">{props.subtitle}</p>
                <p className="actions">{renderNode(props.actions)}</p>
            </div>
            <div className="hero-figure">
                <Mark className="mark opening" />
            </div>
        </header>
    ),
})
