// caudex information //

// data structures
export enum DATA_STRUCT {
  BASE        = 'base',
  TREE        = 'tree',
  WEB         = 'web',
}

// node information ('node kind', 'node type')

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace NODE {

  // what the document IS; undefined while a node is a zombie (existence is the
  // DOCSTATE axis, not a kind).
  export enum KIND {
    DOC         = 'doc',         // markdown document
    MEDIA       = 'media',       // see media (used with embeds)
    TEMPLATE    = 'template',    // markdown document that defines doctype attrs
  }

  // must be 'NODE.KIND.DOC'
  // =~ 'doctype'
  export enum TYPE {
    DEFAULT     = 'default',
    ENTRY       = 'entry',
    INDEX       = 'index',
  }

  // media kind -- actual media assets only (same values as wikirefs
  // CONST.MEDIA). markdown is NOT a media kind: a note-embed is signaled by
  // media-ABSENCE ('Embed.media' undefined).
  export enum MEDIA {
    PDF         = 'pdf',
    AUDIO       = 'audio',
    IMAGE       = 'image',
    VIDEO       = 'video',
  }

  // whether the document EXISTS (TERMS.md: zombie -> live).
  // DERIVED from kind-absence ('node.state()'); never stored.
  export enum STATE {
    ZOMBIE      = 'zombie',       // no document exists (only references to it)
    LIVE        = 'live',         // the document exists
  }

  // the node's integration phase -- tree x web attachment, a lifecycle of
  // increasing connectedness: isolate -> orphan/wallflower -> integrated.
  // DERIVED per-node from the graph ('node.phase()'); zombies are gated out of
  // the bulk queries by state.
  //
  //                 in web        not in web
  //   in tree     integrated     wallflower
  //   not in tree   orphan         isolate
  export enum PHASE {
    ISOLATE     = 'isolate',      // connected to nothing (a lone island)
    ORPHAN      = 'orphan',       // in the web, but no family in the tree
    WALLFLOWER  = 'wallflower',   // in the tree, but no references in the web
    INTEGRATED  = 'integrated',   // in the tree AND the web -- fully connected
  }
}

// edge information ('edge kind', 'edge type') //

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EDGE {

  // web (same as 'wikirefs.CONST.KIND')
  export enum KIND {
    REF         = 'ref',         // attr + link + embed
    ATTR        = 'attr',
    LINK        = 'link',
    EMBED       = 'embed',
  }

  // ref level (file vs header targeting)
  export enum LEVEL {
    FILE    = 'file',
    HEADER  = 'header',
    // BLOCK   = 'block',
  }

  // (EDGE.STATE is reserved: the natural per-edge state axis is
  // dangling/resolved -- an edge whose target is a zombie is dangling.
  // Unbuilt until a feature demands it.)
}

export enum QUERY_TYPE {
  ID          = 'id',
  NODE        = 'node',
  NODEKIND    = 'nodekind',      // 'NODE.KIND'
  NODETYPE    = 'nodetype',      // custom type field
  NODESTATE   = 'nodestate',     // 'NODE.STATE'
  NODEPHASE   = 'nodephase',     // 'NODE.PHASE'
  EDGEKIND    = 'edgekind',      // 'EDGE.KIND'
  EDGETYPE    = 'edgetype',      // custom type field
  DATA        = 'data',
  ZOMBIE      = 'zombie',        // the zombie-key value ('data[zombieKey]')
}
