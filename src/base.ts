import { Mutex, withTimeout } from 'async-mutex';
import { customAlphabet, nanoid } from 'nanoid';

import type {
  AddErrorReason,
  InitNodeType,
  InitError,
  BaseNodeData,
  CaudexOpts,
  FilterOpts,
  PayloadOpt,
  QueryOpts,
} from './types';
import { NODE, QUERY_TYPE } from './const';
import { Node, NodeGraphCtx } from './node';
import { DerivedIndex, NodeStore } from './store';


// functions over hashes: caudex is composed from layer FUNCTIONS closing over a
// shared context (the hash), not from a class/mixin chain. Each layer file
// exports a layer function -- `base(ctx)` / `tree(ctx, base)` / `web(ctx, base)`
// / `phase(ctx, base)` -- returning its API slice; the create* factories merge
// slices into one plain object. Encapsulation comes from closures (the context
// is never exported on the api beyond the store), and cross-layer wiring is
// explicit: later layers receive the base slice as an argument instead of
// reaching through `this`.

// the shared per-caudex context: everything the old class fields held.
export interface CaudexCtx {
  store: NodeStore;
  zombieKey: string;
  useLock: boolean;
  lock: Mutex;
  nanoidOpts: any;
  initErrors: InitError[];
  // tree slot (used by the tree layer; lives here so the context stays the one
  // shared hash rather than layers growing private side-state)
  root: string | undefined;
  // the graph-attachment indexes the Phase layer registers; base.graphCtx()
  // reads them lazily (replaces the old `(this as any)[indexName]` poke).
  attachment: { tree?: DerivedIndex<Set<string>>; web?: DerivedIndex<Set<string>> };
}

// since there are no pointers...pseudo-pointers:
//  reference:   node properties  -- 'childID'
//  dereference: api functions    -- 'get(childID)'
export interface BaseAPI {
  readonly store: NodeStore;
  readonly zombieKey: string;
  readonly useLock: boolean;
  readonly lock: Mutex;
  readonly nanoidOpts: any;
  readonly initErrors: InitError[];
  // live views over the store (kept for back-compat until internals narrow)
  readonly index: Record<string, Node>;
  readonly uniqKeyMap: Record<string, Record<string, string>> | undefined;
  readonly uniqKeys: string[];
  // util
  checkLock(): void;
  genID(): string;
  graphCtx(): NodeGraphCtx;
  onMutate(op?: string, id?: string): void;
  print(printout?: boolean): string;
  // properties
  nodes(opts?: QueryOpts): string[] | Node[] | any[] | undefined;
  nodetypes(): Set<string>;
  edgetypes(): Set<string>;
  zombies(opts?: QueryOpts): string[] | Node[] | any[] | undefined;
  // index operations
  has(id: string): boolean;
  flushData(id?: string): boolean;
  flushGraph(): boolean;
  clear(): void;
  // node operations
  validate(data: BaseNodeData | any, id?: string): boolean;
  add(data: BaseNodeData | string | any, init?: Partial<InitNodeType>): Node | undefined;
  tryAdd(data: BaseNodeData | any, init?: Partial<InitNodeType>): { node?: Node; reason?: AddErrorReason };
  edit(id: string, key: any, newValue: any): boolean;
  fill(id: string, data: BaseNodeData | any): Node | undefined;
  get(id: string, opts?: QueryOpts): Node | any | undefined;
  execQuery(id: string, qType: string): any;
  find(key: any, value: any): Node | undefined;
  filter(key: any, value: any): Node[] | undefined;
  rm(id: string): boolean;
}

// build the shared context from opts (the old constructor's option handling).
export function initCtx(opts?: Partial<CaudexOpts>): CaudexCtx {
  let zombieKey: string = '';
  let nanoidOpts: any = undefined;
  if (opts) {
    // unique node data keys
    if (!opts.uniqKeys) {
      console.warn('no "uniqKeys" given, this may effect access speeds in some cases');
    }
    // todo: force 'zombieKey' to be a 'uniqKeys'?...'query' needs it...
    // zombie handling
    if (!opts.zombieKey) { console.warn('no "zombieKey" given, this will result in zombie nodes with empty data keys and may negatively effect cases where nodes referencing the zombie node are expecting that data key to exist'); }
    else                 { zombieKey = opts.zombieKey; }
    // nanoid
    if (opts.nanoid) {
      if (!opts.nanoid.alphabet || !opts.nanoid.size) {
        throw new Error('when using "nanoid" options, please be sure to fill in both "alphabet" and "size" properties');
      } else {
        nanoidOpts = {
          alphabet: opts.nanoid.alphabet,
          size: opts.nanoid.size,
        };
      }
    }
  }
  // mutex
  let useLock: boolean = false;
  let lock: Mutex;
  if (opts && opts.thread) {
    useLock = opts.thread.safe ? opts.thread.safe : false;
    // @ts-expect-error: 'Property '_semaphore' is missing in type 'MutexInterface' but required in type 'Mutex'.ts(2741)'
    lock = opts.thread.timeout ? withTimeout(new Mutex(), opts.thread.timeout) : new Mutex();
  } else {
    lock = new Mutex(); // setting the mutex is just to make types happy...
  }
  return {
    store: new NodeStore(opts?.uniqKeys),
    zombieKey,
    useLock,
    lock,
    nanoidOpts,
    initErrors: [],
    root: undefined,
    attachment: {},
  };
}

// populate the store from init items (the old constructor's seeding pass).
// default 'throw' preserves back-compat (one bad item aborts the batch);
// 'collect' keeps the index and leaves the failures on 'initErrors'.
export function seedItems(ctx: CaudexCtx, base: BaseAPI, items: BaseNodeData[] | any[], opts?: Partial<CaudexOpts>): void {
  // construction is pre-lock: the old constructor seeded items BEFORE the mutex
  // options took effect, so a thread-safe caudex never demanded its own lock
  // while populating itself. Preserve that by suspending the lock requirement
  // for the seeding pass.
  const useLock: boolean = ctx.useLock;
  ctx.useLock = false;
  try {
    const errorItems: any[] = [];
    for (const item of items) {
      // use tryAdd (not add) so we can capture WHY an item failed to categorize it
      const { node, reason } = base.tryAdd(item.data, item.init);
      if (node === undefined) {
        errorItems.push(item);
        ctx.initErrors.push({ item, reason: reason ?? 'invalid' });
      }
    }
    const onInitError: 'throw' | 'collect' = (opts && opts.onInitError) ? opts.onInitError : 'throw';
    if (errorItems.length > 0 && onInitError === 'throw') {
      throw new Error(`unable to create nodes from items:\n${JSON.stringify(errorItems)}`);
    }
  } finally {
    ctx.useLock = useLock;
  }
}

export function base(ctx: CaudexCtx): BaseAPI {
  const { store } = ctx;

  // util

  function checkLock(): void {
    if (ctx.useLock && !ctx.lock.isLocked()) { throw new Error('please lock the index to access it'); }
  }

  function genID(): string {
    const configdNanoid = ctx.nanoidOpts ? customAlphabet(ctx.nanoidOpts.alphabet, ctx.nanoidOpts.size) : nanoid;
    return configdNanoid();
  }

  // the graph-attachment lookup bound to every node at creation, backing the
  // no-arg 'node.phase()'. The attachment indexes are registered by the Phase
  // layer (above tree+web) into ctx.attachment; the closures evaluate LAZILY,
  // so by call time they exist on the full composition. On a composition
  // without the Phase layer, 'node.phase()' throws with a clear message.
  function graphCtx(): NodeGraphCtx {
    const lookup = (axis: 'tree' | 'web') => (id: string): boolean => {
      const idx: DerivedIndex<Set<string>> | undefined = ctx.attachment[axis];
      if (idx === undefined) {
        throw new Error(`node.state() requires the Phase composition ('${axis}' attachment index not registered)`);
      }
      return idx.ensure(store).has(id);
    };
    return { inTree: lookup('tree'), inWeb: lookup('web') };
  }

  // Generic "the node set changed" hook, fired on every base-level mutation.
  // Signals a node-kind change event through the store: stales all node-scoped
  // derived indexes and reaches change subscribers.
  function onMutate(op: string = 'mutate', id?: string): void {
    store.signal({ kind: 'node', op, ...(id !== undefined && { id }) });
  }

  function print(printout: boolean = true): string {
    checkLock();
    if (printout) {
      console.log(store.serialize());
    }
    return store.serialize();
  }

  // properties

  // internal (was `protected` on the class; now simply not exported)

  function applyFilter(nodes: Node[], filter?: FilterOpts): Node[] {
    if (!filter) { return nodes; }
    return nodes.filter((node: Node) => {
      if (filter.nodeKind !== undefined && node.kind !== filter.nodeKind) { return false; }
      if (filter.nodeType !== undefined && node.type !== filter.nodeType) { return false; }
      if (filter.nodeState !== undefined && node.state() !== filter.nodeState) { return false; }
      if (filter.filename !== undefined && node.data?.filename !== filter.filename) { return false; }
      return true;
    });
  }

  function resolvePayload(id: string, payload: PayloadOpt | undefined, node: Node | undefined): any {
    const n = node ?? store.get(id);
    if (!n && (payload === QUERY_TYPE.DATA || payload === QUERY_TYPE.NODEKIND || payload === QUERY_TYPE.NODETYPE || (typeof payload === 'string' && payload !== QUERY_TYPE.ID))) {
      return undefined;
    }
    if (payload === undefined || payload === QUERY_TYPE.ID) { return id; }
    if (payload === QUERY_TYPE.NODE) { return n; }
    if (payload === QUERY_TYPE.NODEKIND) { return n?.kind; }
    if (payload === QUERY_TYPE.NODETYPE) { return n?.type; }
    if (payload === QUERY_TYPE.NODESTATE) { return n?.state(); }
    if (payload === QUERY_TYPE.DATA) { return n?.data; }
    if (payload === QUERY_TYPE.ZOMBIE) { return n?.data?.[ctx.zombieKey]; }
    const nData: Record<string, any> = n?.data ?? {};
    if (Array.isArray(payload)) {
      const res: Record<string, any> = {};
      for (const key of payload) {
        res[key] = (key in nData) ? nData[key] : execQuery(id, key);
      }
      return res;
    }
    if (Object.keys(nData).includes(payload)) { return nData[payload]; }
    return execQuery(id, payload);
  }

  function nodes(opts?: QueryOpts): string[] | Node[] | any[] | undefined {
    checkLock();
    const payload: PayloadOpt = opts?.payload ?? QUERY_TYPE.ID;
    let nodeList: Node[] = store.all();
    nodeList = applyFilter(nodeList, opts?.filter);
    return nodeList.map((node: Node) => resolvePayload(node.id, payload, node));
  }

  function nodetypes(): Set<string> {
    checkLock();
    /* eslint-disable indent */
    const nodeList = (nodes({ payload: QUERY_TYPE.NODE }) as Node[] | undefined) ?? [];
    const types: string[] = nodeList
      .filter((node) => (node.type !== undefined) && (node.type !== ''))
      .map((node) => node.type as string);
    /* eslint-enable indent */
    return new Set(types);
  }

  // every edge type in the caudex -- the open EDGE.TYPE vocabulary, pairing
  // with nodetypes() above. attr types + link types; embeds are untyped.
  // (supersedes web's reftypes() under the node/edge vocabulary.)
  function edgetypes(): Set<string> {
    checkLock();
    const types: Set<string> = new Set<string>();
    for (const node of store.all()) {
      for (const attrType of Object.keys(node.attrs)) {
        types.add(attrType);
      }
      for (const link of node.links) {
        if (link.type !== undefined) { types.add(link.type); }
      }
    }
    return types;
  }

  function zombies(opts?: QueryOpts): string[] | Node[] | any[] | undefined {
    checkLock();
    const mergedFilter = { ...opts?.filter, nodeState: NODE.STATE.ZOMBIE };
    return nodes({ ...opts, filter: mergedFilter });
  }

  // index operations

  function has(id: string): boolean {
    checkLock();
    return store.has(id);
  }

  function flushData(id?: string): boolean {
    checkLock();
    // single
    if (id) {
      const node: Node | undefined = get(id, { payload: QUERY_TYPE.NODE });
      if (node === undefined) { return false; }
      node.data = {};
      return true;
    // all
    } else {
      (nodes({ payload: QUERY_TYPE.NODE }) as Node[] ?? []).forEach((node: Node) => {
        node.data = {};
      });
      return true;
    }
  }

  function flushGraph(): boolean {
    checkLock();
    onMutate('flushGraph');
    for (const node of (nodes({ payload: QUERY_TYPE.NODE }) as Node[] ?? [])) {
      // delete zombies
      if (node.state() === NODE.STATE.ZOMBIE) {
        store.delete(node.id);
      // flush
      } else {
        node.flush();
      }
    }
    return true;
  }

  function clear(): void {
    checkLock();
    onMutate('clear');
    store.clear();
  }

  // node operations

  // validate

  // validate unique data properties are unique
  // add "id" when validating node data to be updated.
  function validate(data: BaseNodeData | any, id: string = ''): boolean {
    checkLock();
    for (const key of Object.keys(data)) {
      if (store.uniqKeys.includes(key)) {
        if (store.all().find((node) =>
          (node.data[key] === data[key]) && (node.id !== id)
        )) {
          console.warn(`data key "${key}" with value "${data[key]}" already exists`);
          return false;
        }
      }
    }
    return true;
  }

  // add

  function add(data: BaseNodeData | string | any, init?: Partial<InitNodeType>): Node | undefined {
    // thin wrapper — drops the failure reason; public contract stays Node | undefined.
    // the factories call tryAdd() directly when they need the reason (initErrors).
    return tryAdd(data, init).node;
  }

  // add, but returns WHY it failed (node on success; reason on rejection) so the
  // seeding pass can categorize collect-mode failures. Doubles as the
  // "add-and-tell-me-why" variant for external callers that want the reason.
  function tryAdd(data: BaseNodeData | any, init?: Partial<InitNodeType>): { node?: Node; reason?: AddErrorReason } {
    checkLock();
    onMutate('add');
    // does id exist? (data.id channel)
    if (data.id && has(data.id)) {
      console.warn(`node with id "${data.id}" already exists`);
      return { reason: 'id' };
    }
    // zombie-case
    if (typeof data === 'string') {
      const zombieData: any = {};
      zombieData[ctx.zombieKey] = data;
      const zombieNode: Node = new Node(genID(), zombieData, undefined, undefined, graphCtx());
      store.put(zombieNode);
      store.indexKey(ctx.zombieKey, data, zombieNode.id);
      return { node: zombieNode };
    }
    // default-case
    // is data valid?
    if (!validate(data)) {
      // warning will print in 'validate()' call
      return { reason: 'uniqkey' };
    }
    // guard an init.id collision (symmetric with the data.id guard above) --
    // taking init.id verbatim would silently overwrite the existing node.
    if (init && init.id && has(init.id)) {
      console.warn(`node with id "${init.id}" already exists`);
      return { reason: 'id' };
    }
    const id: string      = (init && init.id)   ? init.id   : genID();
    const kind: NODE.KIND = (init && init.kind) ? init.kind : NODE.KIND.DOC;
    const type: string    = (init && init.type) ? init.type : NODE.TYPE.DEFAULT;
    // init
    const newNode: Node = new Node(id, data, kind, type, graphCtx());
    store.put(newNode);
    // populate 'uniqKeyMap'
    for (const key of Object.keys(data)) {
      if (store.uniqKeyMap
      && Object.keys(store.uniqKeyMap).includes(key)
      ) {
        store.indexKey(key, data[key], id);
      }
    }
    return { node: newNode };
  }

  // edit

  function edit(id: string, key: any, newValue: any): boolean {
    checkLock();
    const node: Node | undefined = store.get(id);
    if (node === undefined) {
      console.warn(`node with id "${id}" does not exist`);
      return false;
    }
    if (key === QUERY_TYPE.NODETYPE) {
      node.type = newValue;
      if (node.type === newValue) { return true; }
    } else {
      const data: any = node.data;
      if (store.uniqKeyMap && store.uniqKeys.includes(key)) {
        store.deindexKey(key, data[key]);
        store.indexKey(key, newValue, id);
      }
      data[key] = newValue;
      if (!validate(data, id)) { return false; }
      node.data[key] = newValue;
      if (node.data[key] === newValue) { return true; }
    }
    return false;
  }

  function fill(id: string, data: BaseNodeData | any): Node | undefined {
    checkLock();
    onMutate('fill', id);
    if (!has(id) && !(data.id && has(data.id))) {
      console.warn(`node with id "${id}" does not exist`);
      return undefined;
    }
    if (!validate(data, id)) { return undefined; }
    for (const key of Object.keys(data)) {
      if (store.uniqKeyMap
      && Object.keys(store.uniqKeyMap).includes(key)
      ) {
        store.indexKey(key, data[key], id);
      }
    }
    const node: Node = store.get(id) as Node;
    node.data = data;
    node.kind = data.kind ? data.kind : NODE.KIND.DOC;
    node.type = data.type ? data.type : NODE.TYPE.DEFAULT;
    return node;   // state flips live via the kind assignment above
  }

  // get

  function get(id: string, opts?: QueryOpts): Node | any | undefined {
    checkLock();
    const node: Node | undefined = store.get(id);
    if (!node) {
      console.warn(`node with id "${id}" does not exist`);
      return undefined;
    }
    const payload: PayloadOpt = opts?.payload ?? QUERY_TYPE.NODE;
    return resolvePayload(id, payload, node);
  }

  function execQuery(id: string, qType: string): any {
    checkLock();
    const node: Node = store.get(id) as Node;
    if (qType === QUERY_TYPE.ID) {
      return id;
    } else if (qType === QUERY_TYPE.NODE) {
      return node;
    } else if (qType === QUERY_TYPE.NODEKIND) {
      return node.kind;
    } else if (qType === QUERY_TYPE.NODETYPE) {
      return node.type;
    // todo: make it possible to have a query type for dynamically defined data keys
    } else if (qType === QUERY_TYPE.DATA) {
      return node.data;
    } else if (qType === QUERY_TYPE.ZOMBIE) {
      return node.data[ctx.zombieKey];
    } else if (Object.keys(node.data).includes(qType)) {
      return node.data[qType];
    } else {
      if (!node.data[ctx.zombieKey]) {
        console.warn(`query failed for id "${id}" with type '${qType}'`);
      }
    }
  }

  function find(key: any, value: any): Node | undefined {
    checkLock();
    if (!store.uniqKeys.includes(key)) {
      console.warn('"dataKey" must be a unique key in node data. Did you mean "filter()"?');
      return undefined;
    }
    if (store.uniqKeyMap && Object.keys(store.uniqKeyMap).includes(key)) {
      const id: string | undefined = store.findIDByKey(key, value);
      return (id === undefined) ? undefined : store.get(id);
    }
    return store.all().find((node: Node) => {
      return (node.data[key] && (node.data[key] === value));
    });
  }

  function filter(key: any, value: any): Node[] | undefined {
    checkLock();
    if (key === QUERY_TYPE.NODEKIND) {
      return store.all().filter((node: Node) => {
        return node.kind === value;
      });
    } else if (key === QUERY_TYPE.NODETYPE) {
      return store.all().filter((node: Node) => {
        return node.type === value;
      });
    } else {
      return store.all().filter((node: Node) => {
        return node.data[key] && node.data[key] === value;
      });
    }
  }

  // rm

  function rm(id: string): boolean {
    checkLock();
    const node: Node | undefined = get(id, { payload: QUERY_TYPE.NODE });
    if (!node) {
      console.warn(`node with id "${id}" does not exist`);
      return false;
    }
    onMutate('rm', id);
    const hasRel: boolean = (nodes({ payload: QUERY_TYPE.NODE }) as Node[] ?? []).some((n) =>
      (n.id !== id) && (n.inChildren(id) || n.inAttrs(id) || n.inLinks(id) || n.inEmbeds(id))
    );
    // if other nodes reference this node, just delete data
    if (!hasRel) {
      for (const key of Object.keys(node.data)) {
        if (store.uniqKeyMap && Object.keys(store.uniqKeyMap).includes(key)) {
          store.deindexKey(key, node.data[key]);
        }
      }
      store.delete(id);
      if (!has(id)) { return true; }
    // todo: when we are just about to cleanup relationships, 'hasRel' will be true, but only for nodes that are about to be deleted.
    } else {
      for (const key of Object.keys(node.data)) {
        if (store.uniqKeyMap &&
            Object.keys(store.uniqKeyMap).includes(key) &&
            (key !== ctx.zombieKey)
        ) {
          store.deindexKey(key, node.data[key]);
        }
      }
      const zombieData = node.data[ctx.zombieKey];
      node.kind = undefined;   // kind-absence IS zombie-ness (state derives from it)
      node.type = undefined;
      node.data = { [ctx.zombieKey]: zombieData };
      if ((node.state() === NODE.STATE.ZOMBIE) && get(id)?.data[ctx.zombieKey]) { return true; }
    }
    return false;
  }

  return {
    store,
    get zombieKey(): string { return ctx.zombieKey; },
    get useLock(): boolean { return ctx.useLock; },
    get lock(): Mutex { return ctx.lock; },
    get nanoidOpts(): any { return ctx.nanoidOpts; },
    get initErrors(): InitError[] { return ctx.initErrors; },
    // live views over the store (kept for back-compat until internals narrow)
    get index(): Record<string, Node> { return store.nodes; },
    get uniqKeyMap(): Record<string, Record<string, string>> | undefined { return store.uniqKeyMap; },
    get uniqKeys(): string[] { return store.uniqKeys; },
    checkLock,
    genID,
    graphCtx,
    onMutate,
    print,
    nodes,
    nodetypes,
    edgetypes,
    zombies,
    has,
    flushData,
    flushGraph,
    clear,
    validate,
    add,
    tryAdd,
    edit,
    fill,
    get,
    execQuery,
    find,
    filter,
    rm,
  };
}

// getter-preserving extend: object spread would SNAPSHOT getter values (the
// live 'index' / '_root' / dirty-flag views), so layer slices merge via
// property descriptors instead. Extends `api` in place and returns it, so the
// base slice captured by later layers IS the composed object (mirroring the
// old mixin `this`).
export function extendAPI<T extends object, U extends object>(api: T, slice: U): T & U {
  return Object.defineProperties(api, Object.getOwnPropertyDescriptors(slice)) as T & U;
}

// a layer factory: closes over the shared context and returns its API slice.
// (the base layer ignores the second argument; later layers receive the
// accumulating api object.)
export type LayerFn = (ctx: CaudexCtx, api: any) => object;

type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type ComposedAPI<Fs extends readonly LayerFn[]> = UnionToIntersection<ReturnType<Fs[number]>>;

// compose a caudex CREATE-function from a list of layer factories:
//
//   const create = compose([base, tree, web, phase]);
//
// folds the factories left-to-right with extendAPI (in place: every layer's
// `api`/`base` argument IS the composed object), then seeds the items. The
// return type is the intersection of the slices the factories produce.
export function compose<Fs extends readonly [LayerFn, ...LayerFn[]]>(
  factories: Fs,
): (items: BaseNodeData[] | any[], opts?: Partial<CaudexOpts>) => ComposedAPI<Fs> {
  return (items: BaseNodeData[] | any[], opts?: Partial<CaudexOpts>): ComposedAPI<Fs> => {
    const ctx: CaudexCtx = initCtx(opts);
    let api: any = undefined;
    for (const factory of factories) {
      const slice: object = factory(ctx, api);
      api = (api === undefined) ? slice : extendAPI(api, slice);
    }
    seedItems(ctx, api as BaseAPI, items, opts);
    return api as ComposedAPI<Fs>;
  };
}

// a standalone base composition (≈ the old bare `new Base(items, opts)`).
export const createBase: (items: BaseNodeData[] | any[], opts?: Partial<CaudexOpts>) => BaseAPI =
  compose([base]);

export type Base = BaseAPI;
