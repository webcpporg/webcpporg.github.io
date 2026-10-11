// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {createLibrary} from '@openuidev/react-lang'
import {Code} from './components/code.js'
import {Doors} from './components/doors.js'
import {Hero} from './components/hero.js'
import {LibraryTable} from './components/library_table.js'
import {Link} from './components/link.js'
import {Page} from './components/page.js'
import {Roadmap} from './components/roadmap.js'
import {Section} from './components/section.js'
import {Targets} from './components/targets.js'
import {Text} from './components/text.js'

/** Every component a page of the site may name; a page's root is a Page. */
export const library = createLibrary({
    components: [Page, Hero, Section, Text, Code, Link, Doors, Targets, LibraryTable, Roadmap],
    root: 'Page',
})
