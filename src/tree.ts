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
        console.warn(`node with id ${id} not in index`);
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

    // graft 'node' onto the tree based on the given 'path' where 
    // each entry maps to a node's given data 'dataKey'.
    // when to use:
    //  - on tree initialization.
    //  - a new file is created.
    // (this method is for all the asian pears out there 🍐)
    // todo: is there a better way to validate node? (ex: top level node with no parent can't possibly be in tree, so why traverse whole tree?)
    public graft(
      nodeID: string,
      path: any[],
      key: string,
      curNode: Node = {} as Node,
      depth: number = 0,
    ): boolean {
      this.checkLock();
      if (!this.has(nodeID)) { return false; }
      let nextNode: Node | undefined;
      let nextDepth: number;
      // handle root and validation
      if (depth === 0) {
        const rootNode: Node | undefined = this.root(QUERY_TYPE.NODE);
        if (rootNode === undefined) { console.warn('root undefined'); return false; }
        curNode = rootNode;
      }
      // do not recurse forever
      if (depth > path.length) {
        console.warn('depth greater than given "path" size');
        return false;
      }
      nextNode = undefined;
      // if parent reached -- graft / insert
      if (depth === (path.length - 1)) {
        if (!curNode.children.includes(nodeID)) {
          curNode.children.push(nodeID);
          // check if new tree structure is valid.
          if (this.isTree()) {
            return true;
          // undo if invalid
          } else {
            curNode.children.pop();
            return false;
          }
        } else {
          return false;
        }
      // create zombie nodes along path if one does not exist
      } else {
        nextDepth = depth + 1;
        // get node with the given description, regardless if it's listed as a child or not
        nextNode = this.find(key, path[nextDepth]);
        let nextNodeID: string | undefined = nextNode?.id;
        if (nextNodeID === undefined) {
          const zombieNode: Node | undefined = this.add(path[nextDepth]);
          if (zombieNode === undefined) { return false; }
          nextNodeID = zombieNode.id;
          curNode.children.push(nextNodeID);
          // to recurse
          nextNode = this.get(nextNodeID);
        }
      }
      // recurse
      return this.graft(nodeID, path, key, nextNode, nextDepth);
    }

    // edit

    // replace the 'source' with the 'target', so in the end the 'target' is in the tree.
    public replace(
      source: string,
      target: string,
    ): Node | undefined {
      this.checkLock();
      const sourceNode: Node | undefined = this.get(source);
      const targetNode: Node | undefined = this.get(target);
      if (!sourceNode || !targetNode) {
        return undefined;
      }
      // target already in tree
      if ((this.parent(target) !== '') || (targetNode.children.length !== 0)) {
        console.warn(`target with "id" "${target}" already exists in tree`);
        return undefined;
      }
      // parent
      const parentNode: Node | undefined = this.parent(source, QUERY_TYPE.NODE);
      if (!parentNode) {
        console.warn(`no parent exists for ${JSON.stringify(sourceNode)}`);
        return undefined;
      } else {
        const sourceIndex: number= parentNode.children.indexOf(source);
        parentNode.children[sourceIndex] = target;
      }
      // children
      targetNode.children = sourceNode.children;
      sourceNode.children = [];
      return targetNode;
    }

    // rm

    public prune(
      nodeID: string,
      path: any[],
      key: string,
      curNode: Node = {} as Node,
      depth: number = 0,
    ): boolean {
      this.checkLock();
      const doesNotExist: boolean = !this.has(nodeID);
      const isRoot: boolean = (nodeID === this.root());
      const hasChildren: boolean = (this.get(nodeID)?.children.length !== 0);
      if (doesNotExist || isRoot || hasChildren) { return false; }
      // handle root and validation
      if (depth === 0) {
        const rootNode: Node | undefined = this.root(QUERY_TYPE.NODE);
        if (rootNode === undefined) {
          console.warn('root undefined');
          return false;
        }
        curNode = rootNode;
      }
      // if parent reached -- prune
      if (depth === (path.length - 1)) {
        const childIndex: number | undefined = curNode.children.findIndex((child: string) => child === nodeID);
        curNode.children.splice(childIndex, 1);
        return true;
      // create zombie nodes along path if one does not exist
      } else {
        const nextDepth: number = depth + 1;
        const nextNodeID: string | undefined = curNode.children.find((child: string) => {
          if (
            (this.get(child)?.data[key] === path[nextDepth])
            || ((key === this.zombieKey)
            && (this.get(child)?.data['zombie'] === path[nextDepth]))
          ) {
            return child;
          }
        });
        if (nextNodeID === undefined) { console.warn('invalid path'); return false; }
        // recurse
        const nextNode: Node | undefined = this.get(nextNodeID);
        if (nextNode === undefined) { return false; }
        return this.prune(nodeID, path, key, nextNode, nextDepth);
      }
    }

    // tree utils

    public isTree(
      curNode: Node | undefined = {} as Node,
      visited: Node[] = [],
      depth: number = 0
    ): boolean {
      this.checkLock();
      // handle root
      if (depth === 0) {
        curNode = this.root(QUERY_TYPE.NODE);
        if (curNode === undefined) {
          console.warn('root undefined');
          return false;
        }
      }
      // invalid
      if (visited.includes(curNode)) {
        return false;
      }
      // continue...
      else {
        visited.push(curNode);
      }
      const results: boolean[] = [];
      for (const child of curNode.children) {
        const nextNode: Node | undefined = this.get(child);
        if (nextNode === undefined) {
          console.warn(`node with id ${child} not found`);
          return false;
        }
        results.concat(this.isTree(curNode, visited, depth + 1));
      }
      return results.every((r: boolean) => r);
    }

    public printTree(node: Node | undefined = this.root(QUERY_TYPE.NODE), depth: number = 0, result: string = ''): void {
      this.checkLock();
      if (node === undefined) {
        throw new Error('root undefined');
      }
      result += `\n\nLevel: ${depth}\nNode: ${JSON.stringify(node)};\nChildren: ${JSON.stringify(node.children)}`;
      for (const child of node.children) {
        this.printTree(this.get(child), depth + 1, result);
      }
      console.log(result);
    }

    // public print(node: Node | undefined = this.root, depth: number = 0): void {
    //   if (node === undefined) { throw new Error("root undefined"); };
    //   console.log(`\n\nLevel: ${depth}\nNode: ${JSON.stringify(node)};\nChildren: ${JSON.stringify(node.children)}`);
    //   for (let child of node.children) {
    //     this.print(child, depth + 1);
    //   }
    // }

  };
}
