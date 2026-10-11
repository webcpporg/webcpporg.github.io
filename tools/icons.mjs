// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The site's icons and its favicon, which the build's --render step writes, every one rendered
// from assets/logo.svg by @resvg/resvg-js, so that no image is drawn twice:
//
//   assets/icons/icon-accent-<size>.png     the app icons, 192 and 512 px, on the accent;
//   assets/icons/apple-touch-icon.png       180 px, on the accent;
//   favicon.ico                             16, 32 and 48 px, on the accent, at the site's root;
//   assets/logo-light.svg                   the mark in the light theme's colours alone, which the
//                                           header of the libraries' light pages shows.
//
// resvg reads no media query, so the mark's colours are set here for its ground. The accent reads
// in either theme, so one ground serves both: a web manifest cannot choose its icons by colour
// scheme. The app icons are square and full-bleed, the mark inside the safe zone of a maskable
// icon (a circle of 80% of the side), so that a platform rounds or masks them itself.
// The favicon is the fallback of the SVG favicon (the logo itself, whose media query follows the
// browser's theme): on the accent, it reads on a light tab and on a dark one, and a browser that
// asks the site's root for favicon.ico, as the libraries' pages leave it to, finds it.

import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {Resvg} from '@resvg/resvg-js'
import {drawing, withoutMediaQueries} from './drawing.mjs'

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The ground and the mark's colours on it, the arms and the globe in `ink`, the angle brackets in
 * `accent`: white, 6.65 to 1 on the accent, and black, 3.16.
 * Tip: the site's near-black ink, #1d1d1f, would give the angle brackets 2.53, under a graphic's 3.
 */
export const grounds = {
    accent: {ground: '#5b3fd9', ink: '#ffffff', accent: '#000000'},
}

/** The app icons' sizes, the Apple touch icon's and the favicon's. */
export const appSizes = [192, 512]
export const appleSize = 180
export const faviconSizes = [16, 32, 48]

/** The mark's share of an app icon's side, and of the favicon's, whose tile is rounded. */
const appScale = 0.625
const faviconScale = 0.875
const faviconRadius = 12

/**
 * The SVG of the mark on `ground`'s colours, on a 64 by 64 tile with corners of `radius`, the
 * mark scaled to `scale` of the side about its centre.
 */
export function iconSvg(logo, ground, scale, radius = 0) {
    const {ground: fill, ink, accent} = grounds[ground]
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
        `<style>.ink { stroke: ${ink}; } .acc { stroke: ${accent}; }</style>` +
        `<rect width="64" height="64" rx="${radius}" fill="${fill}"/>` +
        `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${drawing(logo)}</g>` +
        '</svg>'
}

/** `svg` rendered by resvg, `size` pixels square: its PNG and its RGBA pixels. */
export function render(svg, size) {
    const image = new Resvg(svg, {fitTo: {mode: 'width', value: size}}).render()
    return {png: image.asPng(), pixels: image.pixels, width: image.width, height: image.height}
}

/**
 * An ICO of the given PNGs, each its own image: the format's header, a directory entry per image,
 * then the PNGs as they are, which every browser that reads an ICO accepts.
 */
export function ico(images) {
    const header = Buffer.alloc(6)
    header.writeUInt16LE(0, 0)
    header.writeUInt16LE(1, 2)
    header.writeUInt16LE(images.length, 4)
    let offset = 6 + 16 * images.length
    const entries = images.map(({size, png}) => {
        const entry = Buffer.alloc(16)
        entry.writeUInt8(size >= 256 ? 0 : size, 0)
        entry.writeUInt8(size >= 256 ? 0 : size, 1)
        entry.writeUInt16LE(1, 4)
        entry.writeUInt16LE(32, 6)
        entry.writeUInt32LE(png.length, 8)
        entry.writeUInt32LE(offset, 12)
        offset += png.length
        return entry
    })
    return Buffer.concat([header, ...entries, ...images.map(image => image.png)])
}

/**
 * assets/logo.svg with the light theme's colours alone: its stylesheet without the media query
 * that turns it dark, so that it is light whatever the browser makes of an image's colour scheme.
 */
export function lightLogo(logo) {
    return logo.replace(/<style>([\s\S]*?)<\/style>/, (_, css) => `<style>${withoutMediaQueries(css)}</style>`)
}

/** Every icon, as `{file, data}`, `file` from the site's root. */
export async function icons() {
    const logo = await readFile(join(site, 'assets/logo.svg'), 'utf8')
    const files = []
    for (const size of appSizes) {
        files.push({file: `assets/icons/icon-accent-${size}.png`, data: render(iconSvg(logo, 'accent', appScale), size).png})
    }
    files.push({file: 'assets/icons/apple-touch-icon.png', data: render(iconSvg(logo, 'accent', appScale), appleSize).png})
    const favicon = iconSvg(logo, 'accent', faviconScale, faviconRadius)
    files.push({file: 'favicon.ico', data: ico(faviconSizes.map(size => ({size, png: render(favicon, size).png})))})
    files.push({file: 'assets/logo-light.svg', data: Buffer.from(lightLogo(logo))})
    return files
}

/** Writes every icon under `out`. */
export async function writeIcons(out) {
    for (const {file, data} of await icons()) {
        const path = join(out, file)
        await mkdir(dirname(path), {recursive: true})
        await writeFile(path, data)
    }
}
