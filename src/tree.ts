import type { BaseNodeData, CaudexOpts, QueryOpts } from './types';
import { DATA_STRUCT, NODE, QUERY_TYPE } from './const';
import { Node } from './node';
import { DerivedIndex, StoragePort } from './store';
import { BaseAPI, CaudexCtx, base, compose } from './base';


export interface TreeAPI {
  // parent index faces
  readonly parentIndex: DerivedIndex<Map<string, string>>;
  readonly parentIndexDirty: boolean;
  invalidateParentIndex(): void;
  rebuildParentIndex(): void;
  ensureParentIndex(): Map<string, string>;
  // root
  readonly _root: string | undefined;
  setRoot(id: string): boolean;
  root(opts?: QueryOpts): string | Node | any | undefined;
  // properties
  ancestors(id: string, opts?: QueryOpts): string[] | Node[] | any[] | undefined;
  parent(id: string, opts?: QueryOpts): string | Node | any | undefined;
  siblings(id: string, opts?: QueryOpts): string[] | Node[] | any[] | undefined;
  children(id: string, opts?: QueryOpts): string[] | Node[] | any[] | undefined;
  descendants(id: string, opts?: QueryOpts): string[] | Node[] | any[] | undefined;
  lineage(id: string, opts?: QueryOpts): string[] | Node[] | any[] | undefined;
  level(id: string): number | undefined;
  // methods
  flushTree(): boolean;
  graft(parentID: string, childID: string, force?: boolean): boolean;
  replace(sourceID: string, targetID: string): boolean;
  transplant(subrootID: string, subtree: { id: string, children: string[] }[]): boolean;
  prune(parentID: string, childID: string, force?: boolean): boolean;
  // validators
  inTree(id: string): boolean;
  isRoot(id: string): boolean;
  isLeaf(id: string): boolean;
  isTree(curNode?: Node | undefined, visited?: Set<string>): boolean;
  isRooted(id: string): boolean;
  // util
  walkUp(id: string): string[];
  walkDown(id: string): string[];
  printTree(key: string, printout?: boolean): string;
  buildTreeString(key: string, node: Node, prefix?: string, isRoot?: boolean): string;
}

export function tree(ctx: CaudexCtx, base: BaseAPI): TreeAPI {
  const { store } = ctx;
  const { checkLock, has, get, nodes } = base;

  // parent index — 'childId -> parentId', a derived cache over the tree's child
  // pointers so parent()/ancestors()/inTree() are O(1)/O(depth) instead of a full
  // tree walk per call (the graph-lineage + ancestor derives that the app's
  // caudexRevision storm hammers). Registered against the store, so base-level
  // mutations invalidate it via the scoped signal sweep; tree-only mutations
  // (graft/prune/replace/transplant) invalidate it directly. The derive
  // rebuilds from a single scan: every node's children point back to it.
  const parentIndex: DerivedIndex<Map<string, string>> = store.defineIndex(
    'parentIndex',
    (s: StoragePort): Map<string, string> => {
      const idx: Map<string, string> = new Map();
      for (const node of s.all()) {
        for (const childID of node.children) { idx.set(childID, node.id); }
      }
      return idx;
    },
    { scopes: ['node', 'tree'] },
  );

  function invalidateParentIndex(): void {
    parentIndex.invalidate();
  }

  function rebuildParentIndex(): void {
    parentIndex.rebuild(store);
  }

  function ensureParentIndex(): Map<string, string> {
    if (parentIndex.dirty) { rebuildParentIndex(); }
    return parentIndex.value as Map<string, string>;
  }

  // root operations

  function setRoot(id: string): boolean {
    checkLock();
    if (!has(id)) {
      console.warn(`node with id "${id}" not in index`);
      return false;
    }
    ctx.root = id;
    if (ctx.root) { return true; }
    return false;
  }

  // properties

  // tree-lvl

  function root(opts?: QueryOpts): string | Node | any | undefined {
    checkLock();
    if (ctx.root === undefined) { return undefined; }
    // default payload for root() is ID (unlike get() which defaults to NODE)
    return get(ctx.root, opts !== undefined ? opts : { payload: QUERY_TYPE.ID });
  }

  // note: the phase bulk queries (phases/integrated/orphans/spurs/
  // isolates) live in phase.ts, and per-node phase on the node itself
  // ('node.phase()') -- phase partitions nodes across BOTH the tree and web
  // attachment axes. (the old tree-only 'orphans(treeIDs)' -- "leaf with no
  // parent" -- was the single-axis meaning the TERMS reorg retired.)

  function ancestors(id: string, opts?: QueryOpts): string[] | Node[] | any[] | undefined {
    checkLock();
    if (!has(id)) { return undefined; }
    // a direct vertical walk up the ancestry path (was: full-tree search()).
    const ids: string[] = walkUp(id);
    const payload = opts?.payload ?? QUERY_TYPE.ID;
    return (payload === QUERY_TYPE.ID || payload === undefined) ? ids : ids.map((nodeId) => get(nodeId, { ...opts, payload }));
  }

  function parent(id: string, opts?: QueryOpts): string | Node | any | undefined {
    checkLock();
    if (!has(id)) { return undefined; }
    // O(1) lookup via the parent index (was: getRelFam → full-tree search()).
    const parentID: string | undefined = ensureParentIndex().get(id);
    if (parentID === undefined) { return ''; }
    const payload = opts?.payload ?? QUERY_TYPE.ID;
    return (payload === QUERY_TYPE.ID || payload === undefined) ? parentID : get(parentID, { ...opts, payload });
  }

  function siblings(id: string, opts?: QueryOpts): string[] | Node[] | any[] | undefined {
    checkLock();
    if (!has(id)) { return undefined; }
    // the parent's other children (parent via the index; [] if id is the root).
    const parentID: string | undefined = ensureParentIndex().get(id);
    const parentNode: Node | undefined = parentID !== undefined
      ? get(parentID, { payload: QUERY_TYPE.NODE })
      : undefined;
    const ids: string[] = parentNode ? parentNode.children.filter((child: string) => child !== id) : [];
    const payload = opts?.payload ?? QUERY_TYPE.ID;
    return (payload === QUERY_TYPE.ID || payload === undefined) ? ids : ids.map((nodeId) => get(nodeId, { ...opts, payload }));
  }

  function children(id: string, opts?: QueryOpts): string[] | Node[] | any[] | undefined {
    checkLock();
    if (!has(id)) { return undefined; }
    // the node's direct child pointers — already stored on the node (no walk).
    // root-anchored: a detached node reads empty (see isRooted()).
    const node: Node | undefined = get(id, { payload: QUERY_TYPE.NODE });
    const ids: string[] = (node && isRooted(id)) ? [...node.children] : [];
    const payload = opts?.payload ?? QUERY_TYPE.ID;
    return (payload === QUERY_TYPE.ID || payload === undefined) ? ids : ids.map((nodeId) => get(nodeId, { ...opts, payload }));
  }

  function descendants(id: string, opts?: QueryOpts): string[] | Node[] | any[] | undefined {
    checkLock();
    if (!has(id)) { return undefined; }
    // a direct vertical walk down the child pointers (was: full-tree search()).
    // root-anchored: a detached node reads empty (see isRooted()).
    const ids: string[] = isRooted(id) ? walkDown(id) : [];
    const payload = opts?.payload ?? QUERY_TYPE.ID;
    return (payload === QUERY_TYPE.ID || payload === undefined) ? ids : ids.map((nodeId) => get(nodeId, { ...opts, payload }));
  }

  function lineage(id: string, opts?: QueryOpts): string[] | Node[] | any[] | undefined {
    checkLock();
    if (!has(id)) { return undefined; }
    // the full vertical line through id: ancestors (up) then descendants (down),
    // excluding id itself — one walkUp + one walkDown, no from-root tree search.
    // root-anchored: a detached node reads empty (see isRooted()).
    const ids: string[] = isRooted(id) ? [...walkUp(id), ...walkDown(id)] : [];
    const payload = opts?.payload ?? QUERY_TYPE.ID;
    return (payload === QUERY_TYPE.ID || payload === undefined) ? ids : ids.map((nodeId) => get(nodeId, { ...opts, payload }));
  }

  function level(id: string): number | undefined  {
    checkLock();
    if (!has(id)) { return undefined; }
    const ancestorIDs = ancestors(id, { payload: QUERY_TYPE.ID }) as string[] | undefined;
    if (ancestorIDs === undefined) { return undefined; }
    return ancestorIDs.length;
  }

  // util

  // the two directional primitives every vertical family query composes from.
  // Each query walks straight up or down from `id` itself:
  // O(depth) / O(subtree), never O(tree).

  // walk UP the parent index from `id` to the root. Returns the ancestry path in
  // top-down order [root, …, parent] (excludes `id`). Backs parent()/ancestors()/
  // lineage(). O(depth).
  function walkUp(id: string): string[] {
    checkLock();
    const pIdx: Map<string, string> = ensureParentIndex();
    const ids: string[] = [];
    const seen: Set<string> = new Set();   // defensive cycle guard
    let cur: string | undefined = pIdx.get(id);
    while (cur !== undefined && !seen.has(cur)) {
      ids.unshift(cur);
      seen.add(cur);
      cur = pIdx.get(cur);
    }
    return ids;
  }

  // walk DOWN the child pointers from `id`. Returns every descendant (excludes `id`)
  // in order: a node's direct children before their subtrees. Backs descendants()/
  // lineage(). O(subtree).
  function walkDown(id: string): string[] {
    const node: Node | undefined = get(id, { payload: QUERY_TYPE.NODE });
    if (node === undefined) { return []; }
    const ids: string[] = [...node.children];
    for (const childID of node.children) {
      ids.push(...walkDown(childID));
    }
    return ids;
  }

  // methods

  function flushTree(): boolean {
    checkLock();
    // flushing tree relations strands every child→parent edge → signal a
    // tree-kind change. (It does NOT touch web attr/link/embed data, so it must
    // NOT stale backRefsIndex — tree-kind leaves web-scoped indexes alone.)
    store.signal({ kind: 'tree', op: 'flushTree' });
    for (const node of (nodes({ payload: QUERY_TYPE.NODE }) as Node[] ?? [])) {
      const isZombie: boolean = (node.state() === NODE.STATE.ZOMBIE);
      /* eslint-disable indent */
      const hasRelRef: boolean = (nodes({ payload: QUERY_TYPE.NODE }) as Node[] ?? []).some((relNode) =>
                                          (relNode.id !== node.id)
                                          &&
                                          (relNode.inAttrs(node.id)
                                          || relNode.inLinks(node.id))
                                        );
      /* eslint-enable indent */
      // delete orphaned zombies
      if (isZombie && !hasRelRef) {
        store.delete(node.id);
        return true;
      }
      // flush
      node.flush(DATA_STRUCT.TREE);
    }
    return true;
  }

  // add

  // (this method is for all the asian pears out there 🍐)
  function graft(
    parentID: string,
    childID: string,
    force: boolean = false,
  ): boolean {
    checkLock();
    if (parentID === childID) {
      console.warn('parentID and childID are the same');
      return false;
    }
    if (!has(parentID)) {
      console.warn(`parent node with id "${parentID}" not in index`);
      return false;
    }
    if (!has(childID)) {
      console.warn(`child node with id "${childID}" not in index`);
      return false;
    }
    if (inTree(childID)) {
      console.warn(`child node with id "${childID}" already exists in the tree`);
      return false;
    }
    get(parentID, { payload: QUERY_TYPE.NODE }).children.push(childID);
    store.signal({ kind: 'tree', op: 'graft', id: childID });
    if (!force && !isTree()) {
      get(parentID, { payload: QUERY_TYPE.NODE }).children.pop();
      return false;
    }
    return true;
  }

  // edit

  // replace the 'source' with the 'target', so in the end the 'target' is in the tree.
  function replace(
    sourceID: string,
    targetID: string,
  ): boolean {
    checkLock();
    if (sourceID === targetID) {
      console.warn('source and target are the same');
      return false;
    }
    const sourceNode: Node | undefined = get(sourceID, { payload: QUERY_TYPE.NODE });
    const targetNode: Node | undefined = get(targetID, { payload: QUERY_TYPE.NODE });
    if (!sourceNode) {
      console.warn(`source node with id "${sourceID}" not in index`);
      return false;
    }
    if (!targetNode) {
      console.warn(`target node with id "${targetID}" not in index`);
      return false;
    }
    // target already in tree
    /* tsignore */
    if ((parent(targetID) !== '') || (targetNode.children.length !== 0)) {
      console.warn(`target with "id" "${targetID}" already exists in tree`);
      return false;
    }
    // parent
    const parentNode: Node | undefined = parent(sourceID, { payload: QUERY_TYPE.NODE });
    if (!parentNode) {
      console.warn(`no parent exists for ${JSON.stringify(sourceNode)}`);
      return false;
    } else {
      const sourceIndex: number= parentNode.children.indexOf(sourceID);
      parentNode.children[sourceIndex] = targetID;
    }
    // children
    targetNode.children = sourceNode.children;
    sourceNode.children = [];
    store.signal({ kind: 'tree', op: 'replace', id: targetID });
    return true;
  }

  // good for handling single index doc edits
  // 'subrootID' should be included in the 'subtree' param
  // note: does not handle zombie creation
  function transplant(
    subrootID: string,
    subtree: { id: string, children: string[] }[],
  ): boolean {
    if (!subtree.find(node => node.id === subrootID)) {
      console.warn(`subroot with id "${subrootID}" not found in the subtree`);
      return false;
    }
    checkLock();
    const subrootNode: Node | undefined = get(subrootID, { payload: QUERY_TYPE.NODE });
    if (!subrootNode) {
      console.warn(`subroot with id "${subrootID}" not found in the index`);
      return false;
    }
    const rollbackState: Map<string, { children: string[] }> = new Map();
    const newSubtreeMap: Map<string, string[]> = new Map(subtree.map(node => [node.id, node.children]));
    // perform changes
    doTransplant(subrootID, newSubtreeMap, rollbackState);
    // signal covers the rollback path too (conservative: children were mutated
    // and restored).
    store.signal({ kind: 'tree', op: 'transplant', id: subrootID });
    // rollback if invalid tree or some other error
    if (!isTree()) {
      console.warn('transplant failed due to invalid resultant tree -- rolling back to previous state');
      rollback(rollbackState);
      return false;
    }
    return true;
  }

  function doTransplant(
    nodeID: string,
    newSubtreeMap: Map<string, string[]>,
    rollbackState: Map<string, { children: string[] }>,
  ): void {
    const node: Node | undefined = get(nodeID, { payload: QUERY_TYPE.NODE });
    if (!node) { return; }
    // save state for possible rollback
    rollbackState.set(nodeID, { children: [...node.children] });
    const newChildIDs: string[] | undefined = newSubtreeMap.get(nodeID);
    if (newChildIDs !== undefined) {
      // update (the node object lives in the store; children mutate in place)
      node.children = newChildIDs;
      store.put(node);
      // recurse
      node.children.forEach(childID =>
        doTransplant(childID, newSubtreeMap, rollbackState)
      );
    }
  }

  // rollback for subtree transplants
  function rollback(rollbackState: Map<string, { children: string[] }>): void {
    for (const [nodeID, originalState] of rollbackState) {
      const node: Node | undefined = get(nodeID, { payload: QUERY_TYPE.NODE });
      if (node === undefined) {
        console.warn(`node with id "${nodeID}" not found in the index when performing rollback`);
        continue;
      }
      node.children = originalState.children;
      store.put(node);
    }
  }

  // rm

  function prune(
    parentID: string,
    childID: string,
    force: boolean = false,
  ): boolean {
    checkLock();
    if (parentID === childID) {
      console.warn('parentID and childID are the same');
      return false;
    }
    if (!has(parentID)) {
      console.warn(`parent node with id "${parentID}" not in index`);
      return false;
    }
    if (!has(childID)) {
      console.warn(`child node with id "${childID}" not in index`);
      return false;
    }
    // check if the node to be pruned is the root or has children
    if (!force && (isRoot(childID) || !isLeaf(childID))) {
      console.warn('cannot prune root or non-leaf child node');
      return false;
    }
    const parentNode = get(parentID, { payload: QUERY_TYPE.NODE });
    const childIndex = parentNode.children.indexOf(childID);
    if (childIndex === -1) {
      console.warn(`child node with id "${childID}" is not a child of parent "${parentID}"`);
      return false;
    }
    // Remove the child from the parent's children array
    parentNode.children.splice(childIndex, 1);
    // If the resulting structure is not a valid tree, revert the change
    if (!force && !isTree()) {
      parentNode.children.push(childID);
      return false;   // reverted → no net child change, index still valid
    }
    store.signal({ kind: 'tree', op: 'prune', id: childID });
    return true;
  }

  // tree utils

  function inTree(id: string): boolean {
    checkLock();
    // "in the tree" == has a parent (the root has no parent and is false here
    // too, matching the old full-scan semantics). O(1).
    return ensureParentIndex().has(id);
  }

  function isRoot(id: string): boolean {
    checkLock();
    return (id === root());
  }

  function isLeaf(id: string): boolean {
    checkLock();
    return (children(id)?.length === 0);
  }

  function isTree(
    curNode: Node | undefined = root({ payload: QUERY_TYPE.NODE }),
    visited: Set<string> = new Set()
  ): boolean {
    checkLock();
    if (curNode === undefined) {
      console.warn('node is undefined');
      return false;
    }
    if (visited.has(curNode.id)) {
      console.warn(`node with id "${curNode.id}" already visited`);
      return false;
    }
    visited.add(curNode.id);
    for (const childId of curNode.children) {
      const childNode = get(childId, { payload: QUERY_TYPE.NODE });
      if (childNode === undefined) {
        console.warn(`node with id "${childId}" not found`);
        return false;
      }
      if (!isTree(childNode, visited)) {
        return false;
      }
    }
    return true;
  }

  // whether `id` is currently connected to the root. The relational family queries
  // are root-anchored: a node detached from the root — e.g. a force-pruned subtree —
  // keeps its raw child pointers on the node (get().children) but reads empty
  // through children()/descendants()/lineage() until it is re-grafted.
  // O(depth), short-circuits at root.
  function isRooted(id: string): boolean {
    const pIdx: Map<string, string> = ensureParentIndex();
    if (id === ctx.root) { return true; }
    const seen: Set<string> = new Set();   // defensive cycle guard
    let cur: string | undefined = pIdx.get(id);
    while (cur !== undefined && !seen.has(cur)) {
      if (cur === ctx.root) { return true; }
      seen.add(cur);
      cur = pIdx.get(cur);
    }
    return false;
  }

  // 'key' -- the data key to print
  function printTree(key: string, printout: boolean = true): string {
    checkLock();
    const rootNode: Node | undefined = root({ payload: QUERY_TYPE.NODE });
    if (rootNode === undefined) {
      throw new Error('root undefined');
    }
    const treeStr: string = buildTreeString(key, rootNode, '', true);
    if (printout) {
      console.log(treeStr);
    }
    return treeStr;
  }

  function buildTreeString(key: string, node: Node, prefix: string = '', isRootNode: boolean = false): string {
    let result = isRootNode
      ? `${node.id}: ${JSON.stringify(node.data[key]) || 'node not found'}\n`
      : '';
    node.children.forEach((childID: string, index: number) => {
      const childNode = get(childID, { payload: QUERY_TYPE.NODE });
      if (childNode === undefined) {
        return;
      }
      const isLastChild: boolean = (index === node.children.length - 1);
      const childPrefix: string = prefix + (isLastChild ? '└── ' : '├── ');
      const grandchildPrefix: string = prefix + (isLastChild ? '    ' : '│   ');
      const subtree: string = buildTreeString(key, childNode, grandchildPrefix);
      result += childPrefix + `${childNode.id}: ${JSON.stringify(childNode.data[key]) || 'node not found'}\n` + subtree;
    });
    return result;
  }

  return {
    parentIndex,
    get parentIndexDirty(): boolean { return parentIndex.dirty; },
    invalidateParentIndex,
    rebuildParentIndex,
    ensureParentIndex,
    get _root(): string | undefined { return ctx.root; },
    setRoot,
    root,
    ancestors,
    parent,
    siblings,
    children,
    descendants,
    lineage,
    level,
    walkUp,
    walkDown,
    flushTree,
    graft,
    replace,
    transplant,
    prune,
    inTree,
    isRoot,
    isLeaf,
    isTree,
    isRooted,
    printTree,
    buildTreeString,
  };
}

// a base+tree composition (≈ the old `Tree(Base)`).
export const createTree: (items: BaseNodeData[] | any[], opts?: Partial<CaudexOpts>) => BaseAPI & TreeAPI =
  compose([base, tree]);
