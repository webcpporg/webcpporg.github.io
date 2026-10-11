// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

// The swap script, the npm script `swap`, through which b2 site moves each build it finishes onto
// bin/site (tools/site/site.jam at the superproject), as dev.mjs moves its own onto build/dev/site:
//
//   swap.mjs <link> <build>
//
// makes <link> a link to <build>, a directory of its own beside every other build, with one
// rename (pointTo), then removes every other build of that directory: the one the link pointed to
// before, and any left by a run that stopped between building and swapping. A server reading
// through the link resolves it on every request, so it reads either build whole, never a half of
// one, and never finds the link gone (POSIX; on Windows pointTo's own gap, which serve.mjs waits
// for). A link that is a real directory, the layout bin/site had before it was a link, is
// replaced. Exits 2 on a usage error.

import {existsSync, realpathSync} from 'node:fs'
import {readdir, readlink, rename, rm, symlink} from 'node:fs/promises'
import {basename, dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

/**
 * Makes `link` point to `target` (an absolute path), replacing what it pointed to before, with
 * one rename of a link of its own, never of `link` itself until that rename: a symbolic link
 * (`dir`) or, where Windows refuses one, a junction, as tools/node/install.py's made_link does.
 * POSIX renames a link onto another atomically, so link is never briefly gone; Windows renames no
 * link onto one that is already there, so it is removed first, a real (if short) gap, which
 * serve.mjs's own retry is for. Returns the previous target, absolute, or null for none.
 *
 * Tip: a `${link}.next-<pid>` left by a run that crashed between creating it and the final rename
 * is cleaned up first, so it never piles up across runs; and when `link` itself exists but is not
 * a symlink, it is an earlier layout's build output (dev.mjs once built straight into it), never a
 * target this function swapped in, so it is disposable and removed outright rather than renamed
 * onto, which rename(2) refuses with EISDIR for a non-empty directory.
 */
export async function pointTo(link, target) {
    const dir = dirname(link)
    const prefix = `${basename(link)}.next-`
    for (const entry of await readdir(dir).catch(() => [])) {
        if (entry.startsWith(prefix)) {
            await rm(join(dir, entry), {recursive: true, force: true})
        }
    }
    const previous = await readlink(link).catch(() => null)
    if (previous === null && existsSync(link)) {
        await rm(link, {recursive: true, force: true})
    }
    const next = `${link}.next-${process.pid}`
    let linked = false
    try {
        try {
            await symlink(target, next, 'dir')
        } catch (error) {
            if (process.platform !== 'win32') {
                throw error
            }
            await symlink(target, next, 'junction')
        }
        if (process.platform === 'win32' && existsSync(link)) {
            await rm(link, {recursive: true, force: true})
        }
        await rename(next, link)
        linked = true
    } finally {
        if (!linked) {
            await rm(next, {recursive: true, force: true})
        }
    }
    return previous
}

/**
 * Points `link` to `build` (pointTo), then removes every other entry of `build`'s directory, which
 * holds builds alone: the one `link` pointed to before, and any stale one. Returns the previous
 * target, or null for none.
 */
export async function swap(link, build) {
    const target = resolve(build)
    const previous = await pointTo(resolve(link), target)
    const builds = dirname(target)
    for (const entry of await readdir(builds)) {
        if (join(builds, entry) !== target) {
            await rm(join(builds, entry), {recursive: true, force: true})
        }
    }
    return previous
}

// node resolves this module's own path through links, and argv[1] keeps them: compared as real
// paths, a script started through a path that holds a link (a checkout under /var on macOS) runs.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [link, build, ...rest] = process.argv.slice(2)
    if (!link || !build || rest.length > 0) {
        console.error('usage: swap.mjs <link> <build>')
        process.exit(2)
    }
    // A relative path is read from the directory npm was started in, as serve.mjs reads its own.
    const from = process.env.INIT_CWD ?? process.cwd()
    await swap(resolve(from, link), resolve(from, build))
}
