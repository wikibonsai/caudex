import type { Mixin, PayloadOpt, QueryOpts } from './types';
import { DATA_STRUCT, NODE, QUERY_TYPE, REL } from './const';
import { Node } from './node';


export function Tree<TBase extends Mixin>(Base: TBase) {
  return class Tree extends Base {
    public _root: string | undefined;

    // root operations

    // note: typescript does not allow for separate types between get/set
    //  - https://github.com/microsoft/TypeScript/issues/43662
    //  - https://github.com/microsoft/TypeScript/issues/32821
    //  - https://github.com/microsoft/TypeScript/issues/2521

    public setRoot(id: string): boolean {
      this.checkLock();
      if (!this.has(id)) {
        console.warn(`node with id "${id}" not in index`);
        return false;
      }
      this._root = id;
      if (this._root) { return true; }
      return false;
    }

    // todo...?
    // public hasRoot(): boolean {
    //   const hasRoot: boolean = (this._root !== undefined);
    //   if (!hasRoot) { console.warn("root undefined"); }
    //   return hasRoot;
    // }

    // properties

    // tree-lvl

    root(opts?: QueryOpts | PayloadOpt): string | Node | any | undefined {
      this.checkLock();
      if (this._root === undefined) { return undefined; }
      const queryOpts = (opts === undefined || typeof opts === 'string' || Array.isArray(opts)) ? { payload: opts ?? QUERY_TYPE.ID } : opts;
      return this.get(this._root, queryOpts);
    }

    orphans(treeIDs: string[], opts?: QueryOpts | PayloadOpt): string[] | Node[] | any[] | undefined {
      this.checkLock();
      const queryOpts: QueryOpts = (opts === undefined || typeof opts === 'string' || Array.isArray(opts))
        ? { payload: opts ?? QUERY_TYPE.ID }
        : opts as QueryOpts;
      const payload = queryOpts?.payload ?? QUERY_TYPE.ID;
      /* eslint-disable indent */
      return (this.all({ ...queryOpts, payload: QUERY_TYPE.NODE }) as Node[] ?? [])
                 .filter((node: Node) =>
                    treeIDs.includes(node.id)
                    && (node.children.length === 0)
                    && !this.parent(node.id)
                    && (node.kind !== NODE.KIND.ZOMBIE)
                 ).map((node: Node) =>
                   this.get(node.id, { ...queryOpts, payload })
                 );
      /* eslint-enable indent */
    }

    ancestors(id: string, opts?: QueryOpts | PayloadOpt): string[] | Node[] | any[] | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids: string[] = this.getRelFam(id, REL.FAM.ANCESTORS);
      const queryOpts = (opts === undefined || typeof opts === 'string' || Array.isArray(opts)) ? { payload: opts ?? QUERY_TYPE.ID } : opts;
      const payload = queryOpts?.payload ?? QUERY_TYPE.ID;
      return (payload === QUERY_TYPE.ID || payload === undefined) ? ids : ids.map((nodeId) => this.get(nodeId, { ...queryOpts, payload }));
    }

    parent(id: string, opts?: QueryOpts | PayloadOpt): string | Node | any | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids = this.getRelFam(id, REL.FAM.PARENT);
      if (ids.length === 0) { return ''; }
      const queryOpts = (opts === undefined || typeof opts === 'string' || Array.isArray(opts)) ? { payload: opts ?? QUERY_TYPE.ID } : opts;
      const payload = queryOpts?.payload ?? QUERY_TYPE.ID;
      return (payload === QUERY_TYPE.ID || payload === undefined) ? ids[0] : this.get(ids[0], { ...queryOpts, payload });
    }

    siblings(id: string, opts?: QueryOpts | PayloadOpt): string[] | Node[] | any[] | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids = this.getRelFam(id, REL.FAM.SIBLINGS);
      const queryOpts = (opts === undefined || typeof opts === 'string' || Array.isArray(opts)) ? { payload: opts ?? QUERY_TYPE.ID } : opts;
      const payload = queryOpts?.payload ?? QUERY_TYPE.ID;
      return (payload === QUERY_TYPE.ID || payload === undefined) ? ids : ids.map((nodeId) => this.get(nodeId, { ...queryOpts, payload }));
    }

    children(id: string, opts?: QueryOpts | PayloadOpt): string[] | Node[] | any[] | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids = this.getRelFam(id, REL.FAM.CHILDREN);
      const queryOpts = (opts === undefined || typeof opts === 'string' || Array.isArray(opts)) ? { payload: opts ?? QUERY_TYPE.ID } : opts;
      const payload = queryOpts?.payload ?? QUERY_TYPE.ID;
      return (payload === QUERY_TYPE.ID || payload === undefined) ? ids : ids.map((nodeId) => this.get(nodeId, { ...queryOpts, payload }));
    }

    descendants(id: string, opts?: QueryOpts | PayloadOpt): string[] | Node[] | any[] | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids = this.getRelFam(id, REL.FAM.DESCENDANTS);
      const queryOpts = (opts === undefined || typeof opts === 'string' || Array.isArray(opts)) ? { payload: opts ?? QUERY_TYPE.ID } : opts;
      const payload = queryOpts?.payload ?? QUERY_TYPE.ID;
      return (payload === QUERY_TYPE.ID || payload === undefined) ? ids : ids.map((nodeId) => this.get(nodeId, { ...queryOpts, payload }));
    }

    lineage(id: string, opts?: QueryOpts | PayloadOpt): string[] | Node[] | any[] | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids = this.getRelFam(id, REL.FAM.LINEAGE);
      const queryOpts = (opts === undefined || typeof opts === 'string' || Array.isArray(opts)) ? { payload: opts ?? QUERY_TYPE.ID } : opts;
      const payload = queryOpts?.payload ?? QUERY_TYPE.ID;
      return (payload === QUERY_TYPE.ID || payload === undefined) ? ids : ids.map((nodeId) => this.get(nodeId, { ...queryOpts, payload }));
    }

    level(id: string): number | undefined  {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ancestors = this.ancestors(id, { payload: QUERY_TYPE.ID }) as string[] | undefined;
      if (ancestors === undefined) { return undefined; }
      return ancestors.length;
    }

    // util

    public getRelFam(id: string, relFam: REL.FAM): string[] {
      this.checkLock();
      // if uri does not exist in index
      if (!this.has(id)) { return []; }
      // prep data collection
      const initRelFamData: Record<REL.FAM, string[]> = {} as Record<REL.FAM, string[]>;
      initRelFamData[relFam] = [];
      // get target family uris
      const famIDs: Record<REL.FAM, string[]> | undefined = this.search(id, initRelFamData);
      return (famIDs === undefined) ? [] : famIDs[relFam];
    }

    // todo
    // public getFamRels(id: string, relFams: REL.FAM[]): Record<REL.FAM, string[]> {
    //   // if uri does not exist in index
    //   if (!this.has(id)) { return {} as Record<REL.FAM, string[]>; }
    //   // prep data collection
    //   const initFamRelsData: Record<REL.FAM, string[]> = {} as Record<REL.FAM, string[]>;
    //   for (const famRel of relFams) {
    //     initFamRelsData[famRel] = [];
    //   }
    //   // get target family uris
    //   const relFamsData: Record<REL.FAM, string[]> | undefined = this.search(id, initFamRelsData);
    //   return (relFamsData === undefined) ? {} as Record<REL.FAM, string[]> : relFamsData;
    // }

    // usage note: use getter wrappers plz
    public search(
      nodeID:string,
      relData: Record<REL.FAM, string[]>,
      node: Node | undefined = {} as Node,
      depth: number = 0,
      found: boolean = false,
    ): Record<REL.FAM, string[]> | undefined {
      this.checkLock();
      // handle root + init result info
      if (depth === 0) {
        node = this.root({ payload: QUERY_TYPE.NODE });
        if (node === undefined) { Error('root undefined'); return undefined; }
      }
      const atTargetNode: boolean = (nodeID === node.id);
      if (atTargetNode || found) {
        // at target node
        if (atTargetNode) {
          if (REL.FAM.CHILDREN in relData) {
            relData['children'] = node.children;
          }
        }
        // already found -- continue building 'descendants' / 'lineage'
        if (REL.FAM.DESCENDANTS in relData) {
          relData['descendants'] = relData['descendants'].concat(node.children);
        }
        if (REL.FAM.LINEAGE in relData) {
          relData['lineage'] = relData['lineage'].concat(node.children);
        }
        if ((REL.FAM.DESCENDANTS in relData) || (REL.FAM.LINEAGE in relData)) {
          for (const child of node.children) {
            const nextNode: Node | undefined = this.get(child, { payload: QUERY_TYPE.NODE });
            if (nextNode === undefined) { return undefined; }
            this.search(nodeID, relData, nextNode, depth + 1, true);
          }
        }
        return relData;
      // still searching or building
      } else {
        if (REL.FAM.ANCESTORS in relData) {
          relData['ancestors'].push(node.id);
        }
        if (REL.FAM.LINEAGE in relData) {
          relData['lineage'].push(node.id);
        }
        // if current node is the target's parent
        const targetNodeID: string | undefined = node.children.find((child: string) => child === nodeID);
        if (targetNodeID !== undefined) {
          const targetNode = this.get(targetNodeID, { payload: QUERY_TYPE.NODE });
          if (targetNode === undefined) { return undefined; }
          if (REL.FAM.PARENT in relData) {
            relData['parent'] = [node.id];
          }
          if (REL.FAM.SIBLINGS in relData) {
            relData['siblings'] = node.children.filter((child: string) => child !== nodeID);
          }
          const result = this.search(nodeID,  relData, targetNode, depth + 1);
          if (result !== undefined) { return result; }
        // keep searching
        } else {
          for (const child of node.children) {
            const nextNode: Node | undefined = this.get(child, { payload: QUERY_TYPE.NODE });
            if (nextNode === undefined) { return undefined; }
            // there should only be one unique path, so return only that one result
            const result = this.search(nodeID, JSON.parse(JSON.stringify(relData)), nextNode, depth + 1);
            if (result !== undefined) { return result; }
          }
        }
      }
    }

    // methods

    public flushRelFams(): boolean {
      this.checkLock();
      for (const node of (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? [])) {
        const isZombie: boolean = (node.kind === NODE.KIND.ZOMBIE);
        /* eslint-disable indent */
        const hasRelRef: boolean = (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? []).some((relNode) => 
                                            (relNode.id !== node.id) 
                                            &&
                                            (relNode.inAttrs(node.id)
                                            || relNode.inLinks(node.id))
                                          );
        /* eslint-enable indent */
        // delete orphaned zombies
        if (isZombie && !hasRelRef) {
          delete this.index[node.id];
          return true;
        }
        // flush
        node.flush(DATA_STRUCT.TREE);
      }
      return true;
    }

    // add

    // (this method is for all the asian pears out there 🍐)
    public graft(
      parentID: string,
      childID: string,
      force: boolean = false,
    ): boolean {
      this.checkLock();
      if (parentID === childID) {
        console.warn('parentID and childID are the same');
        return false;
      }
      if (!this.has(parentID)) {
        console.warn(`parent node with id "${parentID}" not in index`);
        return false;
      }
      if (!this.has(childID)) {
        console.warn(`child node with id "${childID}" not in index`);
        return false;
      }
      if (this.inTree(childID)) {
        console.warn(`child node with id "${childID}" already exists in the tree`);
        return false;
      }
      this.get(parentID, { payload: QUERY_TYPE.NODE }).children.push(childID);
      if (!force && !this.isTree()) {
        this.get(parentID, { payload: QUERY_TYPE.NODE }).children.pop();
        return false;
      }
      return true;
    }

    // edit

    // replace the 'source' with the 'target', so in the end the 'target' is in the tree.
    public replace(
      sourceID: string,
      targetID: string,
    ): boolean {
      this.checkLock();
      if (sourceID === targetID) {
        console.warn('source and target are the same');
        return false;
      }
      const sourceNode: Node | undefined = this.get(sourceID, { payload: QUERY_TYPE.NODE });
      const targetNode: Node | undefined = this.get(targetID, { payload: QUERY_TYPE.NODE });
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
      if ((this.parent(targetID) !== '') || (targetNode.children.length !== 0)) {
        console.warn(`target with "id" "${targetID}" already exists in tree`);
        return false;
      }
      // parent
      const parentNode: Node | undefined = this.parent(sourceID, { payload: QUERY_TYPE.NODE });
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
      return true;
    }

    // good for handling single index doc edits
    // 'subrootID' should be included in the 'subtree' param
    // note: does not handle zombie creation
    public transplant(
      subrootID: string,
      subtree: { id: string, children: string[] }[],
    ): boolean {
      if (!subtree.find(node => node.id === subrootID)) {
        console.warn(`subroot with id "${subrootID}" not found in the subtree`);
        return false;
      }
      this.checkLock();
      const subrootNode: Node | undefined = this.get(subrootID, { payload: QUERY_TYPE.NODE });
      if (!subrootNode) {
        console.warn(`subroot with id "${subrootID}" not found in the index`);
        return false;
      }
      const rollbackState: Map<string, { children: string[] }> = new Map();
      const newSubtreeMap: Map<string, string[]> = new Map(subtree.map(node => [node.id, node.children]));
      // perform changes
      this.doTransplant(subrootID, newSubtreeMap, rollbackState);
      // rollback if invalid tree or some other error
      if (!this.isTree()) {
        console.warn('transplant failed due to invalid resultant tree -- rolling back to previous state');
        this.rollback(rollbackState);
        return false;
      }
      return true;
    }

    public doTransplant(
      nodeID: string,
      newSubtreeMap: Map<string, string[]>,
      rollbackState: Map<string, { children: string[] }>,
    ): void {
      const node: Node | undefined = this.get(nodeID, { payload: QUERY_TYPE.NODE });
      if (!node) { return; }
      // save state for possible rollback
      rollbackState.set(nodeID, { children: [...node.children] });
      const newChildIDs: string[] | undefined = newSubtreeMap.get(nodeID);
      if (newChildIDs !== undefined) {
        // update
        node.children = newChildIDs;
        this.index[nodeID] = node;
        // recurse
        node.children.forEach(childID => 
          this.doTransplant(childID, newSubtreeMap, rollbackState)
        );
      }
    }

    // rollback for subtree transplants
    public rollback(rollbackState: Map<string, { children: string[] }>): void {
      for (const [nodeID, originalState] of rollbackState) {
        const node: Node | undefined = this.get(nodeID, { payload: QUERY_TYPE.NODE });
        if (node === undefined) {
          console.warn(`node with id "${nodeID}" not found in the index when performing rollback`);
          continue;
        }
        node.children = originalState.children;
        this.index[nodeID] = node;
      }
    }

    // rm

    public prune(
      parentID: string,
      childID: string,
      force: boolean = false,
    ): boolean {
      this.checkLock();
      if (parentID === childID) {
        console.warn('parentID and childID are the same');
        return false;
      }
      if (!this.has(parentID)) {
        console.warn(`parent node with id "${parentID}" not in index`);
        return false;
      }
      if (!this.has(childID)) {
        console.warn(`child node with id "${childID}" not in index`);
        return false;
      }
      // check if the node to be pruned is the root or has children
      if (!force && (this.isRoot(childID) || !this.isLeaf(childID))) {
        console.warn('cannot prune root or non-leaf child node');
        return false;
      }
      const parentNode = this.get(parentID, { payload: QUERY_TYPE.NODE });
      const childIndex = parentNode.children.indexOf(childID);
      if (childIndex === -1) {
        console.warn(`child node with id "${childID}" is not a child of parent "${parentID}"`);
        return false;
      }
      // Remove the child from the parent's children array
      parentNode.children.splice(childIndex, 1);
      // If the resulting structure is not a valid tree, revert the change
      if (!force && !this.isTree()) {
        parentNode.children.push(childID);
        return false;
      }
      return true;
    }

    // tree utils

    public inTree(id: string): boolean {
      this.checkLock();
      /* eslint-disable indent */
      return ((this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? [])
                  .find(node => node.children.includes(id)) !== undefined);
      /* eslint-enable indent */
    }

    public isRoot(id: string): boolean {
      this.checkLock();
      return (id === this.root());
    }

    public isLeaf(id: string): boolean {
      this.checkLock();
      return (this.children(id)?.length === 0);
    }

    public isTree(
      curNode: Node | undefined = this.root({ payload: QUERY_TYPE.NODE }),
      visited: Set<string> = new Set()
    ): boolean {
      this.checkLock();
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
        const childNode = this.get(childId, { payload: QUERY_TYPE.NODE });
        if (childNode === undefined) {
          console.warn(`node with id "${childId}" not found`);
          return false;
        }
        if (!this.isTree(childNode, visited)) {
          return false;
        }
      }
      return true;
    }

    // 'key' -- the data key to print
    public printTree(key: string, printout: boolean = true): string {
      this.checkLock();
      const rootNode: Node | undefined = this.root({ payload: QUERY_TYPE.NODE });
      if (rootNode === undefined) {
        throw new Error('root undefined');
      }
      const treeStr: string = this.buildTreeString(key, rootNode, '', true);
      if (printout) {
        console.log(treeStr);
      }
      return treeStr;
    }

    public buildTreeString(key: string, node: Node, prefix: string = '', isRoot: boolean = false): string {
      let result = isRoot
        ? `${node.id}: ${JSON.stringify(node.data[key]) || 'node not found'}\n`
        : '';
      node.children.forEach((childID: string, index: number) => {
        const childNode = this.get(childID, { payload: QUERY_TYPE.NODE });
        if (childNode === undefined) {
          return;
        }
        const isLastChild: boolean = (index === node.children.length - 1);
        const childPrefix: string = prefix + (isLastChild ? '└── ' : '├── ');
        const grandchildPrefix: string = prefix + (isLastChild ? '    ' : '│   ');
        const subtree: string = this.buildTreeString(key, childNode, grandchildPrefix);
        result += childPrefix + `${childNode.id}: ${JSON.stringify(childNode.data[key]) || 'node not found'}\n` + subtree;
      });
      return result;
    }
  };
}
