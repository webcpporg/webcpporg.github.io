// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'

/** The site's footer: its licence and its source. */
export const Footer = defineComponent({
    name: 'Footer',
    description: 'The site\'s footer: its licence and where its source is. A Page places it.',
    props: z.object({}),
    component: () => (
        <footer className="site">
            <p>
                webcpp is free software, under the <a href="https://www.boost.org/LICENSE_1_0.txt">Boost
                Software License 1.0</a>. Its source is <a href="https://github.com/webcpporg/webcpp">on
                GitHub</a>.
            </p>
        </footer>
    ),
})
