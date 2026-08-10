import type { QueryOpts, PayloadOpt } from './types';
import { NODE, QUERY_TYPE } from './const';
import { Node } from './node';
import { DerivedIndex, StoragePort } from './store';
import { BaseAPI, CaudexCtx } from './base';


// the phase layer -- the node's integration phase: tree x web attachment, a
// lifecycle of increasing connectedness, DERIVED per-node (TERMS.md):
//
//                 in web        not in web
//   in tree     integrated     spur
//   not in tree   orphan         isolate
//
// phase is a CROSS-axis concern, so it sits ABOVE the tree and web layers in
// the composition ('create' merges base+tree+web+phase) -- neither axis
// alone can answer it, and a tree-only or web-only composition correctly
// lacks it.
//
// the derivation itself lives on the node: 'node.phase()' evaluates lazily
// against the attachment indexes below via the graph context bound at node
// creation (base.graphCtx()). This layer registers those indexes (into
// ctx.attachment, where graphCtx reads them) and provides the BULK queries;
// any node reports its phase truthfully through 'node.phase()', but zombies
// are gated out of 'phases()' and the cell queries by state (health ratios
// count only live docs).
//
// the two attachment axes are derived indexes over raw node fields, registered
// against the store and invalidated by the change events ('tree' ops stale only
// the tree axis, 'web' ops only the web axis, 'node' ops both).

// ids attached to the tree: every node that has children, plus every child id.
const deriveTreeAttached = (store: StoragePort): Set<string> => {
  const attached: Set<string> = new Set<string>();
  for (const node of store.all()) {
    if (node.children.length > 0) { attached.add(node.id); }
    for (const childID of node.children) { attached.add(childID); }
  }
  return attached;
};

// ids attached to the web: every node with a forward ref, plus every referenced id.
const deriveWebAttached = (store: StoragePort): Set<string> => {
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

export interface PhaseAPI {
  readonly treeAttachedIndex: DerivedIndex<Set<string>>;
  readonly webAttachedIndex: DerivedIndex<Set<string>>;
  phases(opts?: QueryOpts): Record<NODE.PHASE, string[] | Node[] | any[]>;
  integrated(opts?: QueryOpts): string[] | Node[] | any[];
  orphans(opts?: QueryOpts): string[] | Node[] | any[];
  spurs(opts?: QueryOpts): string[] | Node[] | any[];
  isolates(opts?: QueryOpts): string[] | Node[] | any[];
}

export function phase(ctx: CaudexCtx, base: BaseAPI): PhaseAPI {
  const { store } = ctx;
  const { checkLock, nodes, get } = base;

  // the two attachment axes -- registered into ctx.attachment, which is where
  // base.graphCtx() (and thereby every node's 'phase()') looks them up.
  const treeAttachedIndex: DerivedIndex<Set<string>> = store.defineIndex(
    'treeAttached', deriveTreeAttached, { scopes: ['node', 'tree'] },
  );
  const webAttachedIndex: DerivedIndex<Set<string>> = store.defineIndex(
    'webAttached', deriveWebAttached, { scopes: ['node', 'web'] },
  );
  ctx.attachment.tree = treeAttachedIndex;
  ctx.attachment.web = webAttachedIndex;

  // the full 2x2 in one pass: every live node sorted into its phase cell.
  // (per-node phase lives on the node itself: 'caudex.get(id).phase()'.)
  function phases(opts?: QueryOpts): Record<NODE.PHASE, string[] | Node[] | any[]> {
    checkLock();
    const payload: PayloadOpt = opts?.payload ?? QUERY_TYPE.ID;
    const cells: Record<NODE.PHASE, any[]> = {
      [NODE.PHASE.ISOLATE]: [],
      [NODE.PHASE.ORPHAN]: [],
      [NODE.PHASE.SPUR]: [],
      [NODE.PHASE.INTEGRATED]: [],
    };
    for (const node of (nodes({ ...opts, payload: QUERY_TYPE.NODE }) as Node[] ?? [])) {
      if (node.state() === NODE.STATE.ZOMBIE) { continue; }
      cells[node.phase()].push(get(node.id, { ...opts, payload }));
    }
    return cells;
  }

  function integrated(opts?: QueryOpts): string[] | Node[] | any[] {
    return phases(opts)[NODE.PHASE.INTEGRATED];
  }

  function orphans(opts?: QueryOpts): string[] | Node[] | any[] {
    return phases(opts)[NODE.PHASE.ORPHAN];
  }

  function spurs(opts?: QueryOpts): string[] | Node[] | any[] {
    return phases(opts)[NODE.PHASE.SPUR];
  }

  function isolates(opts?: QueryOpts): string[] | Node[] | any[] {
    return phases(opts)[NODE.PHASE.ISOLATE];
  }

  return {
    treeAttachedIndex,
    webAttachedIndex,
    phases,
    integrated,
    orphans,
    spurs,
    isolates,
  };
}
