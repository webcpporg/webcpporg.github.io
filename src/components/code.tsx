// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'

/** A block of source code, in the language its class names. */
export const Code = defineComponent({
    name: 'Code',
    description: 'A block of source code: its language, such as cpp or js, then the source.',
    props: z.object({language: z.string(), source: z.string()}),
    component: ({props}) => <pre><code className={`language-${props.language}`}>{props.source}</code></pre>,
})
