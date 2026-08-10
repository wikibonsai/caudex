import type { Attrs, BaseNodeData, Embed, Embeds, Link, Links } from './types';
import { DATA_STRUCT, NODE } from './const';


// the attachment context a node needs to answer its edge-state: whether the
// GRAPH considers it tree-attached / web-attached. A node cannot see this from
// its own fields (parents point at children; backrefs live on other nodes), so
// the caudex binds a lazily-evaluated lookup at node creation.
export interface NodeGraphCtx {
  inTree: (id: string) => boolean;
  inWeb: (id: string) => boolean;
}

export class Node {
  public id: string;
  public kind: NODE.KIND | undefined;      // undefined while a zombie
  public type: string | undefined;
  public data: BaseNodeData | any;
  // relationships
  public attrs: Attrs;
  public children: string[];
  public links: Links;
  public embeds: Embeds;
  // the graph's attachment lookup (see 'NodeGraphCtx'). Truly private: invisible
  // to JSON serialization and deepEqual, so nodes still read as plain data.
  #graph: NodeGraphCtx | undefined;

  constructor(
    id: string,
    data: BaseNodeData | any,
    kind?: NODE.KIND,
    type?: string,
    graph?: NodeGraphCtx,
  ) {
    this.id = id;
    this.data = data;
    // a node constructed without a kind is a zombie -- there is no document
    // behind it (yet); 'fill()' flips it live and assigns the kind.
    this.kind = kind;
    this.type = type;
    this.#graph = graph;
    // relationships
    // tree
    this.children = [] as string[];
    // web
    this.attrs = {} as Attrs;
    this.links = [] as Links;
    this.embeds = [] as Embeds;
  }

  // state & phase -- fully DERIVED, never stored (a stored copy could only go stale).

  // state: does the document exist? Derived from kind-absence -- 'fill()'
  // assigns a kind (-> live), rm()-zombify strips it (-> zombie). To key
  // existence off the data payload instead (e.g. 'uri' presence), this is the
  // one place to change.
  public state(): NODE.STATE {
    return (this.kind === undefined) ? NODE.STATE.ZOMBIE : NODE.STATE.LIVE;
  }

  // phase: the node's integration phase (tree x web attachment), evaluated
  // against the graph at CALL time via the bound context -- always fresh.
  // Reported truthfully for any node (a referenced zombie reads 'orphan');
  // the bulk queries gate zombies out by state.
  public phase(): NODE.PHASE {
    if (this.#graph === undefined) {
      throw new Error('node.phase() requires a graph-bound node (created by a caudex with the Phase layer)');
    }
    const inTree: boolean = this.#graph.inTree(this.id);
    const inWeb: boolean = this.#graph.inWeb(this.id);
    return inTree ? (inWeb ? NODE.PHASE.INTEGRATED : NODE.PHASE.SPUR) : (inWeb ? NODE.PHASE.ORPHAN : NODE.PHASE.ISOLATE);
  }

  public flush(kind?: DATA_STRUCT): void {
    if (!kind || (kind === DATA_STRUCT.TREE)) {
      this.children = [] as string[];
    }
    if (!kind || (kind === DATA_STRUCT.WEB)) {
      this.attrs = {} as Attrs;
      this.links = [] as Links;
      this.embeds = [] as Embeds;
    }
  }

  // note: ('in-' methods are used in the 'web' for generating 'attributed' and 'backlinks')

  public inAttrs(id: string): boolean {
    return Object.values(this.attrs).filter((ids) => ids.has(id)).length !== 0;
  }

  public inChildren(id: string): boolean {
    return this.children.includes(id);
  }

  public inLinks(id: string, header?: string): boolean {
    return this.links.filter((link: Link) =>
      link.id === id && (header === undefined || link.header === header)
    ).length !== 0;
  }

  public inEmbeds(id: string, header?: string): boolean {
    return this.embeds.filter((embed: Embed) =>
      embed.id === id && (header === undefined || embed.header === header)
    ).length !== 0;
  }
}
