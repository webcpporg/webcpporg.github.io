// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'

/** A paragraph, with **bold** and `code` as its only markup. */
export const Text = defineComponent({
    name: 'Text',
    description: 'A paragraph of prose.',
    props: z.object({text: z.string()}),
    component: ({props}) => <p>{inline(props.text)}</p>,
})

/** The text between the markup is at the even places of the split, the markup at the odd ones. */
function inline(text: string) {
    return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) =>
        i % 2 === 0 ? part
        : part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <code key={i}>{part.slice(1, -1)}</code>)
}
