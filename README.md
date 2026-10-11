# webcpp's site

This is the source of [webcpp](https://github.com/webcpporg/webcpp)'s site,
built with webcpp: its pages are OpenUI Lang, rendered to static HTML by the
site's own components and hydrated by them in the browser, and its live
examples will run the same C++ the superproject's libraries ship, compiled to
WebAssembly. At the superproject's root, `b2 site` builds the whole site into
`bin/site/`: this repository's pages with every library's page and the test
report. Only that build is ever published.

There are two ways into this repository, for two different readers, and
neither needs the other's tools.

## For JavaScript developers

**Path 1, the examples and pages, with npm alone,** in a clone of this
repository:

    OPENUI_TELEMETRY_DISABLED=1 npm ci
    npm run dev
    npm test
    npm run typecheck

`OPENUI_TELEMETRY_DISABLED=1` keeps OpenUI's install script from reporting
the install to its analytics, as the superproject's build does for every
install it makes.

`npm run dev` builds the pages with the catalogue of `test/fixtures/`, serves
them at http://127.0.0.1:8765/, and builds them again whenever a file under
`pages/`, `src/` or `assets/` changes. It needs no C++ toolchain: the
examples' wasm is the one the superproject built, from `../bin/site/`, when
this repository is the superproject's `site/` and the whole site has been
built there, and otherwise the wasm the published preview serves, downloaded
once into `build/dev/` and checked against the preview's `precache.json`.
That is the only download besides the install; without the network the pages
are still served, without the examples' wasm. A JavaScript developer changes pages,
components and the examples' own JavaScript this way.

`npm run serve -- <dir>` serves a site already built, such as the
superproject's `bin/site`, at http://127.0.0.1:8765/.

**Path 2, the whole project,** step by step, for someone who has never built
C++. It builds the site exactly as it is published: every library's page and
the examples' C++ included. On macOS, with [Homebrew](https://brew.sh):

1. Install B2 5.5.3 (Homebrew's `boost-build` 1.92.0), Boost 1.92.0, node
   26.7.0 and Python:

       brew install boost-build boost node python

   On Linux, install the same versions with your distribution's packages, or
   from [b2](https://github.com/bfgroup/b2/releases/tag/5.5.3),
   [Boost](https://www.boost.org/releases/1.92.0/) and
   [node](https://nodejs.org/dist/v26.7.0/).
2. Install Emscripten 6.0.11 from the emsdk, which compiles the examples' C++
   for the browser:

       git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
       ~/emsdk/emsdk install 6.0.11
       ~/emsdk/emsdk activate 6.0.11

3. Install MrDocs 2026.9.29, which writes each library's API reference, from
   [its release](https://github.com/cppalliance/mrdocs/releases/tag/2026.9.29),
   with its `bin/mrdocs` at `.local/mrdocs/bin/mrdocs` in the superproject
   (step 5) or on `PATH`.
4. Tell b2 where Boost and Emscripten are, in `~/user-config.jam`:

       using clang ;
       using boost : 1.92 : <include>/opt/homebrew/opt/boost/include <library>/opt/homebrew/opt/boost/lib ;
       using emscripten : : /Users/you/emsdk/upstream/emscripten/em++ : <nodejs>/opt/homebrew/bin/node ;

5. Clone the superproject with its libraries and this site, and build and
   serve the whole site:

       git clone --recursive https://github.com/webcpporg/webcpp
       cd webcpp
       unset CPATH CPLUS_INCLUDE_PATH C_INCLUDE_PATH
       b2 site-serve

   It prints the address, http://127.0.0.1:8765/, and serves the site there
   once it is built. The superproject's `README.md` says more about each
   prerequisite.

## For C++ developers

b2 alone, at the superproject's root:

| Command | What it does |
| --- | --- |
| `b2 site` | builds the whole site into `bin/site/`: this repository's pages, every library's page and the report, every link checked |
| `b2 site -sWEBCPP_SITE=release -sWEBCPP_SITE_VERSION=<version>` | the same, for the release channel |
| `b2 site-serve` | builds the site and serves it at http://127.0.0.1:8765/ |
| `b2 /webcpp/site//test` | the site's own tests |

The site's C++ is a project like any user's of webcpp: its wasm's own code
will be in `app/`, its trace points in `include/webcpp_site/`, and each
example in a directory of its own under `examples/`, all built for
Emscripten by `b2 site`.

The prerequisites are the superproject's, Emscripten among them (its
`README.md`), and node, which b2 runs to render the pages the way it runs
Python for the report: one more tool on `PATH`, at version 26.7.0.

## Layout

| Path | Purpose |
| --- | --- |
| `Jamfile` | the site's targets; `b2 site`, at the superproject, runs them |
| `package.json`, `package-lock.json` | the site's own node dependencies, pinned, and its scripts: `build`, `test`, `typecheck`, `dev` and `serve` |
| `pages/` | the site's pages, in OpenUI Lang: `index.oui` is the home, `<name>.oui` the page `<name>/` |
| `src/` | the components pages are written with, and the renderer: `server.tsx` prerenders a page, `client.tsx` hydrates it in the browser |
| `assets/` | the styles, the logo and `card.svg`, the social cards' template, copied to the site's `assets/` |
| `seo/queries.json` | the searches the site answers, each with the page that answers it, which a test checks |
| `tools/build.mjs` | the `build` script: the bundles, the pages rendered to HTML with their social cards (`tools/cards.mjs`), the header of the libraries' pages, and the indexing files (`--index`) |
| `tools/indexing.mjs` | `robots.txt`, `sitemap.xml`, `llms.txt` and `libraries.json`, written once `b2 site` has laid the whole site out |
| `tools/serve.mjs`, `tools/dev.mjs` | the `serve` and `dev` scripts |
| `test/` | the site's checks, and `fixtures/catalogue.json`, the catalogue they and `npm run dev` render the pages with |
