// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import type {SiteContext} from './context.js'

/** The site's pages the header links to, by their path from the root. */
const sections = [
    {name: 'Libraries', path: 'libraries/'},
    {name: 'C++', path: 'cpp/'},
    {name: 'JavaScript', path: 'javascript/'},
    {name: 'AI', path: 'ai/'},
    {name: 'Examples', path: 'examples/'},
    {name: 'Report', path: 'report/'},
    {name: 'Community', path: 'community/'},
    {name: 'Search', path: 'search/'},
]

/**
 * What the shell writes around every page, and around every library's page: the header with the
 * logo and the navigation, then the channel's band.
 * Tip: it is the shell's, not the page's, so it is rendered once on the server and never hydrated.
 */
export function Top({site}: {site: SiteContext}) {
    return (
        <>
            <header className="site">
                <a className="logo" href={site.root || './'}>
                    {/* In a picture, so that React writes no preload link before the header for it. */}
                    <picture><img src={`${site.root}assets/logo.svg`} alt="webcpp" width="112" height="28" /></picture>
                </a>
                <nav aria-label="The site">
                    {sections.map(section => (
                        <a key={section.path} href={site.root + section.path}
                            aria-current={section.path === site.path ? 'page' : undefined}>{section.name}</a>
                    ))}
                </nav>
            </header>
            <Band site={site} />
        </>
    )
}

/** Which build of the site this is: the commit on preview, the version on release. */
function Band({site}: {site: SiteContext}) {
    if (site.channel === 'release') {
        return <p className="band">webcpp {site.version}</p>
    }
    return <p className="band">Preview of main at <code>{site.commit.slice(0, 7)}</code>, {site.date}</p>
}

export function Bottom() {
    return (
        <footer className="site">
            <p>
                webcpp is free software, under the <a href="https://www.boost.org/LICENSE_1_0.txt">Boost
                Software License 1.0</a>. Its source is <a href="https://github.com/webcpporg/webcpp">on
                GitHub</a>.
            </p>
        </footer>
    )
}
