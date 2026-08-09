import { Node } from './node';


// the StoragePort contract -- what Refactor #2 adapters (sqlite / graphology / etc.)
// must implement to slot in under the semantic core.
export interface StoragePort {
  readonly uniqKeys: string[];
  readonly nodes: Record<string, Node>;
  readonly uniqKeyMap: Record<string, Record<string, string>> | undefined;
  has(id: string): boolean;
  get(id: string): Node | undefined;
  all(): Node[];
  put(node: Node): void;
  delete(id: string): boolean;
  clear(): void;
  findIDByKey(key: string, value: any): string | undefined;
  indexKey(key: string, value: any, id: string): void;
  deindexKey(key: string, value: any): void;
  serialize(): string;
}

// the in-memory StoragePort: the node store + unique-key lookup extracted from
// 'Base' (composition refactor, phase 1). CRUD primitives only -- all semantic
// logic (validation, zombie handling, id generation, mutation signaling) stays
// in the core, which sequences these primitives exactly as 'Base' used to inline
// them. Note in particular that 'delete()' and 'clear()' do NOT touch the key
// map -- de-indexing is an explicit, separate op ('deindexKey'), because some
// core paths (e.g. zombie deletion in 'flushRels') intentionally leave entries.
//
// truly-private fields are possible here -- unlike in the mixin chain
// (see base.ts) -- because NodeStore stands outside it.
export class NodeStore implements StoragePort {
  #nodes: Record<string, Node> = {};
  #uniqKeyMap: Record<string, Record<string, string>> | undefined;
  public readonly uniqKeys: string[];

  constructor(uniqKeys?: string[]) {
    this.uniqKeys = uniqKeys ?? [];
    if (uniqKeys === undefined) {
      this.#uniqKeyMap = undefined;
    } else {
      this.#uniqKeyMap = {};
      for (const key of this.uniqKeys) {
        this.#uniqKeyMap[key] = {};
      }
    }
  }

  // live views -- transitional accessors backing 'base.index' / 'base.uniqKeyMap'
  // so consumers (and the derived-index rebuilds) keep working during the
  // refactor; narrowed when internals go private in phase 3.

  public get nodes(): Record<string, Node> {
    return this.#nodes;
  }

  public get uniqKeyMap(): Record<string, Record<string, string>> | undefined {
    return this.#uniqKeyMap;
  }

  // node crud

  public has(id: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.#nodes, id);
  }

  public get(id: string): Node | undefined {
    return this.#nodes[id];
  }

  public all(): Node[] {
    return Object.values(this.#nodes);
  }

  public put(node: Node): void {
    this.#nodes[node.id] = node;
  }

  public delete(id: string): boolean {
    if (!this.has(id)) { return false; }
    delete this.#nodes[id];
    return true;
  }

  public clear(): void {
    this.#nodes = {};
  }

  // unique key lookup

  public findIDByKey(key: string, value: any): string | undefined {
    if (!this.#uniqKeyMap) { return undefined; }
    return this.#uniqKeyMap[key]?.[value];
  }

  public indexKey(key: string, value: any, id: string): void {
    if (!this.#uniqKeyMap) { return; }
    this.#uniqKeyMap[key][value] = id;
  }

  public deindexKey(key: string, value: any): void {
    if (!this.#uniqKeyMap) { return; }
    delete this.#uniqKeyMap[key][value];
  }

  // (de)serialization -- the refactor #2 persistence hook

  public serialize(): string {
    return JSON.stringify(this.#nodes);
  }
}
