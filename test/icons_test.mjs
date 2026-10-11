// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The icons and the favicon the build renders from assets/logo.svg (tools/icons.mjs).

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import test from 'node:test'
import * as icons from '../tools/icons.mjs'
import {site} from './site.mjs'

const logo = readFileSync(join(site, 'assets/logo.svg'), 'utf8')

/** A PNG's width and height, from its IHDR chunk. */
function size(png) {
    assert.equal(png.toString('latin1', 1, 4), 'PNG')
    return [png.readUInt32BE(16), png.readUInt32BE(20)]
}

test('every app icon is a square PNG of its size, on each ground, and the Apple touch icon is 180 px', async () => {
    const files = new Map((await icons.icons()).map(({file, data}) => [file, data]))
    for (const ground of Object.keys(icons.grounds)) {
        for (const side of icons.appSizes) {
            assert.deepEqual(size(files.get(`assets/icons/icon-${ground}-${side}.png`)), [side, side], `${ground} ${side}`)
        }
    }
    assert.deepEqual(size(files.get('assets/icons/apple-touch-icon.png')), [180, 180])
})

test('favicon.ico holds a PNG for each of its sizes, each where its directory entry says', async () => {
    const ico = (await icons.icons()).find(({file}) => file === 'favicon.ico').data
    assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)], [0, 1, icons.faviconSizes.length])
    icons.faviconSizes.forEach((side, i) => {
        const entry = 6 + 16 * i
        assert.deepEqual([ico.readUInt8(entry), ico.readUInt8(entry + 1)], [side, side])
        const [length, offset] = [ico.readUInt32LE(entry + 8), ico.readUInt32LE(entry + 12)]
        assert.deepEqual(size(ico.subarray(offset, offset + length)), [side, side])
    })
})

test("resvg honours the mark's clip paths: each part keeps its colour on either side of a joint's seam", () => {
    const side = 512
    const {pixels} = icons.render(icons.iconSvg(logo, 'accent', 0.625), side)
    // The colour at the mark's point (x, y), the app icon drawing the mark at 0.625 of its side.
    const at = (x, y) => {
        const [px, py] = [x, y].map(v => Math.round((32 + (v - 32) * 0.625) * side / 64))
        const i = (py * side + px) * 4
        return '#' + [0, 1, 2].map(k => pixels[i + k].toString(16).padStart(2, '0')).join('')
    }
    const {ground, ink, accent} = icons.grounds.accent
    assert.equal(at(1, 1), ground)
    assert.equal(at(19, 12), ink, 'an arm')
    assert.equal(at(9, 32), accent, "an angle bracket's vertex")
    assert.equal(at(32, 32), ink, "the globe's centre")
    // Either side of the top left joint's seam, which runs through (19, 20) towards (0, 12.13).
    assert.equal(at(19, 18.5), ink, 'the arm, just above its seam')
    assert.equal(at(17.3, 22.4), accent, 'the angle bracket, just below the seam')
})

test('on the accent, the angle brackets are black, 3 to 1 at least against the ground', () => {
    const luminance = hex => {
        const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
            .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const contrast = (a, b) => {
        const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
        return (high + 0.05) / (low + 0.05)
    }
    for (const {ground, ink, accent} of Object.values(icons.grounds)) {
        assert.ok(contrast(accent, ground) >= 3, `${accent} on ${ground}`)
        assert.ok(contrast(ink, ground) >= 3, `${ink} on ${ground}`)
    }
    assert.equal(icons.grounds.accent.accent, '#000000')
})
