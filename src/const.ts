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

  // media kind -- actual media assets only (same values as wikirefs
  // CONST.MEDIA). markdown is NOT a media kind: a note-embed is signaled by
  // media-ABSENCE ('Embed.media' undefined).
  export enum MEDIA {
    PDF         = 'pdf',
    AUDIO       = 'audio',
    IMAGE       = 'image',
    VIDEO       = 'video',
  }

  // document state (relationship to tree/web)
  export enum STATE {
    ORPHAN      = 'orphan',       // not in tree
    ISOLATE     = 'isolate',      // not in web
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

}

export enum QUERY_TYPE {
  ID          = 'id',
  NODE        = 'node',
  NODEKIND    = 'nodekind',      // 'NODE.KIND'
  NODETYPE    = 'nodetype',      // custom type field
  EDGEKIND    = 'edgekind',      // 'EDGE.KIND'
  EDGETYPE    = 'edgetype',      // custom type field
  DATA        = 'data',
  ZOMBIE      = 'zombie',        // the zombie-key value ('data[zombieKey]')
}
