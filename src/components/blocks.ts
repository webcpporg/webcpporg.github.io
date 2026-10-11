// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import * as z from 'zod'
import {Code} from './code.js'
import {Doors} from './doors.js'
import {LibraryTable} from './library_table.js'
import {Link} from './link.js'
import {Roadmap} from './roadmap.js'
import {Targets} from './targets.js'
import {Text} from './text.js'

/** What a section holds: every block but a section or a hero. */
export const block = z.union([Text.ref, Code.ref, Link.ref, Doors.ref, Targets.ref, LibraryTable.ref, Roadmap.ref])
