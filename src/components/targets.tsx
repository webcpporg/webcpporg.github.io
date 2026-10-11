// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'

const places = [
    {name: 'The browser', text: 'Compiled to WebAssembly with Emscripten, beside the page\'s JavaScript.'},
    {name: 'A server', text: 'As a WASI component in a WebAssembly container, run by wasmtime or a cloud.'},
    {name: 'Native', text: 'Compiled by your own compiler, as any C++ library is.'},
]

/** The three places the same C++ runs. */
export const Targets = defineComponent({
    name: 'Targets',
    description: 'The three places the same code runs: the browser, a server and native.',
    props: z.object({}),
    component: () => (
        <ul className="targets">
            {places.map(place => (
                <li key={place.name}>
                    <strong>{place.name}</strong>
                    <p>{place.text}</p>
                </li>
            ))}
        </ul>
    ),
})
