import { Mutex, withTimeout } from 'async-mutex';
import { customAlphabet, nanoid } from 'nanoid';

import type {
  InitNodeType,
  BaseNodeData,
  CaudexOpts,
} from './types';
import { NODE, QUERY_TYPE } from './const';
import { Node } from './node';


export class Base {
  // since there are no pointers...pseudo-pointers:
  //  reference:   node properties -- 'childID'
  //  dereference: class methods   -- 'this.get(childID)'

  // note: mixins don't work with protected/private properties...
  public index: Record<string, Node>;                                    // the core index instance
  public uniqKeyMap: Record<string, Record<string, string>> | undefined; // node data properties that are unique get a hash value for faster access
  // key opts
  public uniqKeys: string[] = [];                                        // node data key that should be unique
  public zombieKey: string = '';                                         // node data key that should be unique across zombies too
  // async opts
  public useLock: boolean;                                               // whether index should be thread-safe
  public lock: Mutex;                                                    // the actual mutex lock
  // id opts
  public nanoidOpts: any;                                                // nanoid options

  constructor(items: BaseNodeData[] | any[], opts?: Partial<CaudexOpts>) {
    // go
    // options
    if (opts) {
      // unique node data keys
      if (!opts.uniqKeys) {
        console.warn('no "uniqKeys" given, this may effect access speeds in some cases');
        this.uniqKeyMap = undefined;
      } else {
        this.uniqKeys = opts.uniqKeys;
        this.uniqKeyMap = {};
        for (const key of this.uniqKeys) {
          this.uniqKeyMap[key] = {};
        }
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
    // init items; populate nodes
    this.index = {};
    const errorItems: any[] = [];
    for (const item of items) {
      const newNode: Node | undefined = this.add(item.data, item.init);
      if (newNode === undefined) {
        errorItems.push(item);
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
    // finally, print data that was not successfully initialized
    if (errorItems.length > 0) {
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

  public print() {
    this.checkLock();
    console.log(JSON.stringify(this.index));
  }


  // properties


  // types
  all(query?: QUERY_TYPE.ID): string[];
  all(query: QUERY_TYPE.NODE): Node[];
  all(query: string | string[]): any[] | undefined;
  // define
  all(query: string | string[] = QUERY_TYPE.ID): string[] | any[] | undefined {
    this.checkLock();
    if (query === QUERY_TYPE.ID)       { return Object.keys(this.index); }
    if (query === QUERY_TYPE.NODE)     { return Object.values(this.index); }
    if (query === QUERY_TYPE.NODEKIND) { return Object.values(this.index).map((node: Node) => node.kind); }
    if (query === QUERY_TYPE.NODETYPE) { return Object.values(this.index).map((node: Node) => node.type); }
    if (query === QUERY_TYPE.DATA)     { return Object.values(this.index).map((node: Node) => node.data); }
    return Object.values(this.index).map((node: Node) => this.get(node.id, query));
  }

  nodetypes(): Set<string> {
    this.checkLock();
    /* eslint-disable indent */
    // @ts-expect-error: typescript is not smart enough to see 'filter' performing validation
    const nodetypes: string[] = this.all(QUERY_TYPE.NODE)
                                    .filter((node) => (node.type !== undefined) && (node.type !== ''))
                                    .map((node) => node.type);
    /* eslint-enable indent */
    return new Set(nodetypes);
  }

  // nodes that contain only data other nodes are expecting to see
  // types
  zombies(query?: QUERY_TYPE.ID): string[];
  zombies(query: QUERY_TYPE.NODE): Node[];
  zombies(query: string | string[]): any[];
  // define
  zombies(query: QUERY_TYPE | string | string[] = QUERY_TYPE.ID): string[] | Node[] | any[] {
    this.checkLock();
    /* eslint-disable indent */
    return this.all(QUERY_TYPE.NODE)
               .filter((node: Node) => node.kind === NODE.KIND.ZOMBIE)
               .map((node) => this.get(node.id, query));
    /* eslint-enable indent */
  }


  // index operations


  public has(id: string): boolean {
    this.checkLock();
    return Object.keys(this.index).includes(id);
  }

  public flushData(id?: string): boolean {
    this.checkLock();
    // single
    if (id) {
      const node: Node | undefined = this.get(id);
      if (node === undefined) { return false; }
      node.data = {};
      return true;
    // all
    } else {
      this.all(QUERY_TYPE.NODE).forEach((node: Node) => {
        node.data = {};
      });
      return true;
    }
  }

  public flushRels(): boolean {
    this.checkLock();
    for (const node of this.all(QUERY_TYPE.NODE)) {
      // delete zombies
      if (node.kind === NODE.KIND.ZOMBIE) {
        delete this.index[node.id];
      // flush
      } else {
        node.flush();
      }
    }
    return true;
  }

  public clear(): void {
    this.checkLock();
    this.index = {};
  }


  // node operations


  // validate

  // validate unique data properties are unique
  // add "id" when validating node data to be updated.
  public validate(data: BaseNodeData | any, id: string = ''): boolean {
    this.checkLock();
    for (const key of Object.keys(data)) {
      if (this.uniqKeys.includes(key)) {
        if (Object.values(this.index).find((node) =>
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
  public add(data: string): Node;                                              // zombie-case
  public add(data: BaseNodeData | any, init?: Partial<InitNodeType>): Node | undefined {
    this.checkLock();
    // does id exist?
    if (data.id && this.has(data.id)) {
      console.warn(`node with id "${data.id}" already exists`);
      return undefined;
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
      this.index[zombieNode.id] = zombieNode;
      if (this.uniqKeyMap) {
        this.uniqKeyMap[this.zombieKey][data] = zombieNode.id;
      }
      return zombieNode;
    }
    // default-case
    // is data valid?
    if (!this.validate(data)) {
      // warning will print in 'validateNodeData()' call
      return undefined;
    }
    const id: string      = (init && init.id)   ? init.id   : this.genID();
    const kind: NODE.KIND = (init && init.kind) ? init.kind : NODE.KIND.DOC;
    const type: string    = (init && init.type) ? init.type : NODE.TYPE.DEFAULT;
    // init
    const newNode: Node = new Node(id, kind, type, data);
    this.index[newNode.id] = newNode;
    // populate 'uniqKeyMap'
    for (const key of Object.keys(data)) {
      if (this.uniqKeyMap
      && Object.keys(this.uniqKeyMap).includes(key)
      ) {
        this.uniqKeyMap[key][data[key]] = id;
      }
    }
    return newNode;
  }

  // edit

  public edit(id: string, key: any, newValue: any): boolean {
    this.checkLock();
    const node: Node | undefined = this.index[id];
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
        delete this.uniqKeyMap[key][data[key]];
        this.uniqKeyMap[key][newValue] = id;
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
    if (!this.has(id) && !(data.id && this.has(data.id))) {
      console.warn(`node with id "${id}" does not exist`);
      return undefined;
    }
    if (!this.validate(data, id)) { return undefined; }
    for (const key of Object.keys(data)) {
      if (this.uniqKeyMap
      && Object.keys(this.uniqKeyMap).includes(key)
      ) {
        this.uniqKeyMap[key][data[key]] = id;
      }
    }
    this.index[id].data = data;
    this.index[id].kind = data.kind ? data.kind : NODE.KIND.DOC;
    this.index[id].type = data.type ? data.type : NODE.TYPE.DEFAULT;
    return this.index[id];
  }

  // get

  // types
  public get(id: string): Node | undefined;
  public get(id: string, query: QUERY_TYPE.NODE): Node;
  public get(id: string, query: string | string[]): any | undefined;
  // define
  public get(id: string, query: string | string[] = QUERY_TYPE.NODE): Node | any | undefined {
    this.checkLock();
    if (!this.index[id]) {
      console.warn(`node with id "${id}" does not exist`);
      return;
    }
    // single string query
    if (typeof query === 'string') {
      return this.execQuery(id, query);
    // multi array query
    } else {
      const res: any = {};
      for (const q of query) {
        res[q] = this.execQuery(id, q);
      }
      return res;
    }
  }

  public execQuery(id: string, qType: string): any {
    this.checkLock();
    if (qType === QUERY_TYPE.ID) {
      return id;
    } else if (qType === QUERY_TYPE.NODE) {
      return this.index[id];
    } else if (qType === QUERY_TYPE.NODEKIND) {
      return this.index[id].kind;
    } else if (qType === QUERY_TYPE.NODETYPE) {
      return this.index[id].type;
    } else if (qType === QUERY_TYPE.DATA) {
      return this.index[id].data;
    } else if (qType === QUERY_TYPE.ZOMBIE) {
      return this.index[id].data[this.zombieKey];
    } else if (Object.keys(this.index[id].data).includes(qType)) {
      return this.index[id].data[qType];
    } else {
      if (!this.index[id].data[this.zombieKey]) {
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
      const id: string = this.uniqKeyMap[key][value];
      return this.index[id];
    }
    return Object.values(this.index).find((node: Node) => {
      return (node.data[key] && (node.data[key] === value));
    });
  }

  public filter(key: any, value: any): Node[] | undefined {
    this.checkLock();
    if (key === QUERY_TYPE.NODEKIND) {
      return Object.values(this.index).filter((node: Node) => {
        return node.kind === value;
      });
    } else if (key === QUERY_TYPE.NODETYPE) {
      return Object.values(this.index).filter((node: Node) => {
        return node.type === value;
      });
    } else {
      return Object.values(this.index).filter((node: Node) => {
        return node.data[key] && node.data[key] === value;
      });
    }
  }

  // rm

  public rm(id: string): boolean {
    this.checkLock();
    const node: Node | undefined = this.get(id);
    if (!node) {
      console.warn(`node with id "${id}" does not exist`);
      return false;
    }
    const hasRel: boolean = this.all(QUERY_TYPE.NODE).some((node) => 
      (node.id !== id) && (node.inChildren(id) || node.inAttrs(id) || node.inLinks(id))
    );
    // if other nodes reference this node, just delete data
    if (!hasRel) {
      for (const key of Object.keys(node.data)) {
        if (this.uniqKeyMap && Object.keys(this.uniqKeyMap).includes(key)) {
          delete this.uniqKeyMap[key][node.data[key]];
        }
      }
      delete this.index[id];
      if (!this.has(id)) { return true; }
    // todo: when we are just about to cleanup relationships, 'hasRel' will be true, but only for nodes that are about to be deleted.
    } else {
      for (const key of Object.keys(node.data)) {
        if (this.uniqKeyMap &&
            Object.keys(this.uniqKeyMap).includes(key) &&
            (key !== this.zombieKey)
        ) {
          delete this.uniqKeyMap[key][node.data[key]];
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
