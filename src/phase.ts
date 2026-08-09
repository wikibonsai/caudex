import type { Mixin, QueryOpts, PayloadOpt } from './types';
import { NODE, QUERY_TYPE } from './const';
import { Node } from './node';
import { DerivedIndex, StoragePort } from './store';


// the phase layer -- the node's integration phase: tree x web attachment, a
// lifecycle of increasing connectedness, DERIVED per-node (TERMS.md):
//
//                 in web        not in web
//   in tree     integrated     wallflower
//   not in tree   orphan         isolate
//
// phase is a CROSS-axis concern, so it sits ABOVE the tree and web mixins
// in the chain ('Caudex = Phase(Web(Tree(Base)))') -- neither axis alone can
// answer it, and a tree-only or web-only composition correctly lacks it.
//
// the derivation itself lives on the node: 'node.phase()' evaluates lazily
// against the attachment indexes below via the graph context bound at node
// creation (base.graphCtx()). This layer registers those indexes and provides
// the BULK queries; any node reports its phase truthfully through
// 'node.phase()', but zombies are gated out of 'phases()' and the cell
// queries by state (health ratios count only live docs).
//
// the two attachment axes are derived indexes over raw node fields, registered
// against the store and invalidated by the change events ('tree' ops stale only
// the tree axis, 'web' ops only the web axis, 'node' ops both).

// ids attached to the tree: every node that has children, plus every child id.
const treeAttachedProjector = (store: StoragePort): Set<string> => {
  const attached: Set<string> = new Set<string>();
  for (const node of store.all()) {
    if (node.children.length > 0) { attached.add(node.id); }
    for (const childID of node.children) { attached.add(childID); }
  }
  return attached;
};

// ids attached to the web: every node with a forward ref, plus every referenced id.
const webAttachedProjector = (store: StoragePort): Set<string> => {
  const attached: Set<string> = new Set<string>();
  for (const node of store.all()) {
    let hasFore: boolean = false;
    for (const ids of Object.values(node.attrs)) {
      for (const targetID of ids) { attached.add(targetID); hasFore = true; }
    }
    for (const link of node.links) { attached.add(link.id); hasFore = true; }
    for (const embed of node.embeds) { attached.add(embed.id); hasFore = true; }
    if (hasFore) { attached.add(node.id); }
  }
  return attached;
};

export function Phase<TBase extends Mixin>(Base: TBase) {
  return class Phase extends Base {

    // the two attachment axes (field-initialized: Phase has no constructor, and
    // these run after Base's constructor has created the store).
    public treeAttachedIndex: DerivedIndex<Set<string>> = this.store.defineIndex(
      'treeAttached', treeAttachedProjector, { scopes: ['node', 'tree'] },
    );
    public webAttachedIndex: DerivedIndex<Set<string>> = this.store.defineIndex(
      'webAttached', webAttachedProjector, { scopes: ['node', 'web'] },
    );

    // the full 2x2 in one pass: every live node sorted into its phase cell.
    // (per-node phase lives on the node itself: 'caudex.get(id).phase()'.)
    phases(opts?: QueryOpts): Record<NODE.PHASE, string[] | Node[] | any[]> {
      this.checkLock();
      const payload: PayloadOpt = opts?.payload ?? QUERY_TYPE.ID;
      const cells: Record<NODE.PHASE, any[]> = {
        [NODE.PHASE.ISOLATE]: [],
        [NODE.PHASE.ORPHAN]: [],
        [NODE.PHASE.WALLFLOWER]: [],
        [NODE.PHASE.INTEGRATED]: [],
      };
      for (const node of (this.all({ ...opts, payload: QUERY_TYPE.NODE }) as Node[] ?? [])) {
        if (node.state() === NODE.STATE.ZOMBIE) { continue; }
        cells[node.phase()].push(this.get(node.id, { ...opts, payload }));
      }
      return cells;
    }

    integrated(opts?: QueryOpts): string[] | Node[] | any[] {
      return this.phases(opts)[NODE.PHASE.INTEGRATED];
    }

    orphans(opts?: QueryOpts): string[] | Node[] | any[] {
      return this.phases(opts)[NODE.PHASE.ORPHAN];
    }

    wallflowers(opts?: QueryOpts): string[] | Node[] | any[] {
      return this.phases(opts)[NODE.PHASE.WALLFLOWER];
    }

    isolates(opts?: QueryOpts): string[] | Node[] | any[] {
      return this.phases(opts)[NODE.PHASE.ISOLATE];
    }
  };
}
