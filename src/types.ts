import { NODE, REL, QUERY_TYPE } from './const';
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
  // how the constructor handles items that fail to add (uniqKey / id collision):
  //   'throw'   (default) -- abort the whole batch (back-compat).
  //   'collect' -- skip the bad items, index the rest, record failures on
  //                'initErrors' so a consumer can report/recover them.
  onInitError?: 'throw' | 'collect';
}

// why an item failed to add() -- surfaced on Caudex.initErrors so a consumer can
// tell a uniqKey collision (drop the duplicate) from an id collision (re-add with
// a fresh id) apart.
export type AddErrorReason = 'id' | 'uniqkey' | 'invalid';

export interface InitError {
  item: any;
  reason: AddErrorReason;
}

export interface BaseNodeData {
  uri: string;
  filename: string;
  title: string;
  headers: string[];
  // blocks: string[];
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
  header?: string | undefined;
  // block?: string | undefined;
  // label: boolean;
}

export interface Embed {
  id: string;
  media?: NODE.MEDIA;   // absent = doc-embed (markdown is not a media kind)
  header?: string | undefined;
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

// the back-ref (inverse) index shape: 'targetId -> Set<sourceId>' per ref kind.
export interface BackRefs {
  attr: Map<string, Set<string>>;
  link: Map<string, Set<string>>;
  embed: Map<string, Set<string>>;
}

////
// query system

export interface FilterOpts {
  level?: REL.LEVEL;
  filename?: string;
  header?: string;
  kind?: REL.REF;
  type?: string;
  nodeKind?: NODE.KIND;
  nodeType?: string;
}

export type PayloadOpt =
  | QUERY_TYPE
  | string
  | string[];

export interface QueryOpts {
  filter?: FilterOpts;
  payload?: PayloadOpt;
}

////
// mutation options

export interface ConnectOpts {
  kind: REL.REF;
  type?: string;
  header?: string;
  media?: NODE.MEDIA;
}

export type DisconnectOpts = ConnectOpts;
