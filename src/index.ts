import { Base } from './base';
import { Web } from './web';
import { Tree } from './tree';

export { Base } from './base';
export { Web } from './web';
export { Tree } from './tree';
export { Node } from './node';
export { DerivedIndex, NodeStore } from './store';
export type { StoragePort } from './store';
export * from './const';
export type { FilterOpts, PayloadOpt, QueryOpts, ConnectOpts, DisconnectOpts } from './types';

// export as 'static property mixin'
// from: https://www.typescriptlang.org/docs/handbook/mixins.html#static-property-mixins-17829
export class Caudex extends Web(Tree(Base)) {}
