// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The theme's stylesheets, read as the browser reads their tokens and rules: every colour of text
// is 4.5 to 1 at least on the background and the surface, in both themes; a pointer's hover never
// draws the keyboard's focus ring; and the muted body copy is the opening page's alone.

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import test from 'node:test'
import {site} from './site.mjs'

const chrome = readFileSync(join(site, 'assets/chrome.css'), 'utf8')
const theme = readFileSync(join(site, 'assets/site.css'), 'utf8')

/** Every rule of `css` that holds no other, as its selector list and its declarations. */
function rules(css) {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
    return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
        selectors: selector.trim().split(',').map(part => part.trim()),
        declarations: Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])),
    }))
}

/** The custom properties `css` sets on `:root` in the block that `opening` starts. */
function tokens(css, opening) {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const at = text.indexOf(opening)
    assert.ok(at >= 0, opening)
    const block = text.slice(at).match(/:root[^{]*\{([^{}]*)\}/)[1]
    return Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
}

function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (high + 0.05) / (low + 0.05)
}

test('every colour of text is 4.5 to 1 at least on the background and the surface, light and dark', () => {
    const light = tokens(chrome, ':root {')
    const dark = {...light, ...tokens(theme, '@media (prefers-color-scheme: dark)')}
    for (const [name, colours] of Object.entries({light, dark})) {
        for (const ground of ['--background', '--surface']) {
            for (const ink of ['--text', '--muted', '--accent']) {
                const ratio = contrast(colours[ink], colours[ground])
                assert.ok(ratio >= 4.5, `${name}: ${ink} ${colours[ink]} on ${ground} ${colours[ground]} is ${ratio.toFixed(2)}`)
            }
        }
        const fill = contrast('#ffffff', colours['--accent-fill'])
        assert.ok(fill >= 4.5, `${name}: white on --accent-fill ${colours['--accent-fill']} is ${fill.toFixed(2)}`)
    }
})

test("a pointer's hover never draws the keyboard's focus ring", () => {
    for (const rule of [...rules(chrome), ...rules(theme)]) {
        if (rule.selectors.some(selector => selector.includes(':hover'))) {
            assert.equal(rule.declarations.outline, undefined, rule.selectors.join(', '))
        }
    }
})

test("the sections' body copy is muted on the opening page alone, never on a page of content", () => {
    const muted = rules(theme).filter(rule => rule.declarations.color === 'var(--muted)' &&
        rule.selectors.some(selector => /section\s*>\s*p/.test(selector)))
    assert.ok(muted.length > 0, 'the opening page mutes its sections\' ledes')
    for (const rule of muted) {
        for (const selector of rule.selectors) {
            assert.match(selector, /:has\(> \.hero\)/, selector)
        }
    }
})
