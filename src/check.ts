// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

import {createParser, type ElementNode} from '@openuidev/react-lang'
import {limits} from './head.js'
import {library} from './library.js'

/** A fault of a page's source, at a line of its file; the build prints it as `file:line: message`. */
export class PageError extends Error {
    readonly file: string
    readonly line: number

    constructor(file: string, line: number, message: string) {
        super(message)
        this.name = 'PageError'
        this.file = file
        this.line = line
    }
}

const schema = library.toJSONSchema()
const parser = createParser(schema, library.root)

/**
 * Checks a page's OpenUI Lang and returns its root, a Page: first the parse (a fault OpenUI
 * reports, a reference to no statement, a statement no one uses, a root that is not a Page),
 * then where each component stands and the links, then the head's limits. The first fault throws
 * a PageError.
 * Tip: OpenUI renders what it can and drops the rest, so a fault the build lets pass would be a
 * page silently missing a part.
 */
export function checkPage(file: string, source: string): ElementNode {
    const result = parser.parse(source)
    const lines = new Lines(source)
    const fault = (line: number, message: string) => new PageError(file, line, message)
    if (result.meta.incomplete) {
        throw fault(lines.last(), 'the page ends inside a call, a list or a string')
    }
    const [error] = result.meta.errors
    if (error) {
        const line = lines.naming(error.component, error.statementId)
        throw error.code === 'unknown-component'
            ? fault(line, `${error.component} is not a component of the site's library`)
            : fault(line, `${error.component}: ${error.message}`)
    }
    const [unresolved] = result.meta.unresolved
    if (unresolved) {
        throw fault(lines.naming(unresolved), `${unresolved} names no statement of the page`)
    }
    const [orphaned] = result.meta.orphaned
    if (orphaned) {
        throw fault(lines.statement(orphaned), `${orphaned} is defined but no block of the page uses it`)
    }
    const root = result.root
    if (!root || root.typeName !== library.root) {
        throw fault(lines.statement('root'), `the page's root is not a ${library.root}(title, description, body)`)
    }
    for (const {node, parent, index} of walk(root)) {
        const where = () => lines.naming(node.typeName, node.statementId ?? parent?.statementId)
        if (node.typeName === 'Hero' && (parent !== root || index !== 0)) {
            throw fault(where(), 'a Hero is the first block of the page, and only there')
        }
        for (const [prop, value] of Object.entries(node.props)) {
            const allowed = componentsOf(node.typeName, prop)
            for (const child of elements(value)) {
                if (!allowed.has(child.typeName)) {
                    throw fault(lines.naming(child.typeName, child.statementId ?? node.statementId),
                        `${node.typeName}'s ${prop} holds no ${child.typeName}`)
                }
            }
        }
        if (node.typeName === 'Link' && String(node.props.href).startsWith('/')) {
            throw fault(where(), `${node.props.href}: a link inside the site is relative to the site's root, never from the server's root`)
        }
    }
    const {title, description} = root.props as {title: string; description: string}
    const outside = limits(title, description)
    if (outside) {
        throw fault(lines.statement('root'), outside)
    }
    return root
}

/** Every element of the tree under `root`, each with its parent and its place among its siblings. */
function* walk(node: ElementNode, parent?: ElementNode, index = 0): Generator<{node: ElementNode; parent?: ElementNode; index: number}> {
    yield {node, parent, index}
    for (const value of Object.values(node.props)) {
        let position = 0
        for (const child of elements(value)) {
            yield* walk(child, node, position++)
        }
    }
}

function elements(value: unknown): ElementNode[] {
    const values = Array.isArray(value) ? value : [value]
    return values.filter((item): item is ElementNode => typeof item === 'object' && item !== null && (item as ElementNode).type === 'element')
}

/** The components the schema lets a component's prop hold, from the `$ref`s under it. */
function componentsOf(component: string, prop: string): Set<string> {
    const defs = schema.$defs as Record<string, {properties?: Record<string, unknown>}>
    const names = new Set<string>()
    const visit = (value: unknown) => {
        if (Array.isArray(value)) {
            value.forEach(visit)
        } else if (typeof value === 'object' && value !== null) {
            for (const [key, inner] of Object.entries(value)) {
                if (key === '$ref' && typeof inner === 'string') {
                    names.add(inner.replace('#/$defs/', ''))
                } else {
                    visit(inner)
                }
            }
        }
    }
    visit(defs[component]?.properties?.[prop])
    return names
}

/**
 * The lines of a page's source, read the way OpenUI's lexer reads them: the words outside its
 * strings, and the statements that start on each.
 */
class Lines {
    private readonly words: Set<string>[] = []
    private readonly starts = new Map<string, number>()

    constructor(source: string) {
        let quote = ''
        let line = 0
        let text = ''
        let inString = false
        const end = () => {
            this.words[line] = new Set(text.match(/[A-Za-z_$][\w$]*/g) ?? [])
            const start = inString ? null : /^\s*([A-Za-z_$][\w$]*)\s*=(?!=)/.exec(text)
            if (start && !this.starts.has(start[1])) {
                this.starts.set(start[1], line + 1)
            }
            line += 1
            text = ''
            inString = quote !== ''
        }
        for (let i = 0; i < source.length; i++) {
            const character = source[i]
            if (character === '\n') {
                end()
            } else if (quote) {
                if (character === '\\') {
                    i += 1
                    if (source[i] === '\n') {
                        end()
                    }
                } else if (character === quote) {
                    quote = ''
                    text += ' '
                }
            } else if (character === '"' || character === "'") {
                quote = character
                text += ' '
            } else {
                text += character
            }
        }
        end()
    }

    /** The line of the last statement, where an unclosed call or string runs to the end. */
    last(): number {
        return Math.max(1, ...this.starts.values())
    }

    /** The line where statement `id` starts, or 1. */
    statement(id: string): number {
        return this.starts.get(id) ?? 1
    }

    /** The first line naming `word`, from where statement `id` starts when one is given. */
    naming(word: string, id?: string): number {
        const from = id ? this.statement(id) - 1 : 0
        const index = this.words.findIndex((words, line) => line >= from && words.has(word))
        return index < 0 ? this.statement(id ?? '') : index + 1
    }
}
