// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {createLibrary} from '@openuidev/react-lang'
import {Band} from './components/band.js'
import {Code} from './components/code.js'
import {Doors} from './components/doors.js'
import {Footer} from './components/footer.js'
import {Header} from './components/header.js'
import {Hero} from './components/hero.js'
import {LibraryList} from './components/library_list.js'
import {LibraryTable} from './components/library_table.js'
import {Link} from './components/link.js'
import {Page} from './components/page.js'
import {Roadmap} from './components/roadmap.js'
import {SearchForm} from './components/search_form.js'
import {Section} from './components/section.js'
import {Targets} from './components/targets.js'
import {Text} from './components/text.js'

/**
 * Every component of the site; a page's root is a Page. Header, Band and Footer are the Page's own,
 * which no block of a page may hold.
 */
export const library = createLibrary({
    components: [Page, Header, Band, Footer, Hero, Section, Text, Code, Link, Doors, Targets, LibraryTable, LibraryList, Roadmap, SearchForm],
    root: 'Page',
})
