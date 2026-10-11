// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'
import {useShared} from '../context.js'

/**
 * Which build of the site this is: the commit and its date on preview, the version on release.
 * Tip: each text is one string, so that React writes no `<!-- -->` between two text nodes.
 */
export const Band = defineComponent({
    name: 'Band',
    description: 'The band under the header naming the build: its commit on preview, its version on release. A Page places it.',
    props: z.object({}),
    component: function BuildBand() {
        const {site} = useShared()
        if (site.channel === 'release') {
            return <p className="band">{`webcpp ${site.version}`}</p>
        }
        return <p className="band">Preview of main at <code>{site.commit.slice(0, 7)}</code>{`, ${site.date}`}</p>
    },
})
