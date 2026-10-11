// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {Renderer} from '@openuidev/react-lang'
import {type Shared, SharedContext} from './context.js'
import {library} from './library.js'

/**
 * The tree OpenUI renders from a page's OpenUI Lang: the server renders it to HTML and the
 * browser hydrates that HTML with it, so both build it here, from the same source and context.
 */
export function PageTree({source, shared}: {source: string; shared: Shared}) {
    return (
        <SharedContext.Provider value={shared}>
            <Renderer.Root response={source} library={library} isStreaming={false}><Renderer.Content /></Renderer.Root>
        </SharedContext.Provider>
    )
}
