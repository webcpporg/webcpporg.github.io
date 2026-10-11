# webcpp's site

This is the source of [webcpp](https://github.com/webcpporg/webcpp)'s site,
built with webcpp: its pages are OpenUI Lang, rendered by components written
in webcpp's own React port, and its live examples run the same C++ the
superproject's libraries ship, compiled to WebAssembly. `b2 site`, at the
superproject, assembles this repository's pages with every library's doc
page into one static site.

There are two ways into this repository, for two different readers.

## For JavaScript developers

**Path 1, the examples and pages, with npm alone:**

    OPENUI_TELEMETRY_DISABLED=1 npm ci
    npm run dev
    npm test

`OPENUI_TELEMETRY_DISABLED=1` keeps OpenUI's install script from reporting
the install to its analytics, as `b2` does for every install it makes.

`npm run dev` needs no C++ toolchain: it serves the examples' wasm already
built, from `bin/site/` when the superproject built it locally, or else the
wasm the published preview serves, downloaded once into `build/dev/` and
checked against the preview's `precache.json`. A JavaScript developer
changes pages, components and the examples' own JavaScript this way, without
installing b2, Boost or a C++ compiler.

**Path 2, the whole project,** taught step by step, as for someone who has
never built C++. Install, each at the exact version the superproject's
`README.md` gives:

- b2, Boost 1.92 or newer and a C++20 compiler;
- wasi-sdk 34 and wasmtime 47, for the WebAssembly components the examples
  run;
- Node, which this repository's own build uses the way the superproject's
  documentation does.

Then:

    git clone --recursive https://github.com/webcpporg/webcpp
    cd webcpp/site
    b2 site-serve

## For C++ developers

b2 alone, from the superproject's root:

| Command | What it does |
| --- | --- |
| `b2 site` | builds the site into `bin/site/` |
| `b2 site-serve` | builds the site and serves it locally |
| `b2 /webcpp/site//test` | the site's own tests |

Node is one more tool b2 runs, the way it runs Python for the documentation:
no npm command, no `package.json` and no bundler is named here, because a
C++ developer never runs one directly.

## Layout

| Path | Purpose |
| --- | --- |
| `Jamfile` | the site's targets; `b2 site`, at the superproject, runs them |
| `package.json`, `package-lock.json` | the site's own node dependencies, pinned |
| `pages/` | the site's pages, in OpenUI Lang: `index.oui` is the home, `<name>.oui` the page `<name>/` |
| `src/` | the components pages are written with, and the renderer: `server.tsx` prerenders a page, `client.tsx` hydrates it in the browser |
| `assets/` | the styles, the logo and `card.svg`, the social cards' template, copied to the site's `assets/` |
| `seo/queries.json` | the searches the site answers, each with the page that answers it, which a test checks |
| `tools/build.mjs` | the `build` script: the bundles, and the pages rendered to HTML with their social cards (`tools/cards.mjs`) |
| `tools/indexing.mjs` | `robots.txt`, `sitemap.xml`, `llms.txt` and `libraries.json`, written once `b2 site` has laid the whole site out |
| `test/` | the site's checks, and `fixtures/catalogue.json`, the catalogue they render the pages with |
