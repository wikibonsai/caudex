// caudex/contract — the node/graph vocabulary as lightweight, dependency-free types
// for consumers (almanac, tendr-app, tendr-cli, vscode-tendr) that need the WORDS
// without pulling the index engine.
//
// SINGLE SOURCE: the string-union types are DERIVED from const.ts's enums via
// template-literal types, so they can never drift from NODE.STATE / NODE.PHASE —
// no duplicate declaration, no guard test; the type *is* the enum's value set.

import type { NODE } from './const';

/** docstate ladder (void -> zombie -> live), derived from NODE.STATE. */
export type NodeState = `${NODE.STATE}`;

/** graph-integration phase (isolate -> orphan/spur -> integrated), derived from NODE.PHASE. */
export type NodePhase = `${NODE.PHASE}`;

/**
 * A wikiref target resolved against the index: identity + state, with the uri
 * payload for live targets. The standard projection of a resolution.
 */
export interface ResolvedLink {
  filename: string;
  uri: string | null;
  state: NodeState;
}
