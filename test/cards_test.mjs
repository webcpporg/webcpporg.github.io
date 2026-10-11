// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {join, relative} from 'node:path'
import test from 'node:test'
import * as cards from '../tools/cards.mjs'
import {site} from './site.mjs'

const fontPackage = join(site, 'node_modules/@expo-google-fonts/inter')

test("the cards' fonts are the pinned package's files alone, never the system's", () => {
    const {font} = cards.resvgOptions
    assert.equal(font.loadSystemFonts, false)
    assert.equal(font.fontDirs, undefined)
    assert.ok(font.fontFiles.length > 0)
    for (const file of font.fontFiles) {
        const inside = relative(fontPackage, file)
        assert.ok(!inside.startsWith('..') && !inside.startsWith('/'), `${file} is outside ${fontPackage}`)
        assert.match(file, /\.(ttf|otf)$/)
        assert.ok(readFileSync(file).length > 0, file)
    }
    assert.equal(font.defaultFontFamily, cards.fontFamily)
    assert.equal(font.sansSerifFamily, cards.fontFamily)
})

test('every renderer the cards make takes those options, and the template names that family', () => {
    const source = readFileSync(join(site, 'tools/cards.mjs'), 'utf8')
    const calls = [...source.matchAll(/new Resvg\(([^)]*)\)/g)]
    assert.ok(calls.length > 0)
    for (const [call, args] of calls) {
        assert.match(args, /^\w+, resvgOptions$/, call)
    }
    assert.doesNotMatch(source, /loadSystemFonts:\s*true/)
    const template = readFileSync(join(site, 'assets/card.svg'), 'utf8')
    assert.match(template, new RegExp(`font-family: '?${cards.fontFamily}'?;`))
})

test('a card is the same bytes every time it is rendered', async () => {
    const title = 'C++ for WebAssembly: Emscripten, WASI and wasmtime'
    const first = await cards.renderCard(title)
    const second = await cards.renderCard(title)
    assert.equal(Buffer.compare(first, second), 0)
    assert.deepEqual([first.readUInt32BE(16), first.readUInt32BE(20)], [1200, 630])
})
