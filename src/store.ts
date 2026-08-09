import { Node } from './node';


// typed change events -- the semantic layer signals WHAT changed; the store
// routes the signal to (a) scoped derived-index invalidation and (b) external
// subscribers. Kinds mirror the consumer's revision axes:
//   'node' -- the node set changed (add/rm/fill/flushGraph/clear); all indexes stale.
//   'tree' -- the hierarchy changed (graft/prune/replace/transplant/flushTree).
//   'web'  -- the relations changed (connect/disconnect/retype/transfer/flushWeb).
// Content-only ops (edit/flushData) do NOT signal -- they invalidate nothing
// today, and emitting on them would over-invalidate scoped indexes.
export type ChangeKind = 'node' | 'tree' | 'web';

export interface ChangeEvent {
  kind: ChangeKind;
  op: string;
  id?: string;
}

export type ChangeListener = (event: ChangeEvent) => void;

export interface DefineIndexOpts {
  scopes?: ChangeKind[];   // which change kinds stale this index; default: all
}

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
  defineIndex<T>(name: string, projector: (store: StoragePort) => T, opts?: DefineIndexOpts): DerivedIndex<T>;
  invalidateIndexes(): void;
  signal(event: ChangeEvent): void;
  onChange(listener: ChangeListener): () => void;
}

// a lazily-(re)built cache derived from the node store. Each instance supplies
// only its unique part -- the 'projector', a pure function '(store) -> cache' --
// while the dirty / rebuild / ensure lifecycle (previously copy-pasted per index
// across the tree + web mixins) lives here once. Registered via
// 'store.defineIndex()' so a store-level mutation signal ('invalidateIndexes')
// sweeps every index without each one hooking the mutation path itself.
export class DerivedIndex<T> {
  public readonly name: string;
  public readonly scopes: Set<ChangeKind>;
  #projector: (store: StoragePort) => T;
  #value: T | undefined;
  #dirty: boolean = true;

  constructor(name: string, projector: (store: StoragePort) => T, scopes?: ChangeKind[]) {
    this.name = name;
    this.scopes = new Set(scopes ?? ['node', 'tree', 'web']);
    this.#projector = projector;
  }

  public get dirty(): boolean {
    return this.#dirty;
  }

  // the current projection ('undefined' until first built); does NOT rebuild --
  // callers wanting freshness go through 'ensure()'.
  public get value(): T | undefined {
    return this.#value;
  }

  public invalidate(): void {
    this.#dirty = true;
  }

  // re-project unconditionally.
  public rebuild(store: StoragePort): T {
    this.#value = this.#projector(store);
    this.#dirty = false;
    return this.#value;
  }

  // re-project only if stale, then serve.
  public ensure(store: StoragePort): T {
    if (this.#dirty || this.#value === undefined) {
      return this.rebuild(store);
    }
    return this.#value;
  }
}

// the in-memory StoragePort: the node store + unique-key lookup extracted from
// 'Base' (composition refactor, phase 1). CRUD primitives only -- all semantic
// logic (validation, zombie handling, id generation, mutation signaling) stays
// in the core, which sequences these primitives exactly as 'Base' used to inline
// them. Note in particular that 'delete()' and 'clear()' do NOT touch the key
// map -- de-indexing is an explicit, separate op ('deindexKey'), because some
// core paths (e.g. zombie deletion in 'flushGraph') intentionally leave entries.
//
// truly-private fields are possible here -- unlike in the mixin chain
// (see base.ts) -- because NodeStore stands outside it.
export class NodeStore implements StoragePort {
  #nodes: Record<string, Node> = {};
  #uniqKeyMap: Record<string, Record<string, string>> | undefined;
  #indexes: DerivedIndex<any>[] = [];
  #listeners: ChangeListener[] = [];
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

  // derived indexes

  public defineIndex<T>(name: string, projector: (store: StoragePort) => T, opts?: DefineIndexOpts): DerivedIndex<T> {
    const index: DerivedIndex<T> = new DerivedIndex<T>(name, projector, opts?.scopes);
    this.#indexes.push(index);
    return index;
  }

  // unconditional sweep: mark every registered index stale (scope-blind).
  public invalidateIndexes(): void {
    for (const index of this.#indexes) {
      index.invalidate();
    }
  }

  // change events

  // the typed mutation signal: stale the derived indexes scoped to this change
  // kind, then notify subscribers. Fired from the semantic layer (base/tree/web
  // mutation sites) rather than from the crud primitives above, because many
  // mutations happen directly on node objects (connect, graft, node.flush, ...)
  // and never pass through the store's crud at all.
  public signal(event: ChangeEvent): void {
    for (const index of this.#indexes) {
      if (index.scopes.has(event.kind)) {
        index.invalidate();
      }
    }
    for (const listener of [...this.#listeners]) {
      listener(event);
    }
  }

  // subscribe to change events; returns the unsubscribe.
  public onChange(listener: ChangeListener): () => void {
    this.#listeners.push(listener);
    return (): void => {
      const at: number = this.#listeners.indexOf(listener);
      if (at !== -1) { this.#listeners.splice(at, 1); }
    };
  }

  // (de)serialization -- the refactor #2 persistence hook

  public serialize(): string {
    return JSON.stringify(this.#nodes);
  }
}
