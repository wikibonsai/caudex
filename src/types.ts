import { NODE } from './const';
import { Base } from './base';


// mixin utils
// docs: https://www.typescriptlang.org/docs/handbook/mixins.html#constrained-mixins
type Constructor<T = Record<string, unknown>> = new (...args: any[]) => T;
export type Mixin = Constructor<Base>;

export interface CaudexOpts {
  nanoid?: {
    alphabet: string;
    size: number;
  };
  uniqKeys?: string[];
  zombieKey?: string;
  thread?: {
    safe?: boolean;
    timeout?: number; // miliseconds
  }
}

export interface BaseNodeData {
  uri: string;
  filename: string;
  title: string;
}

// note:
// these options describe the data payload used to determine
// a node's type information upon node creation.
// 'id' may seem out of place, but it is used to determine
// if a 'nodekind' === 'zombie'.
export interface InitNodeType {
  id?: string;
  kind?: NODE.KIND;
  type?: NODE.TYPE | string;
}

export interface InitNode {
  init: InitNodeType;
  data: BaseNodeData;
}

////
// refrel types

// singles

export interface Link {
  id: string;
  type: string | undefined;
  // level: 'file' | 'header' | 'block';
  // label: boolean;
}

export interface Embed {
  id: string;
  media: NODE.MEDIA;
}

// collections

export interface Attrs {
// type          ids
  [key: string]: Set<string>;
}

/* eslint-disable-next-line @typescript-eslint/no-empty-interface */
export interface Links extends Array<Link> {}

/* eslint-disable-next-line @typescript-eslint/no-empty-interface */
export interface Embeds extends Array<Embed> {}
