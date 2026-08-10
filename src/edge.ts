import { EDGE } from './const';
import type { NODE } from './const';
import { StoragePort } from './store';


// the Edge object: a web relationship (attr / link / embed) reified as one
// normalized '{source, target, ...}' shape -- the API facade for the
// edges-as-rows storage that lands with the engine adapter (refactor #2).
// Today 'edges()' is a derived VIEW over the source-owned forward refs
// (node.attrs / node.links / node.embeds); storage is unchanged.
//
// naming: 'Edge' pairs with 'Node' -- caudex's container types speak
// graph-structural vocabulary, while the WikiBonsai semantics (attr / link /
// embed, reftype) live in the 'kind'/'type' FIELDS. ('Ref' was considered and
// rejected: overloaded by backrefs()/forerefs()/REL.REF/wikirefs.)
//
// 'position' is the occurrence anchor: the character offset of the ref in the
// source doc (wikirefs.scan's 'start'). It is what makes two otherwise-
// identical links distinct occurrences, and what context snippets and
// block-level citation derive from -- store the anchor, derive the sentence.
// attrs are a SET per (type, target) and carry no position.
export interface Edge {
  source: string;
  target: string;
  kind: EDGE.KIND;          // attr | link | embed (never the 'ref' umbrella)
  type?: string;          // reftype (attrs / links; embeds are untyped)
  header?: string;        // links / embeds (attrs do not support headers)
  media?: NODE.MEDIA;     // embeds only; absent = doc-embed
  position?: number;      // occurrence offset in the source doc
}

export interface EdgeQueryOpts {
  source?: string;
  target?: string;
  kind?: EDGE.KIND;
  type?: string;      // reftype (e.g. for reftype-scoped graph filtering)
  header?: string;
}

// projector for the edges view: flatten every node's forward refs into Edge
// objects, in index-insertion order (attrs, then links, then embeds per node).
export const deriveEdges = (store: StoragePort): Edge[] => {
  const edges: Edge[] = [];
  for (const node of store.all()) {
    for (const [type, targetIDs] of Object.entries(node.attrs)) {
      for (const targetID of targetIDs) {
        edges.push({ source: node.id, target: targetID, kind: EDGE.KIND.ATTR, type });
      }
    }
    for (const link of node.links) {
      edges.push({
        source: node.id,
        target: link.id,
        kind: EDGE.KIND.LINK,
        type: link.type,
        ...(link.header !== undefined && { header: link.header }),
        ...(link.position !== undefined && { position: link.position }),
      });
    }
    for (const embed of node.embeds) {
      edges.push({
        source: node.id,
        target: embed.id,
        kind: EDGE.KIND.EMBED,
        ...(embed.media !== undefined && { media: embed.media }),
        ...(embed.header !== undefined && { header: embed.header }),
        ...(embed.position !== undefined && { position: embed.position }),
      });
    }
  }
  return edges;
};
