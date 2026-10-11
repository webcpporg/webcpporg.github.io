// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The site's build, the npm script `build`:
//
//   build.mjs --bundle
//       bundles src/server.tsx into build/server.mjs, which renders the pages and which the
//       tests import, and src/client.tsx into build/client/site.js, which the browser runs;
//   build.mjs --render --pages <dir> --out <dir> --context <file.json>
//       renders every <dir>/**/*.oui into <out>/<path>/index.html with the context the file
//       holds, and copies assets/ and the client bundle into <out>/assets/.
//
// Both steps may be given at once; --bundle runs first. A fault of a page prints
// `<file>:<line>: <message>` and exits 1.
//
// Both bundles define process.env.NODE_ENV as "production": OpenUI's web entry mounts a
// devtools widget, fetched from a CDN, in development, and only the define drops it. OpenUI and
// zod are bundled into the server too, so that its test reads the code the browser runs.

import {cp, mkdir, readdir, readFile, writeFile} from 'node:fs/promises'
import {dirname, join, relative, resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {parseArgs} from 'node:util'

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function bundle() {
    const esbuild = await import('esbuild')
    const common = {
        bundle: true,
        jsx: 'automatic',
        define: {'process.env.NODE_ENV': '"production"'},
        logLevel: 'warning',
        absWorkingDir: site,
    }
    await esbuild.build({
        ...common,
        entryPoints: ['src/server.tsx'],
        outfile: 'build/server.mjs',
        platform: 'node',
        format: 'esm',
        external: ['react', 'react-dom'],
    })
    await esbuild.build({
        ...common,
        entryPoints: ['src/client.tsx'],
        outfile: 'build/client/site.js',
        platform: 'browser',
        format: 'esm',
        minify: true,
    })
}

/** Every `.oui` file under `directory`, as paths relative to it, sorted. */
async function pagesUnder(directory) {
    const entries = await readdir(directory, {recursive: true, withFileTypes: true})
    return entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.oui'))
        .map(entry => relative(directory, join(entry.parentPath, entry.name)))
        .sort()
}

/** `index.oui` is the home, `libraries.oui` is `libraries/`, `a/b.oui` is `a/b/`. */
function pathOf(page) {
    const name = page.split('\\').join('/').replace(/\.oui$/, '')
    return name === 'index' ? '' : name.replace(/\/index$/, '') + '/'
}

async function render({pages, out, context: contextFile}) {
    // OpenUI's parser can send telemetry from node when the environment asks for it; the build
    // reaches no network, whatever the environment says.
    process.env.OPENUI_TELEMETRY_DISABLED = '1'
    const {renderPage, PageError} = await import(pathToFileURL(join(site, 'build/server.mjs')).href)
    const context = JSON.parse(await readFile(contextFile, 'utf8'))
    for (const page of await pagesUnder(pages)) {
        const path = pathOf(page)
        const file = join(pages, page)
        const root = '../'.repeat(path.split('/').filter(Boolean).length)
        try {
            const html = renderPage(file, await readFile(file, 'utf8'), {...context, root, path})
            await mkdir(join(out, path), {recursive: true})
            await writeFile(join(out, path, 'index.html'), html)
        } catch (error) {
            if (error instanceof PageError) {
                console.error(`${error.file}:${error.line}: ${error.message}`)
                process.exit(1)
            }
            throw error
        }
    }
    await cp(join(site, 'assets'), join(out, 'assets'), {recursive: true})
    await cp(join(site, 'build/client/site.js'), join(out, 'assets/site.js'))
}

const {values} = parseArgs({
    options: {
        bundle: {type: 'boolean', default: false},
        render: {type: 'boolean', default: false},
        pages: {type: 'string'},
        out: {type: 'string'},
        context: {type: 'string'},
    },
})
if (!values.bundle && !values.render) {
    console.error('usage: build.mjs [--bundle] [--render --pages <dir> --out <dir> --context <file.json>]')
    process.exit(2)
}
if (values.render && !(values.pages && values.out && values.context)) {
    console.error('build.mjs: --render needs --pages, --out and --context')
    process.exit(2)
}
if (values.bundle) {
    await bundle()
}
if (values.render) {
    await render(values)
}
