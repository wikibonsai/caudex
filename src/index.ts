import { Base } from './base';
import { Web } from './web';
import { Tree } from './tree';

export { Base } from './base';
export { Web } from './web';
export { Tree } from './tree';
export { Node } from './node';
export * from './const';

// export as 'static property mixin'
// from: https://www.typescriptlang.org/docs/handbook/mixins.html#static-property-mixins-17829
export class Caudex extends Web(Tree(Base)) {}
