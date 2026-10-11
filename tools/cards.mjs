// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The pages' social cards, which the build's --render step writes: for each page, a PNG of 1200
// by 630 at the path its head names in og:image and twitter:image (head.ts's cardPath).
//
// Each is assets/card.svg with assets/logo.svg drawn in it and the page's title set in its text,
// rendered by @resvg/resvg-js with Inter, from @expo-google-fonts/inter (SIL OFL 1.1), pinned
// by the lockfile, and no font of the system: a card is the same bytes on every machine.

import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {Resvg} from '@resvg/resvg-js'

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The cards' one font family, which assets/card.svg names. */
export const fontFamily = 'Inter'

/** Inter's files, the title's weight and the logo's. */
const inter = join(site, 'node_modules/@expo-google-fonts/inter')

/**
 * What every renderer of a card is given: the pinned font's files and nothing of the system's.
 * Tip: a family or a weight the files lack falls back to Inter, the default and sans-serif family.
 */
export const resvgOptions = {
    font: {
        loadSystemFonts: false,
        fontFiles: [join(inter, '600SemiBold/Inter_600SemiBold.ttf'), join(inter, '700Bold/Inter_700Bold.ttf')],
        defaultFontFamily: fontFamily,
        sansSerifFamily: fontFamily,
    },
}

/** The card's width, where the title's lines fit between margins as wide as its `x`. */
const width = 1200
/** At most this many lines; a longer title is set smaller. */
const maxLines = 3
const smallest = 40

/** What assets/logo.svg draws: its root's content, without its title and comments. */
function drawing(logo) {
    const inner = logo.match(/^[\s\S]*?<svg[^>]*>([\s\S]*)<\/svg>\s*$/)
    if (!inner) {
        throw new Error('assets/logo.svg: no <svg> root to draw from')
    }
    return inner[1].replace(/<!--[\s\S]*?-->/g, '').replace(/<title[^>]*>[\s\S]*?<\/title>/g, '')
}

function escape(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** `title`'s words in lines of at most `columns` characters; a longer word stands alone. */
function wrap(title, columns) {
    const lines = []
    for (const word of title.split(/\s+/).filter(Boolean)) {
        const last = lines.length - 1
        if (last >= 0 && lines[last].length + 1 + word.length <= columns) {
            lines[last] += ` ${word}`
        } else {
            lines.push(word)
        }
    }
    return lines
}

/**
 * The card's SVG for `title`: the template's `title` text, at `size`, holds one tspan per line,
 * the block of lines centred on the template's `y`.
 */
function compose(template, logo, lines, size) {
    const element = /<text id="title" x="(\d+)" y="(\d+)" style="([^"]*)">[\s\S]*?<\/text>/
    const found = template.match(element)
    if (!found || !/<svg id="logo"[^>]*><\/svg>/.test(template)) {
        throw new Error('assets/card.svg: no <svg id="logo"> and <text id="title" x y style> to fill')
    }
    const [, x, y, style] = found
    const leading = size * 1.1
    // A line's baseline sits about 0.35 em under the middle of its capitals.
    const first = Number(y) - (leading * (lines.length - 1)) / 2 + size * 0.35
    const sized = style.replace(/font-size:\s*\d+px/, `font-size: ${size}px`)
    // Each tspan repeats the style: the logo's stylesheet colours every tspan of the document.
    const spans = lines.map((line, i) =>
        `<tspan x="${x}" y="${(first + i * leading).toFixed(1)}" style="${sized}">${escape(line)}</tspan>`)
    return template
        .replace(/<svg id="logo"([^>]*)><\/svg>/, (_, attributes) => `<svg id="logo"${attributes}>${logo}</svg>`)
        .replace(element, `<text id="title" x="${x}" style="${sized}">${spans.join('')}</text>`)
}

/**
 * The width the title's text takes in `svg`, or null when no font drew it.
 * Tip: resvg's box stops at the canvas's edge, so the text is measured alone on a canvas wider
 * than any title.
 */
function titleWidth(svg) {
    const text = svg.match(/<text id="title"[\s\S]*?<\/text>/)[0]
    const alone = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 10}" height="${width}">${text}</svg>`
    const box = new Resvg(alone, resvgOptions).innerBBox()
    return box && box.width > 0 ? box.width : null
}

/**
 * The PNG of `title`'s card: set at the template's size in as few lines as fit, smaller when it
 * needs more than `maxLines` lines or a line overflows the margins. A line holds as many
 * characters as the title's own average glyph, measured on one line, lets fit.
 * Tip: a font file missing or unreadable would render a card with no title; that throws instead.
 */
export async function renderCard(title) {
    const template = await readFile(join(site, 'assets/card.svg'), 'utf8')
    const logo = drawing(await readFile(join(site, 'assets/logo.svg'), 'utf8'))
    const margin = Number(template.match(/<text id="title" x="(\d+)"/)?.[1] ?? 0)
    const largest = Number(template.match(/<text id="title"[^>]*font-size:\s*(\d+)px/)?.[1] ?? 0)
    const room = width - 2 * margin
    const noFont = () => new Error(`cards.mjs: ${fontFamily}, from ${inter}, draws no glyph of the card's title "${title}"`)
    const oneLine = titleWidth(compose(template, logo, [title], largest))
    if (oneLine === null) {
        throw noFont()
    }
    const glyph = oneLine / title.length / largest
    for (let size = largest; size >= smallest; size -= 4) {
        const lines = wrap(title, Math.floor(room / (size * glyph)))
        if (lines.length > maxLines) {
            continue
        }
        const svg = compose(template, logo, lines, size)
        const taken = titleWidth(svg)
        if (taken === null) {
            throw noFont()
        }
        if (taken <= room) {
            return new Resvg(svg, resvgOptions).render().asPng()
        }
    }
    throw new Error(`cards.mjs: "${title}" fits no card, even at ${smallest}px`)
}

/** Writes each card, `{file, title}`, `file` from the site's root, under `out`. */
export async function writeCards(out, cards) {
    for (const {file: card, title} of cards) {
        const file = join(out, card)
        await mkdir(dirname(file), {recursive: true})
        await writeFile(file, await renderCard(title))
    }
}
