import type { Mixin } from './types';
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

    // types
    root(query?: QUERY_TYPE.ID): string | undefined;
    root(query: QUERY_TYPE.NODE): Node | undefined;
    root(query: string | string[]): any | undefined;
    // define
    root(query: string | string[] = QUERY_TYPE.ID): string | Node | any | undefined {
      this.checkLock();
      if (this._root === undefined) { return undefined; }
      return this.get(this._root, query);
    }

    // nodes that are not linked to any other node in the tree
    // types
    orphans(treeIDs: string[], query?: QUERY_TYPE.ID): string[] | undefined;
    orphans(treeIDs: string[], query: QUERY_TYPE.NODE): Node[] | undefined;
    orphans(treeIDs: string[], query: string | string[]): string[] | Node[] | any[] | undefined;
    // define
    orphans(treeIDs: string[], query: string | string[] = QUERY_TYPE.ID): Node[] | any[] | undefined {
      this.checkLock();
      /* eslint-disable indent */
      return this.all(QUERY_TYPE.NODE)
                 .filter((node: Node) =>
                    treeIDs.includes(node.id)
                    && (node.children.length === 0)
                    && !this.parent(node.id)
                    && (node.kind !== NODE.KIND.ZOMBIE)
                 ).map((node: Node) =>
                   this.get(node.id, query)
                 );
      /* eslint-enable indent */
    }

    // node-lvl

    // types
    ancestors(id: string, query?: QUERY_TYPE.ID): string[] | undefined;
    ancestors(id: string, query: QUERY_TYPE.NODE): Node[] | undefined;
    ancestors(id: string, query: string | string[]): any[] | undefined;
    // define
    ancestors(id: string, query: string | string[] = QUERY_TYPE.ID): string[] | Node[] | any[] | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids: string[] = this.getRelFam(id, REL.FAM.ANCESTORS);
      return (query === QUERY_TYPE.ID) ? ids : ids.map((id) => this.get(id, query));
    }

    // types
    parent(id: string, query?: QUERY_TYPE.ID): string | undefined;
    parent(id: string, query: QUERY_TYPE.NODE): Node | undefined;
    parent(id: string, query: string | string[]): any | undefined;
    // define
    parent(id: string, query: string | string[] = QUERY_TYPE.ID): string | any | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids = this.getRelFam(id, REL.FAM.PARENT);
      // no parent
      if (ids.length === 0) { return ''; }
      return (query === QUERY_TYPE.ID) ? ids[0] : this.get(ids[0], query);
    }

    // types
    siblings(id: string, query?: QUERY_TYPE.ID): string[] | undefined;
    siblings(id: string, query: QUERY_TYPE.NODE): Node[] | undefined;
    siblings(id: string, query: string | string[]): any[] | undefined;
    // define
    siblings(id: string, query: string | string[] = QUERY_TYPE.ID): string[] | any[] | undefined  {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids = this.getRelFam(id, REL.FAM.SIBLINGS);
      return (query === QUERY_TYPE.ID) ? ids : ids.map((id) => this.get(id, query));
    }

    // types
    children(id: string, query?: QUERY_TYPE.ID): string[] | undefined;
    children(id: string, query: QUERY_TYPE.NODE): Node[] | undefined;
    children(id: string, query: string | string[]): any[] | undefined;
    // define
    children(id: string, query: string | string[] = QUERY_TYPE.ID): string[] | any[] | undefined  {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids = this.getRelFam(id, REL.FAM.CHILDREN);
      return (query === QUERY_TYPE.ID) ? ids : ids.map((id) => this.get(id, query));
    }

    // types
    descendants(id: string, query?: QUERY_TYPE.ID): string[] | undefined;
    descendants(id: string, query: QUERY_TYPE.NODE): Node[] | undefined;
    descendants(id: string, query: string | string[]): any[] | undefined;
    // define
    descendants(id: string, query: string | string[] = QUERY_TYPE.ID): string[] | any | undefined  {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids = this.getRelFam(id, REL.FAM.DESCENDANTS);
      return (query === QUERY_TYPE.ID) ? ids : ids.map((id) => this.get(id, query));
    }

    // types
    lineage(id: string, query?: QUERY_TYPE.ID): string[] | undefined;
    lineage(id: string, query: QUERY_TYPE.NODE): Node[] | undefined;
    lineage(id: string, query: string | string[]): any[] | undefined;
    // define
    lineage(id: string, query: string | string[] = QUERY_TYPE.ID): string[] | any | undefined  {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ids = this.getRelFam(id, REL.FAM.LINEAGE);
      return (query === QUERY_TYPE.ID) ? ids : ids.map((id) => this.get(id, query));
    }

    level(id: string): number | undefined  {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const ancestors: string[] | undefined = this.ancestors(id);
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
        node = this.root(QUERY_TYPE.NODE);
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
            const nextNode: Node | undefined = this.get(child);
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
          const targetNode = this.get(targetNodeID);
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
            const nextNode: Node | undefined = this.get(child);
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
      for (const node of this.all(QUERY_TYPE.NODE)) {
        const isZombie: boolean = (node.kind === NODE.KIND.ZOMBIE);
        /* eslint-disable indent */
        const hasRelRef: boolean = this.all(QUERY_TYPE.NODE).some((relNode) => 
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
      this.get(parentID, QUERY_TYPE.NODE).children.push(childID);
      if (force || !this.isTree()) {
        this.get(parentID, QUERY_TYPE.NODE).children.pop();
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
      const sourceNode: Node | undefined = this.get(sourceID);
      const targetNode: Node | undefined = this.get(targetID);
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
      const parentNode: Node | undefined = this.parent(sourceID, QUERY_TYPE.NODE);
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
      const subrootNode: Node | undefined = this.get(subrootID);
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

    private doTransplant(
      nodeID: string,
      newSubtreeMap: Map<string, string[]>,
      rollbackState: Map<string, { children: string[] }>,
    ): void {
      const node: Node | undefined = this.get(nodeID);
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
    private rollback(rollbackState: Map<string, { children: string[] }>): void {
      for (const [nodeID, originalState] of rollbackState) {
        const node: Node | undefined = this.get(nodeID);
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
      if (this.isRoot(childID) || !this.isLeaf(childID)) {
        console.warn('cannot prune root or non-leaf child node');
        return false;
      }
      const parentNode = this.get(parentID, QUERY_TYPE.NODE);
      const childIndex = parentNode.children.indexOf(childID);
      if (childIndex === -1) {
        console.warn(`child node with id "${childID}" is not a child of parent "${parentID}"`);
        return false;
      }
      // Remove the child from the parent's children array
      parentNode.children.splice(childIndex, 1);
      // If the resulting structure is not a valid tree, revert the change
      if (force || !this.isTree()) {
        parentNode.children.push(childID);
        return false;
      }
      return true;
    }

    // tree utils

    public inTree(id: string): boolean {
      this.checkLock();
      /* eslint-disable indent */
      return (this.all(QUERY_TYPE.NODE)
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
      curNode: Node | undefined = this.root(QUERY_TYPE.NODE),
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
        const childNode = this.get(childId);
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
    public printTree(key: string): void {
      this.checkLock();
      const node: Node | undefined = this.root(QUERY_TYPE.NODE);
      if (node === undefined) {
        throw new Error('root undefined');
      }
      console.log(this.buildTreeString(key, node));
    }

    // for tree printing
    private buildTreeString(key: string, node: Node, prefix: string = ''): string {
      let result = `${prefix}${node.id}: ${JSON.stringify(node.data[key]) || 'Untitled'}\n`;
      node.children.forEach((childID: string, index: number) => {
        const childNode = this.get(childID);
        if (childNode === undefined) {
          return result;
        }
        const isLastChild = index === node.children.length - 1;
        const childPrefix = prefix + (isLastChild ? '└── ' : '├── ');
        // const grandchildPrefix = prefix + (isLastChild ? '    ' : '│   ');
        result += this.buildTreeString(key, childNode, childPrefix);
      });
      return result;
    }
  };
}
