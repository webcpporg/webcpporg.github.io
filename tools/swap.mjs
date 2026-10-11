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
// makes <link> a link to <build>, an existing directory of <link>.builds/ (bin/site.builds/ for
// bin/site), with one rename (pointTo), then removes every other build-* of that directory: the
// one the link pointed to before, and any left by a run that stopped between building and
// swapping. Nothing else is ever removed: a <build> that is not an existing directory of
// <link>.builds/ is refused, exit 2, before anything is touched. A server reading through the link
// resolves it on every request, so it reads either build whole, never a half of one, and never
// finds the link gone (POSIX; on Windows pointTo's own gap, which serve.mjs waits for). A link that
// is a real directory, the layout bin/site had before it was a link, is replaced. The link's
// target is relative, so that a checkout moved elsewhere still reads it.
//
// On POSIX a build removed while a server still streams a file of it is no matter: the open file
// lives on until the stream ends. Windows refuses to remove a file that is open (EBUSY, EPERM):
// that build is then left, named on the standard error, for the next swap to remove.

import {existsSync, realpathSync} from 'node:fs'
import {lstat, readdir, readlink, rename, rm, stat, symlink} from 'node:fs/promises'
import {basename, dirname, join, relative, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

/**
 * Makes `link` point to `target` (an absolute path), replacing what it pointed to before, with
 * one rename of a link of its own, never of `link` itself until that rename: a symbolic link
 * (`dir`) to `target` relative from the link, or, where Windows refuses one, a junction, whose
 * target is absolute, as tools/node/install.py's made_link does.
 * POSIX renames a link onto another atomically, so link is never briefly gone; Windows renames no
 * link onto one that is already there, so it is removed first, a real (if short) gap, which
 * serve.mjs's own retry is for. Returns the previous target, absolute, or null for none.
 *
 * Tip: a `${link}.next-<pid>` left by a run that crashed between creating it and the final rename
 * is cleaned up first, so it never piles up across runs: only such a name, and only a link, never
 * an entry of someone else's that merely shares the name; and when `link` itself exists but is not
 * a symlink, it is an earlier layout's build output (dev.mjs once built straight into it), never a
 * target this function swapped in, so it is disposable and removed outright rather than renamed
 * onto, which rename(2) refuses with EISDIR for a non-empty directory.
 */
export async function pointTo(link, target) {
    const dir = dirname(link)
    const prefix = `${basename(link)}.next-`
    for (const entry of await readdir(dir).catch(() => [])) {
        const pid = entry.startsWith(prefix) ? entry.slice(prefix.length) : ''
        if (/^\d+$/.test(pid) && (await lstat(join(dir, entry)).catch(() => null))?.isSymbolicLink()) {
            await rm(join(dir, entry), {force: true})
        }
    }
    const read = await readlink(link).catch(() => null)
    const previous = read === null ? null : resolve(dir, read)
    if (previous === null && existsSync(link)) {
        await rm(link, {recursive: true, force: true})
    }
    const next = `${link}.next-${process.pid}`
    let linked = false
    try {
        try {
            await symlink(relative(dir, target), next, 'dir')
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

/** A swap refused before anything is touched: the script's exit 2. */
export class Refused extends Error {}

/**
 * Points `link` to `build` (pointTo), then removes every other build-* of `${link}.builds`: the
 * one `link` pointed to before, and any stale one. Returns the previous target, or null for none.
 * Throws Refused, having touched nothing, for a `build` that is not an existing directory of
 * `${link}.builds`.
 */
export async function swap(link, build) {
    const at = resolve(link)
    const target = resolve(build)
    const builds = `${at}.builds`
    if (!(await stat(target).catch(() => null))?.isDirectory()) {
        throw new Refused(`${target} is not a directory: name a build that exists`)
    }
    if (dirname(target) !== builds) {
        throw new Refused(`${target} is not a build of ${builds}, the one directory whose builds swap removes`)
    }
    const previous = await pointTo(at, target)
    for (const entry of await readdir(builds)) {
        const path = join(builds, entry)
        if (entry.startsWith('build-') && path !== target) {
            await rm(path, {recursive: true, force: true}).catch(error => {
                console.error(`swap.mjs: ${path} is left for the next swap: ${error.message}`)
            })
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
    try {
        await swap(resolve(from, link), resolve(from, build))
    } catch (error) {
        if (!(error instanceof Refused)) {
            throw error
        }
        console.error(`swap.mjs: ${error.message}`)
        process.exit(2)
    }
}
