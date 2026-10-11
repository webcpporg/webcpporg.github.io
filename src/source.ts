// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

/**
 * A page's OpenUI Lang as the shell carries it inside its `<script type="text/openui">`, and back.
 * Tip: a script element's text ends at the first `</script`, whatever its type, so every `<` is
 * written `&lt;` and, for the encoding to be undone exactly, every `&` is written `&amp;`.
 */
export function encodeSource(source: string): string {
    return source.replace(/[&<]/g, character => character === '&' ? '&amp;' : '&lt;')
}

export function decodeSource(text: string): string {
    return text.replace(/&(amp|lt);/g, (_, name) => name === 'amp' ? '&' : '<')
}

/** JSON for a `<script>` element: `<` written `\u003c`, which JSON.parse reads back. */
export function scriptJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c')
}
