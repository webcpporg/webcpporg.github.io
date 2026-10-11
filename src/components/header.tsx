// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {defineComponent} from '@openuidev/react-lang'
import * as z from 'zod'
import {useShared} from '../context.js'

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
 * The site's header, the logo and the navigation, which every page's Page and every library's
 * page (renderFragment's `docs-header`) show. On a phone the navigation folds under a Menu, which
 * opens and closes with no script: the `<details>` before it holds only its summary, and the
 * stylesheet hides the navigation while the details are closed.
 */
export const Header = defineComponent({
    name: 'Header',
    description: 'The site\'s header: the logo and the navigation. A Page places it; a page never names it.',
    props: z.object({}),
    component: function SiteHeader() {
        const {site} = useShared()
        return (
            <header className="site">
                <a className="logo" href={site.root || './'}>
                    {/* In a picture, so that React writes no preload link before the header for it. */}
                    <picture><img src={`${site.root}assets/logo.svg`} alt="" width="28" height="28" /></picture>
                    <span>webcpp</span>
                </a>
                <details className="menu">
                    <summary>
                        <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M2 5H16M2 9H16M2 13H16" /></svg>
                        Menu
                    </summary>
                </details>
                <nav aria-label="The site">
                    {sections.map(section => (
                        <a key={section.path} href={site.root + section.path}
                            aria-current={section.path === site.path ? 'page' : undefined}>{section.name}</a>
                    ))}
                </nav>
            </header>
        )
    },
})
