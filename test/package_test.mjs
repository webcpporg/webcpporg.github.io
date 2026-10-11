// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)))
const pinned = {
    'node_modules/@openuidev/react-lang': '0.4.1',
    'node_modules/react': '19.3.0',
    'node_modules/react-dom': '19.3.0',
    'node_modules/zod': '4.6.5',
    'node_modules/esbuild': '0.28.2',
    'node_modules/html-validate': '11.16.2',
    'node_modules/@resvg/resvg-js': '2.6.2',
    'node_modules/xstate': '5.33.2',
}

test('the lockfile pins the versions the plan names', () => {
    for (const [path, version] of Object.entries(pinned)) {
        assert.equal(lock.packages[path]?.version, version, path)
    }
})

test('every npm ci the README shows turns the install telemetry off', () => {
    // @openuidev/lang-core's postinstall reports each install to PostHog unless this is set.
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
    const installs = readme.split('\n').filter(line => /\bnpm ci\b/.test(line))
    assert.ok(installs.length > 0, 'the README shows npm ci')
    for (const line of installs) {
        assert.match(line, /OPENUI_TELEMETRY_DISABLED=1 npm ci\b/, line)
    }
})
