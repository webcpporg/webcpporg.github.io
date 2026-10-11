// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'
import {useShared} from '../context.js'

const doors = [
    {name: 'C++', page: 'cpp/', text: 'Getting started, building for each target, and every library\'s page.'},
    {name: 'JavaScript', page: 'javascript/', text: 'Using a webcpp library from JavaScript, and the same code on a server.'},
    {name: 'AI', page: 'ai/', text: 'llms.txt and libraries.json, the catalogue for agents.'},
]

/** The three ways into the site, one for each kind of developer. */
export const Doors = defineComponent({
    name: 'Doors',
    description: 'The three doors into the site: for C++, JavaScript and AI developers.',
    props: z.object({}),
    component: function DoorList() {
        const {site} = useShared()
        return (
            <ul className="doors">
                {doors.map(door => (
                    <li key={door.page}>
                        <a href={site.root + door.page}>For {door.name} developers</a>
                        <p>{door.text}</p>
                    </li>
                ))}
            </ul>
        )
    },
})
