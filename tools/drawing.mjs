// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// What assets/logo.svg draws, which every image of the mark is made from: the home's inline mark
// (src/components/mark.tsx, given it by tools/build.mjs as the module of assets/logo.svg), the
// icons and the favicon (tools/icons.mjs) and the social cards (tools/cards.mjs).

/** `svg`'s root's content, its defs and its strokes, without its title, style and comments. */
export function drawing(svg) {
    const inner = svg.match(/^[\s\S]*?<svg[^>]*>([\s\S]*)<\/svg>\s*$/)
    if (!inner) {
        throw new Error('assets/logo.svg: no <svg> root to draw from')
    }
    return inner[1]
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<title[^>]*>[\s\S]*?<\/title>/g, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
        .trim()
}

/** `css` without its @media blocks, each removed whole, the rules it holds with it. */
export function withoutMediaQueries(css) {
    let out = ''
    let at = 0
    for (let start = css.indexOf('@media', at); start >= 0; start = css.indexOf('@media', at)) {
        out += css.slice(at, start)
        let depth = 0
        let end = css.indexOf('{', start)
        for (; end < css.length; end++) {
            if (css[end] === '{') {
                depth++
            } else if (css[end] === '}' && --depth === 0) {
                break
            }
        }
        at = end + 1
    }
    return (out + css.slice(at)).replace(/\n\s*\n/g, '\n')
}
