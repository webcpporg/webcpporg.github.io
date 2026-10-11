// Copyright (c) 2026 WebCpp.org
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// https://www.boost.org/LICENSE_1_0.txt)

/**
 * What the site's bundles hold in place of @openuidev/lang-core's telemetry (its
 * src/telemetry/runtime.ts, which posts to PostHog when the environment asks): the four functions
 * the rest of lang-core calls, doing nothing.
 * Tip: tools/build.mjs puts it there, so that neither bundle carries the analytics' host or key.
 */
export function recordSystemPromptGeneration(): void {}

export function prepareParserParseTelemetry(): undefined {
    return undefined
}

export function captureParserParseResult(): void {}

export function captureParserParseException(): void {}
