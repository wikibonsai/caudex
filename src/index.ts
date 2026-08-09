import { Base } from './base';
import { Web } from './web';
import { Tree } from './tree';
import { Phase } from './phase';

export { Base } from './base';
export { Web } from './web';
export { Tree } from './tree';
export { Phase } from './phase';
export { Node } from './node';
export { DerivedIndex, NodeStore } from './store';
export type { ChangeEvent, ChangeKind, ChangeListener, DefineIndexOpts, StoragePort } from './store';
export type { Edge, EdgeQueryOpts } from './edge';
export * from './const';
export type { FilterOpts, PayloadOpt, QueryOpts, ConnectOpts, DisconnectOpts } from './types';

// export as 'static property mixin'
// from: https://www.typescriptlang.org/docs/handbook/mixins.html#static-property-mixins-17829
// ('Phase' sits atop tree + web: phase is a cross-axis concern -- see phase.ts)
export class Caudex extends Phase(Web(Tree(Base))) {}
