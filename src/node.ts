import type { Attrs, BaseNodeData, Embed, Embeds, Link, Links } from './types';
import { DATA_STRUCT, NODE } from './const';


export class Node {
  public id: string;
  public kind: NODE.KIND;
  public type: string | undefined;
  public data: BaseNodeData | any;
  // relationships
  public attrs: Attrs;
  public children: string[];
  public links: Links;
  public embeds: Embeds;

  constructor(
    id: string,
    kind: NODE.KIND,
    type: string | undefined,
    data: BaseNodeData | any,
  ) {
    this.id = id;
    this.kind = kind;
    this.type = type;
    this.data = data;
    // relationships
    // tree
    this.children = [] as string[];
    // web
    this.attrs = {} as Attrs;
    this.links = [] as Links;
    this.embeds = [] as Embeds;
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

  public inLinks(id: string): boolean {
    return this.links.filter((link: Link) => link.id === id).length !== 0;
  }

  public inEmbeds(id: string): boolean {
    return this.embeds.filter((embed: Embed) => embed.id === id).length !== 0;
  }
}
