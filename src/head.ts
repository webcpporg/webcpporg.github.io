// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import type {GraphNode, SiteContext} from './context.js'
import {scriptJson} from './source.js'

/** Where each channel is served; the one place the site's URLs are absolute. */
export const bases = {
    preview: 'https://webcpporg.github.io/',
    release: 'https://webcpp.org/',
} as const

export const titleLimit = 60
export const descriptionLimits = [120, 160] as const

/** What the head says about a page, before it is written. */
export type Head = {
    title: string
    description: string
    canonical: string
    image: string
    graph: GraphNode[]
}

/** The fault of a page whose title or description is outside its limits, or null. */
export function limits(title: string, description: string): string | null {
    const full = documentTitle(title)
    if (full.length > titleLimit) {
        return `the title "${full}" is ${full.length} characters, more than ${titleLimit}`
    }
    const [shortest, longest] = descriptionLimits
    if (description.length < shortest || description.length > longest) {
        return `the description is ${description.length} characters, outside ${shortest} to ${longest}`
    }
    return null
}

/**
 * The head of the spec's SEO section, for a page whose Page gives `title` and `description`,
 * within their limits. `graph` holds the nodes the page's components added, after the site's own.
 */
export function describe(site: SiteContext, title: string, description: string, graph: GraphNode[]): Head {
    const full = documentTitle(title)
    const base = bases[site.channel]
    const canonical = base + site.path
    return {
        title: full,
        description,
        canonical,
        image: `${base}cards/${site.path.replace(/\/$/, '') || 'home'}.png`,
        graph: [...siteGraph(base, canonical, title, description, site.path), ...graph],
    }
}

/** The page's subject first, then the site's name. */
function documentTitle(title: string): string {
    return `${title} - webcpp`
}

/** The head's elements, one per line. */
export function writeHead(head: Head): string {
    const meta = (key: 'name' | 'property', name: string, content: string) =>
        `<meta ${key}="${name}" content="${attribute(content)}">`
    const alt = `${head.title}: the page's title beside webcpp's logo`
    return [
        `<title>${text(head.title)}</title>`,
        meta('name', 'description', head.description),
        `<link rel="canonical" href="${attribute(head.canonical)}">`,
        meta('name', 'robots', 'index, follow'),
        meta('property', 'og:title', head.title),
        meta('property', 'og:description', head.description),
        meta('property', 'og:url', head.canonical),
        meta('property', 'og:type', 'website'),
        meta('property', 'og:site_name', 'webcpp'),
        meta('property', 'og:image', head.image),
        meta('property', 'og:image:width', '1200'),
        meta('property', 'og:image:height', '630'),
        meta('property', 'og:image:alt', alt),
        meta('name', 'twitter:card', 'summary_large_image'),
        meta('name', 'twitter:title', head.title),
        meta('name', 'twitter:description', head.description),
        meta('name', 'twitter:image', head.image),
        meta('name', 'twitter:image:alt', alt),
        `<script type="application/ld+json">${scriptJson({'@context': 'https://schema.org', '@graph': head.graph})}</script>`,
    ].join('\n')
}

/** The nodes every page's graph holds: the site, its organization, the page and its breadcrumbs. */
function siteGraph(base: string, canonical: string, title: string, description: string, path: string): GraphNode[] {
    const name = documentTitle(title)
    const segments = path.split('/').filter(Boolean)
    const crumbs = [{name: 'webcpp', item: base}, ...segments.map((segment, i) => ({
        name: i === segments.length - 1 ? title : segment,
        item: base + segments.slice(0, i + 1).join('/') + '/',
    }))]
    return [
        {
            '@type': 'WebSite',
            '@id': `${base}#website`,
            url: base,
            name: 'webcpp',
            inLanguage: 'en',
            publisher: {'@id': `${base}#organization`},
            potentialAction: {
                '@type': 'SearchAction',
                target: {'@type': 'EntryPoint', urlTemplate: `${base}search/?q={search_term_string}`},
                'query-input': 'required name=search_term_string',
            },
        },
        {
            '@type': 'Organization',
            '@id': `${base}#organization`,
            name: 'webcpp',
            url: base,
            logo: `${base}assets/logo.svg`,
            sameAs: ['https://github.com/webcpporg'],
        },
        {
            '@type': 'WebPage',
            '@id': `${canonical}#webpage`,
            url: canonical,
            name,
            description,
            inLanguage: 'en',
            isPartOf: {'@id': `${base}#website`},
            breadcrumb: {'@id': `${canonical}#breadcrumb`},
        },
        {
            '@type': 'BreadcrumbList',
            '@id': `${canonical}#breadcrumb`,
            itemListElement: crumbs.map((crumb, i) => ({'@type': 'ListItem', position: i + 1, ...crumb})),
        },
    ]
}

/** Text escaped for an element's content. */
export function text(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Text escaped for a double-quoted attribute. */
export function attribute(value: string): string {
    return text(value).replace(/"/g, '&quot;')
}
