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

  export enum KIND {
    DOC         = 'doc',         // markdown document
    MEDIA       = 'media',       // see media (used with embeds)
    TEMPLATE    = 'template',    // markdown document that defines doctype attrs
    ZOMBIE      = 'zombie',      // no document exists
  }

  // must be 'NODE.KIND.DOC'
  // =~ 'doctype'
  export enum TYPE {
    DEFAULT     = 'default',
    ENTRY       = 'entry',
    INDEX       = 'index',
  }

  // media kind
  export enum MEDIA {
    MARKDOWN    = 'markdown',
    // PDF         = 'pdf',
    // AUDIO       = 'audio',
    // IMAGE       = 'image',
    // VIDEO       = 'video',
  }
}

// relationship information (rel kind) //

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace REL {

  // tree
  export enum FAM {
    FAM         = 'fam',         // all
    ANCESTORS   = 'ancestors',   // all up
    PARENT      = 'parent',      // one up
    SIBLINGS    = 'siblings',    // all sides
    CHILDREN    = 'children',    // one down
    DESCENDANTS = 'descendants', // all down
    LINEAGE     = 'lineage',     // all up + all down - self (excludes self)
  }

  // web (same as 'wikirefs.CONST.KIND')
  export enum REF {
    REF         = 'ref',         // attr + link + embed
    ATTR        = 'attr',
    LINK        = 'link',
    EMBED       = 'embed',
  }

  // partial
  export enum PART {
    ROGUE      = 'rogue',        // tree + web
    ORPHAN     = 'orphan',       // tree
    FLOATER    = 'floater',      // web
  }

  // // level
  // export enum LEVEL {
  //   FILE        = 'file',
  //   HEADER      = 'header',
  //   BLOCK       = 'block',
  // }
}

export enum QUERY_TYPE {
  ID          = 'id',
  NODE        = 'node',
  NODEKIND    = 'nodekind',      // 'NODE.KIND'
  NODETYPE    = 'nodetype',      // 'NODE.TYPE'
  DATA        = 'data',
  ZOMBIE      = 'zombie',        // 'NODE.KIND.ZOMBIE'
}
