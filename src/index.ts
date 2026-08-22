import type { BaseNodeData, CaudexOpts } from './types';
import { BaseAPI, base, compose } from './base';
import { TreeAPI, tree } from './tree';
import { WebAPI, web } from './web';
import { PhaseAPI, phase } from './phase';

export { base, compose, createBase, extendAPI, initCtx, seedItems } from './base';
export type { Base, BaseAPI, CaudexCtx, LayerFn } from './base';
export { createTree, tree } from './tree';
export type { TreeAPI } from './tree';
export { createWeb, web } from './web';
export type { WebAPI } from './web';
export { phase } from './phase';
export type { PhaseAPI } from './phase';
export { Node } from './node';
export { DerivedIndex, NodeStore } from './store';
export type { ChangeEvent, ChangeKind, ChangeListener, DefineIndexOpts, StoragePort } from './store';
export type { Edge, EdgeQueryOpts } from './edge';
export * from './const';
// the node/graph vocabulary as lightweight string-union types (derived from the
// const.ts enums), for consumers that want the words. `import type` erases these,
// so no runtime/engine is pulled — no separate subpath needed.
export type { NodeState, NodePhase, ResolvedLink } from './contract';
export type { FilterOpts, PayloadOpt, QueryOpts, ConnectOpts, DisconnectOpts } from './types';

// the full composition: functions over hashes. Layer functions (base / tree /
// web / phase) each close over the shared context and return an API slice;
// compose folds them into ONE plain object (getter-preserving -- see
// extendAPI). 'phase' sits atop tree + web: phase is a cross-axis concern
// (see phase.ts).
export type Caudex = BaseAPI & TreeAPI & WebAPI & PhaseAPI;

export const create: (items: BaseNodeData[] | any[], opts?: Partial<CaudexOpts>) => Caudex =
  compose([base, tree, web, phase]);
