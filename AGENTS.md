# Working on the site

Read the superproject's `CODING-GUIDELINES.md` and its `AGENTS.md` first.
This file holds only what is specific to this repository.

- Pages are written in OpenUI Lang, under `pages/`.
- Components are React, each with its props validated by a zod schema: the
  design system the pages' components import.
- The client bundle the site ships is a production build: no development
  warning, no unminified source, reaches the browser.
- A link between pages is relative, never absolute: the site serves from
  whichever path it is published under.
- Nothing on a page is typed twice: a value the build already knows, such
  as a library's name or a count from its own build, is read from it rather
  than written again on the page.
