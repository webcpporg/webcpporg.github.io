// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {useId} from 'react'
import drawing from '../../assets/logo.svg'

/**
 * The site's mark drawn inline, from assets/logo.svg itself, whose drawing alone the build gives
 * this module (tools/build.mjs), so that the page's styles colour its parts (`.ink`, `.acc`) and
 * move them (`.arms`, `.angles`, `.globe`).
 * Tip: each copy prefixes the drawing's ids, its clip paths', with one of its own, so that two
 * copies on a page never clip each other's parts.
 */
export function Mark({className}: {className: string}) {
    const prefix = `mark${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
    const html = drawing
        .replace(/id="([\w-]+)"/g, `id="${prefix}-$1"`)
        .replace(/url\(#([\w-]+)\)/g, `url(#${prefix}-$1)`)
    return <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{__html: html}} />
}
