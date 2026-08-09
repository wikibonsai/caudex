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
import { Node } from './node';
import { NodeStore } from './store';


export class Base {
  // since there are no pointers...pseudo-pointers:
  //  reference:   node properties -- 'childID'
  //  dereference: class methods   -- 'this.get(childID)'

  // note: mixins don't work with protected/private properties...
  // ...so encapsulation lives in the store (a collaborator outside the mixin
  // chain); 'index' / 'uniqKeyMap' / 'uniqKeys' are live delegating views kept
  // for back-compat until internals go private (composition refactor, phase 3).
  public store: NodeStore;                                               // the StoragePort: node store + unique-key lookup
  // key opts
  public zombieKey: string = '';                                         // node data key that should be unique across zombies too
  // async opts
  public useLock: boolean;                                               // whether index should be thread-safe
  public lock: Mutex;                                                    // the actual mutex lock
  // id opts
  public nanoidOpts: any;                                                // nanoid options
  // items that failed to add during construction under onInitError: 'collect'
  public readonly initErrors: InitError[] = [];

  // live views over the store (see note on 'store' above)

  public get index(): Record<string, Node> {
    return this.store.nodes;
  }

  public get uniqKeyMap(): Record<string, Record<string, string>> | undefined {
    return this.store.uniqKeyMap;
  }

  public get uniqKeys(): string[] {
    return this.store.uniqKeys;
  }

  constructor(items: BaseNodeData[] | any[], opts?: Partial<CaudexOpts>) {
    // go
    // options
    if (opts) {
      // unique node data keys
      if (!opts.uniqKeys) {
        console.warn('no "uniqKeys" given, this may effect access speeds in some cases');
      }
      // todo: force 'zombieKey' to be a 'uniqKeys'?...'query' needs it...
      // zombie handling
      if (!opts.zombieKey) { console.warn('no "zombieKey" given, this will result in zombie nodes with empty data keys and may negatively effect cases where nodes referencing the zombie node are expecting that data key to exist'); }
      else                 { this.zombieKey = opts.zombieKey; }
      // nanoid
      if (opts.nanoid) {
        if (!opts.nanoid.alphabet || !opts.nanoid.size) {
          throw new Error('when using "nanoid" options, please be sure to fill in both "alphabet" and "size" properties');
        } else {
          this.nanoidOpts = {
            alphabet: opts.nanoid.alphabet,
            size: opts.nanoid.size,
          };
        }
      }
    }
    // init the store; populate nodes
    this.store = new NodeStore(opts?.uniqKeys);
    const errorItems: any[] = [];
    for (const item of items) {
      // use tryAdd (not add) so we can capture WHY an item failed to categorize it
      const { node, reason } = this.tryAdd(item.data, item.init);
      if (node === undefined) {
        errorItems.push(item);
        this.initErrors.push({ item, reason: reason ?? 'invalid' });
      }
    }
    // initialize mutex
    if (opts && opts.thread) {
      this.useLock = opts.thread.safe ? opts.thread.safe : false;
      // @ts-expect-error: 'Property '_semaphore' is missing in type 'MutexInterface' but required in type 'Mutex'.ts(2741)'
      this.lock = opts.thread.timeout ? withTimeout(new Mutex(), opts.thread.timeout) : new Mutex();
    } else {
      this.useLock = false;
      this.lock = new Mutex(); // setting the mutex is just to make types happy...
    }
    // finally, handle data that was not successfully initialized.
    // default 'throw' preserves back-compat (one bad item aborts the batch);
    // 'collect' keeps the index and leaves the failures on 'initErrors'.
    const onInitError: 'throw' | 'collect' = (opts && opts.onInitError) ? opts.onInitError : 'throw';
    if (errorItems.length > 0 && onInitError === 'throw') {
      throw new Error(`unable to create nodes from items:\n${JSON.stringify(errorItems)}`);
    }
  }

  // util

  public checkLock() {
    if (this.useLock && !this.lock.isLocked()) { throw new Error('please lock the index to access it'); }
  }

  public genID() {
    const configdNanoid = this.nanoidOpts ? customAlphabet(this.nanoidOpts.alphabet, this.nanoidOpts.size) : nanoid;
    return configdNanoid();
  }

  // Generic "the node set / forward refs changed" hook. Derived-index mixins
  // (web: backRefsIndex, tree: parentIndex) OVERRIDE this and chain via super() to mark
  // their caches stale on any base-level mutation. Base can't reference those
  // indexes directly (it's the innermost mixin), so it just fires this signal.
  public onMutate(): void { /* no-op at base -- no derived indexes of its own to invalidate */ }

  public print(printout: boolean = true): string {
    this.checkLock();
    if (printout) {
      console.log(this.store.serialize());
    }
    return this.store.serialize();
  }


  // properties

  protected applyFilter(nodes: Node[], filter?: FilterOpts): Node[] {
    if (!filter) { return nodes; }
    return nodes.filter((node: Node) => {
      if (filter.nodeKind !== undefined && node.kind !== filter.nodeKind) { return false; }
      if (filter.nodeType !== undefined && node.type !== filter.nodeType) { return false; }
      if (filter.filename !== undefined && node.data?.filename !== filter.filename) { return false; }
      return true;
    });
  }

  protected resolvePayload(id: string, payload: PayloadOpt | undefined, node: Node | undefined): any {
    const n = node ?? this.store.get(id);
    if (!n && (payload === QUERY_TYPE.DATA || payload === QUERY_TYPE.NODEKIND || payload === QUERY_TYPE.NODETYPE || (typeof payload === 'string' && payload !== QUERY_TYPE.ID))) {
      return undefined;
    }
    if (payload === undefined || payload === QUERY_TYPE.ID) { return id; }
    if (payload === QUERY_TYPE.NODE) { return n; }
    if (payload === QUERY_TYPE.NODEKIND) { return n?.kind; }
    if (payload === QUERY_TYPE.NODETYPE) { return n?.type; }
    if (payload === QUERY_TYPE.DATA) { return n?.data; }
    if (payload === QUERY_TYPE.ZOMBIE) { return n?.data?.[this.zombieKey]; }
    const nData: Record<string, any> = n?.data ?? {};
    if (Array.isArray(payload)) {
      const res: Record<string, any> = {};
      for (const key of payload) {
        res[key] = (key in nData) ? nData[key] : this.execQuery(id, key);
      }
      return res;
    }
    if (Object.keys(nData).includes(payload)) { return nData[payload]; }
    return this.execQuery(id, payload);
  }

  all(opts?: QueryOpts): string[] | Node[] | any[] | undefined {
    this.checkLock();
    const payload: PayloadOpt = opts?.payload ?? QUERY_TYPE.ID;
    let nodes: Node[] = this.store.all();
    nodes = this.applyFilter(nodes, opts?.filter);
    return nodes.map((node: Node) => this.resolvePayload(node.id, payload, node));
  }

  nodetypes(): Set<string> {
    this.checkLock();
    /* eslint-disable indent */
    const nodes = (this.all({ payload: QUERY_TYPE.NODE }) as Node[] | undefined) ?? [];
    const nodetypes: string[] = nodes
      .filter((node) => (node.type !== undefined) && (node.type !== ''))
      .map((node) => node.type as string);
    /* eslint-enable indent */
    return new Set(nodetypes);
  }

  zombies(opts?: QueryOpts): string[] | Node[] | any[] | undefined {
    this.checkLock();
    const mergedFilter = { ...opts?.filter, nodeKind: NODE.KIND.ZOMBIE as NODE.KIND };
    return this.all({ ...opts, filter: mergedFilter });
  }


  // index operations


  public has(id: string): boolean {
    this.checkLock();
    return this.store.has(id);
  }

  public flushData(id?: string): boolean {
    this.checkLock();
    // single
    if (id) {
      const node: Node | undefined = this.get(id, { payload: QUERY_TYPE.NODE });
      if (node === undefined) { return false; }
      node.data = {};
      return true;
    // all
    } else {
      (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? []).forEach((node: Node) => {
        node.data = {};
      });
      return true;
    }
  }

  public flushRels(): boolean {
    this.checkLock();
    this.onMutate();
    for (const node of (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? [])) {
      // delete zombies
      if (node.kind === NODE.KIND.ZOMBIE) {
        this.store.delete(node.id);
      // flush
      } else {
        node.flush();
      }
    }
    return true;
  }

  public clear(): void {
    this.checkLock();
    this.onMutate();
    this.store.clear();
  }


  // node operations


  // validate

  // validate unique data properties are unique
  // add "id" when validating node data to be updated.
  public validate(data: BaseNodeData | any, id: string = ''): boolean {
    this.checkLock();
    for (const key of Object.keys(data)) {
      if (this.uniqKeys.includes(key)) {
        if (this.store.all().find((node) =>
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

  public add(data: BaseNodeData | any, init?: Partial<InitNodeType>): Node | undefined;  // default-case
  public add(data: string): Node;                                                        // zombie-case
  public add(data: BaseNodeData | any, init?: Partial<InitNodeType>): Node | undefined {
    // thin wrapper — drops the failure reason; public contract stays Node | undefined.
    // the constructor calls tryAdd() directly when it needs the reason (initErrors).
    return this.tryAdd(data, init).node;
  }

  // add, but returns WHY it failed (node on success; reason on rejection) so the
  // constructor can categorize collect-mode failures. Public — NOT private —
  // because caudex is a mixin composition and TS mixins can't carry private/
  // protected members without collapsing the composed type. Doubles as the
  // "add-and-tell-me-why" variant for external callers that want the reason.
  public tryAdd(data: BaseNodeData | any, init?: Partial<InitNodeType>): { node?: Node; reason?: AddErrorReason } {
    this.checkLock();
    this.onMutate();
    // does id exist? (data.id channel)
    if (data.id && this.has(data.id)) {
      console.warn(`node with id "${data.id}" already exists`);
      return { reason: 'id' };
    }
    // zombie-case
    if (typeof data === 'string') {
      const zombieData: any = {};
      zombieData[this.zombieKey] = data;
      const zombieNode: Node = new Node(
        this.genID(),
        NODE.KIND.ZOMBIE,
        undefined,
        zombieData,
      );
      this.store.put(zombieNode);
      this.store.indexKey(this.zombieKey, data, zombieNode.id);
      return { node: zombieNode };
    }
    // default-case
    // is data valid?
    if (!this.validate(data)) {
      // warning will print in 'validateNodeData()' call
      return { reason: 'uniqkey' };
    }
    // guard an init.id collision (symmetric with the data.id guard above) --
    // taking init.id verbatim would silently overwrite the existing node.
    if (init && init.id && this.has(init.id)) {
      console.warn(`node with id "${init.id}" already exists`);
      return { reason: 'id' };
    }
    const id: string      = (init && init.id)   ? init.id   : this.genID();
    const kind: NODE.KIND = (init && init.kind) ? init.kind : NODE.KIND.DOC;
    const type: string    = (init && init.type) ? init.type : NODE.TYPE.DEFAULT;
    // init
    const newNode: Node = new Node(id, kind, type, data);
    this.store.put(newNode);
    // populate 'uniqKeyMap'
    for (const key of Object.keys(data)) {
      if (this.uniqKeyMap
      && Object.keys(this.uniqKeyMap).includes(key)
      ) {
        this.store.indexKey(key, data[key], id);
      }
    }
    return { node: newNode };
  }

  // edit

  public edit(id: string, key: any, newValue: any): boolean {
    this.checkLock();
    const node: Node | undefined = this.store.get(id);
    if (node === undefined) {
      console.warn(`node with id "${id}" does not exist`);
      return false;
    }
    if (key === QUERY_TYPE.NODETYPE) {
      node.type = newValue;
      if (node.type === newValue) { return true; }
    } else {
      const data: any = node.data;
      if (this.uniqKeyMap && this.uniqKeys.includes(key)) {
        this.store.deindexKey(key, data[key]);
        this.store.indexKey(key, newValue, id);
      }
      data[key] = newValue;
      if (!this.validate(data, id)) { return false; }
      node.data[key] = newValue;
      if (node.data[key] === newValue) { return true; }
    }
    return false;
  }

  public fill(id: string, data: BaseNodeData | any): Node | undefined {
    this.checkLock();
    this.onMutate();
    if (!this.has(id) && !(data.id && this.has(data.id))) {
      console.warn(`node with id "${id}" does not exist`);
      return undefined;
    }
    if (!this.validate(data, id)) { return undefined; }
    for (const key of Object.keys(data)) {
      if (this.uniqKeyMap
      && Object.keys(this.uniqKeyMap).includes(key)
      ) {
        this.store.indexKey(key, data[key], id);
      }
    }
    const node: Node = this.store.get(id) as Node;
    node.data = data;
    node.kind = data.kind ? data.kind : NODE.KIND.DOC;
    node.type = data.type ? data.type : NODE.TYPE.DEFAULT;
    return node;
  }

  // get

  public get(id: string, opts?: QueryOpts): Node | any | undefined {
    this.checkLock();
    const node: Node | undefined = this.store.get(id);
    if (!node) {
      console.warn(`node with id "${id}" does not exist`);
      return undefined;
    }
    const payload: PayloadOpt = opts?.payload ?? QUERY_TYPE.NODE;
    return this.resolvePayload(id, payload, node);
  }

  public execQuery(id: string, qType: string): any {
    this.checkLock();
    const node: Node = this.store.get(id) as Node;
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
      return node.data[this.zombieKey];
    } else if (Object.keys(node.data).includes(qType)) {
      return node.data[qType];
    } else {
      if (!node.data[this.zombieKey]) {
        console.warn(`query failed for id "${id}" with type '${qType}'`);
      }
      // todo: ...?
      // if (this.index[id].data.zombie) {
      //   console.debug(`query encountered an unexpected zombie with id: "${id}"`);
      // } else {
      //   console.warn(`query failed for id "${id}" with type '${type}'`);
      // }
    }
  }

  public find(key: any, value: any): Node | undefined {
    this.checkLock();
    if (!this.uniqKeys.includes(key)) {
      console.warn('"dataKey" must be a unique key in node data. Did you mean "filter()"?');
      return undefined;
    }
    if (this.uniqKeyMap && Object.keys(this.uniqKeyMap).includes(key)) {
      const id: string | undefined = this.store.findIDByKey(key, value);
      return (id === undefined) ? undefined : this.store.get(id);
    }
    return this.store.all().find((node: Node) => {
      return (node.data[key] && (node.data[key] === value));
    });
  }

  public filter(key: any, value: any): Node[] | undefined {
    this.checkLock();
    if (key === QUERY_TYPE.NODEKIND) {
      return this.store.all().filter((node: Node) => {
        return node.kind === value;
      });
    } else if (key === QUERY_TYPE.NODETYPE) {
      return this.store.all().filter((node: Node) => {
        return node.type === value;
      });
    } else {
      return this.store.all().filter((node: Node) => {
        return node.data[key] && node.data[key] === value;
      });
    }
  }

  // rm

  public rm(id: string): boolean {
    this.checkLock();
    const node: Node | undefined = this.get(id, { payload: QUERY_TYPE.NODE });
    if (!node) {
      console.warn(`node with id "${id}" does not exist`);
      return false;
    }
    this.onMutate();
    const hasRel: boolean = (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? []).some((n) =>
      (n.id !== id) && (n.inChildren(id) || n.inAttrs(id) || n.inLinks(id))
    );
    // if other nodes reference this node, just delete data
    if (!hasRel) {
      for (const key of Object.keys(node.data)) {
        if (this.uniqKeyMap && Object.keys(this.uniqKeyMap).includes(key)) {
          this.store.deindexKey(key, node.data[key]);
        }
      }
      this.store.delete(id);
      if (!this.has(id)) { return true; }
    // todo: when we are just about to cleanup relationships, 'hasRel' will be true, but only for nodes that are about to be deleted.
    } else {
      for (const key of Object.keys(node.data)) {
        if (this.uniqKeyMap &&
            Object.keys(this.uniqKeyMap).includes(key) &&
            (key !== this.zombieKey)
        ) {
          this.store.deindexKey(key, node.data[key]);
        }
      }
      const zombieData = node.data[this.zombieKey];
      node.kind = NODE.KIND.ZOMBIE;
      node.type = undefined;
      node.data = { [this.zombieKey]: zombieData };
      if ((node.kind === NODE.KIND.ZOMBIE) && this.get(id)?.data[this.zombieKey]) { return true; }
    }
    return false;
  }
}
