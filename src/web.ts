import type { Attrs, BackRefs, ConnectOpts, DisconnectOpts, Embed, Embeds, Link, Links, Mixin, QueryOpts } from './types';
import { DATA_STRUCT, NODE, QUERY_TYPE, EDGE } from './const';
import { Node } from './node';
import { DerivedIndex, StoragePort } from './store';
import { Edge, EdgeQueryOpts, edgesProjector } from './edge';


export function Web<TBase extends Mixin>(Base: TBase) {
  return class Web extends Base {

    // back-ref (inverse) index — a derived cache over the authoritative forward refs.
    // 'targetId -> Set<sourceId>' per ref kind. Registered against the store, so
    // base-level mutations (add / rm / fill / clear / flushGraph) invalidate it via
    // the 'invalidateIndexes' sweep (no onMutate override needed); web-only
    // mutations (connect / disconnect / retype / transfer / flushWeb)
    // invalidate it directly. The projector stores only WHICH sources point at a
    // target, not the type/header/media of the edge — those stay authoritative on
    // the source node and are read back during query reconstruction, so retype/
    // edit can never desync this cache. It iterates in index-insertion order so
    // each target's source Set is ordered the same way the previous full-scan
    // implementation emitted them. Field-initialized (Web has no constructor).
    public backRefsIndex: DerivedIndex<BackRefs> = this.store.defineIndex(
      'backRefsIndex',
      (store: StoragePort): BackRefs => {
        const attr = new Map<string, Set<string>>();
        const link = new Map<string, Set<string>>();
        const embed = new Map<string, Set<string>>();
        const addTo = (m: Map<string, Set<string>>, target: string, source: string): void => {
          let sources = m.get(target);
          if (!sources) { sources = new Set<string>(); m.set(target, sources); }
          sources.add(source);
        };
        for (const node of store.all()) {
          for (const ids of Object.values(node.attrs)) {
            for (const targetID of ids) { addTo(attr, targetID, node.id); }
          }
          for (const l of node.links) { addTo(link, l.id, node.id); }
          for (const e of node.embeds) { addTo(embed, e.id, node.id); }
        }
        return { attr, link, embed };
      },
      { scopes: ['node', 'web'] },
    );

    // the edges view -- web relations reified as normalized Edge objects (see
    // edge.ts). Same registration pattern as backRefsIndex: derived, scoped to
    // {node, web} so tree-only mutations leave it warm.
    public edgesIndex: DerivedIndex<Edge[]> = this.store.defineIndex(
      'edges', edgesProjector, { scopes: ['node', 'web'] },
    );

    public get backRefsIndexDirty(): boolean {
      return this.backRefsIndex.dirty;
    }

    // mark the back-ref index stale; the next back-view query rebuilds it.
    public invalidateBackRefsIndex(): void {
      this.backRefsIndex.invalidate();
    }

    // properties

    // note: the phase bulk queries (phases/integrated/orphans/wallflowers/
    // isolates) live in phase.ts, and per-node phase on the node itself
    // ('node.phase()') -- phase partitions nodes across BOTH the tree and web
    // attachment axes. (the old web-only 'isolates()' -- "no web neighbors" --
    // was the single-axis meaning the TERMS reorg retired; the new isolate is
    // degree-0 across both axes.)

    // web-lvl

    reftypes(): Set<string> {
      this.checkLock();
      let reftypes: string[] = [] as string[];
      /* eslint-disable indent */
      (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? []).forEach((node: Node) => {
            const attrTypes: string[] = Object.keys(node.attrs)
                                              .map((type) => type);
            // @ts-expect-error: typescript is not smart enough to see 'filter' performing validation
            const linkTypes: string[] = node.links
                                            .filter((link: Link) => link !== undefined)
                                            .map((link: Link) => link.type);
            reftypes = reftypes.concat(attrTypes).concat(linkTypes);
          });
      /* eslint-enable indent */
      return new Set(reftypes);
    }

    attrtypes(): Set<string> {
      this.checkLock();
      let attrtypes: string[] = [] as string[];
      /* eslint-disable indent */
      (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? []).forEach((node: Node) =>
            attrtypes = attrtypes.concat(Object.keys(node.attrs)
                                                .map((type) => type)));
      /* eslint-enable indent */
      return new Set(attrtypes);
    }

    linktypes(): Set<string> {
      this.checkLock();
      let linktypes: string[] = [] as string[];
      /* eslint-disable indent */
      (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? []).forEach((node: Node) =>
            // @ts-expect-error: typescript is not smart enough to see 'filter' performing validation
            linktypes = linktypes.concat(node.links
                                              .filter((link: Link) => link !== undefined)
                                              .map((link: Link) => link.type)
                                        )
          );
      /* eslint-enable indent */
      return new Set(linktypes);
    }

    // node-lvl

    // // types
    // forerefs(id: string, query?: QueryType.id): Attrs | undefined;
    // forerefs(id: string, query: QueryType.node): Record<string, Node[]> | undefined;
    // forerefs(id: string, query: string | string[]): Record<string, any> | undefined;
    // // define
    // forerefs(id: string, query: string | string[] = QueryType.id): Attrs | Record<string, Node[]> | Record<string, any> | undefined {
    // }

    // every web relationship as a normalized Edge object, optionally filtered
    // by source / target / kind / type / header. A fresh array is returned
    // (the cached projection is never handed out directly).
    edges(opts?: EdgeQueryOpts): Edge[] {
      this.checkLock();
      const all: Edge[] = this.edgesIndex.ensure(this.store);
      return all.filter((edge: Edge) =>
        ((opts?.source === undefined) || (edge.source === opts.source))
        && ((opts?.target === undefined) || (edge.target === opts.target))
        && ((opts?.kind === undefined) || (edge.kind === opts.kind))
        && ((opts?.type === undefined) || (edge.type === opts.type))
        && ((opts?.header === undefined) || (edge.header === opts.header))
      );
    }

    // all nodes that reference `id` via ANY ref kind (attr / link / embed) — the union
    // of backattrs/backlinks/backembeds sources, read straight off the backRefsIndex.
    // Parallels tree.parent(): an O(1)/O(k) index-backed query (ensure → lookup → get).
    backrefs(id: string, opts?: QueryOpts): string[] | Node[] | any[] | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const backRefs: BackRefs = this.ensureBackRefsIndex();
      const sources: Set<string> = new Set<string>();
      for (const kindMap of [backRefs.attr, backRefs.link, backRefs.embed]) {
        for (const sourceID of (kindMap.get(id) ?? new Set<string>())) { sources.add(sourceID); }
      }
      const ids: string[] = [...sources];
      const payload = opts?.payload ?? QUERY_TYPE.ID;
      return (payload === QUERY_TYPE.ID || payload === undefined) ? ids : ids.map((sid) => this.get(sid, { ...opts, payload }));
    }

    foreattrs(id: string, opts?: QueryOpts): Attrs | Record<string, Node[]> | Record<string, any> | undefined {
      this.checkLock();
      if (opts?.filter?.header !== undefined || opts?.filter?.level === EDGE.LEVEL.HEADER) {
        throw new Error('attrs do not support headers');
      }
      const node: Node | undefined = this.get(id, { payload: QUERY_TYPE.NODE });
      if (!node) { return undefined; }
      const payload = opts?.payload ?? QUERY_TYPE.ID;
      if (payload === QUERY_TYPE.ID || payload === undefined) {
        return node.attrs;
      }
      const queryPayload: any = {};
      for (const [type, ids] of Object.entries(node.attrs)) {
        queryPayload[type] = [];
        for (const targetId of ids) {
          queryPayload[type].push(this.get(targetId, { ...opts, payload }));
        }
      }
      return queryPayload;
    }

    backattrs(id: string, opts?: QueryOpts): Attrs | Record<string, Node[]> | Record<string, any> | undefined {
      this.checkLock();
      if (opts?.filter?.header !== undefined || opts?.filter?.level === EDGE.LEVEL.HEADER) {
        throw new Error('attrs do not support headers');
      }
      if (!this.has(id)) { return undefined; }
      const backRefs: BackRefs = this.ensureBackRefsIndex();
      const backattrs: Attrs = {} as Attrs;
      for (const sourceID of (backRefs.attr.get(id) ?? new Set<string>())) {
        const node: Node | undefined = this.index[sourceID];
        if (!node) { continue; }
        for (const [type, ids] of Object.entries(node.attrs)) {
          if (ids.has(id)) {
            if (!backattrs[type]) { backattrs[type] = new Set(); }
            backattrs[type].add(node.id);
          }
        }
      }
      const payload = opts?.payload ?? QUERY_TYPE.ID;
      if (payload === QUERY_TYPE.ID || payload === undefined) {
        return backattrs;
      }
      const queryPayload: any = {};
      for (const [type, ids] of Object.entries(backattrs)) {
        queryPayload[type] = [];
        for (const sourceId of ids) {
          queryPayload[type].push(this.get(sourceId, { ...opts, payload }));
        }
      }
      return queryPayload;
    }

    forelinks(id: string, opts?: QueryOpts): Links | [any, any][] | undefined {
      this.checkLock();
      const node: Node | undefined = this.get(id, { payload: QUERY_TYPE.NODE });
      if (!node) { return undefined; }
      const f = opts?.filter;
      let links: Link[] = node.links;
      if (f?.header !== undefined) { links = links.filter((l) => l.header === f.header); }
      if (f?.level === EDGE.LEVEL.FILE) { links = links.filter((l) => !l.header); }
      if (f?.level === EDGE.LEVEL.HEADER) { links = links.filter((l) => !!l.header); }
      if (f?.type !== undefined) { links = links.filter((l) => l.type === f.type); }
      const payload = opts?.payload ?? QUERY_TYPE.ID;
      if (payload === QUERY_TYPE.ID || payload === undefined) {
        return links;
      }
      return links.map((link) => [link.type, this.get(link.id, { ...opts, payload })]) as [any, any][];
    }

    backlinks(id: string, opts?: QueryOpts): Links | [any, any][] | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const backRefs: BackRefs = this.ensureBackRefsIndex();
      const backlinks: Links = [];
      for (const sourceID of (backRefs.link.get(id) ?? new Set<string>())) {
        const node: Node | undefined = this.index[sourceID];
        if (!node) { continue; }
        for (const link of node.links) {
          if (id !== link.id) { continue; }
          const f = opts?.filter;
          if (f?.header !== undefined && link.header !== f.header) { continue; }
          if (f?.level === EDGE.LEVEL.FILE && link.header) { continue; }
          if (f?.level === EDGE.LEVEL.HEADER && !link.header) { continue; }
          if (f?.type !== undefined && link.type !== f.type) { continue; }
          backlinks.push({
            type: link.type,
            id: node.id,
            ...(link.header !== undefined && { header: link.header }),
          } as Link);
        }
      }
      const payload = opts?.payload ?? QUERY_TYPE.ID;
      if (payload === QUERY_TYPE.ID || payload === undefined) {
        return backlinks;
      }
      return backlinks.map((link) => [link.type, this.get(link.id, { ...opts, payload })]) as [any, any][];
    }

    foreembeds(id: string, opts?: QueryOpts): Embeds | any[] | undefined {
      this.checkLock();
      const node: Node | undefined = this.get(id, { payload: QUERY_TYPE.NODE });
      if (!node) { return undefined; }
      const f = opts?.filter;
      let embeds: Embed[] = node.embeds;
      if (f?.header !== undefined) { embeds = embeds.filter((e) => e.header === f.header); }
      if (f?.level === EDGE.LEVEL.FILE) { embeds = embeds.filter((e) => !e.header); }
      if (f?.level === EDGE.LEVEL.HEADER) { embeds = embeds.filter((e) => !!e.header); }
      const payload = opts?.payload ?? QUERY_TYPE.ID;
      if (payload === QUERY_TYPE.ID || payload === undefined) {
        return embeds;
      }
      return embeds.map((embed) => this.get(embed.id, { ...opts, payload }));
    }

    backembeds(id: string, opts?: QueryOpts): Embeds | any[] | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      const backRefs: BackRefs = this.ensureBackRefsIndex();
      const backembeds: Embeds = [];
      for (const sourceID of (backRefs.embed.get(id) ?? new Set<string>())) {
        const node: Node | undefined = this.index[sourceID];
        if (!node) { continue; }
        for (const embed of node.embeds) {
          if (id !== embed.id) { continue; }
          const f = opts?.filter;
          if (f?.header !== undefined && embed.header !== f.header) { continue; }
          if (f?.level === EDGE.LEVEL.FILE && embed.header) { continue; }
          if (f?.level === EDGE.LEVEL.HEADER && !embed.header) { continue; }
          backembeds.push({
            id: node.id,
            ...(embed.media !== undefined && { media: embed.media }),
            ...(embed.header !== undefined && { header: embed.header }),
          } as Embed);
        }
      }
      const payload = opts?.payload ?? QUERY_TYPE.ID;
      if (payload === QUERY_TYPE.ID || payload === undefined) {
        return backembeds;
      }
      return backembeds.map((embed) => this.get(embed.id, { ...opts, payload }));
    }

    neighbors(id: string, kindOrOpts?: EDGE.KIND | QueryOpts): string[] | undefined {
      this.checkLock();
      const kind = (typeof kindOrOpts === 'string' && Object.values(EDGE.KIND).includes(kindOrOpts))
        ? kindOrOpts
        : (kindOrOpts as QueryOpts)?.filter?.kind ?? EDGE.KIND.REF;
      let neighbors: string[] = [];
      const node: Node | undefined = this.get(id, { payload: QUERY_TYPE.NODE });
      if (!node) { return undefined; }
      if ((kind === EDGE.KIND.REF) || (kind === EDGE.KIND.ATTR)) {
        const backattrs = this.backattrs(id) ?? {};
        neighbors = neighbors
          .concat(Object.values(node.attrs).flatMap((ids) => Array.from(ids)))
          .concat(Object.values(backattrs).flatMap((ids: Set<string>) => Array.from(ids)));
      }
      if ((kind === EDGE.KIND.REF) || (kind === EDGE.KIND.LINK)) {
        const backlinks = (this.backlinks(id) ?? []) as Links;
        neighbors = neighbors
          .concat(node.links.map((link: Link) => link.id))
          .concat(backlinks.map((link: Link | { id: string }) => link.id));
      }
      if ((kind === EDGE.KIND.REF) || (kind === EDGE.KIND.EMBED)) {
        const backembeds = (this.backembeds(id) ?? []) as Embeds;
        neighbors = neighbors
          .concat(node.embeds.map((embed: Embed) => embed.id))
          .concat(backembeds.map((embed: Embed | { id: string }) => embed.id));
      }
      return neighbors;
    }

    // methods

    public flushWeb(id?: string): boolean {
      this.checkLock();
      this.store.signal({ kind: 'web', op: 'flushWeb', ...(id !== undefined && { id }) });
      // single
      if (id) {
        const node: Node | undefined = this.get(id);
        if (node === undefined) { return false; }
        // delete zombies...
        /* eslint-disable indent */
        const relRefIDs = Array.from(Object.values(node.attrs).flatMap((ids) => Array.from(ids))
                                    .concat(node.links.map((link: Link) => link.id)
                                    .concat(node.embeds.map((embed: Embed) => embed.id))));
        for (const relRefID of relRefIDs) {
          const relRefNode: Node | undefined = this.get(relRefID, { payload: QUERY_TYPE.NODE });
          if (!relRefNode) { continue; }
          const isZombie: boolean = (relRefNode.state() === NODE.STATE.ZOMBIE);
          const hasRel: boolean = (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? []).some((n) =>
            (n.id !== relRefID && n.inChildren(relRefID))
            || (n.id !== relRefID && n.id !== id && (n.inAttrs(relRefID) || n.inLinks(relRefID) || n.inEmbeds(relRefID)))
          );
          /* eslint-enable indent */
          // delete floater/orphaned zombies
          if (isZombie && !hasRel) {
            delete this.index[relRefID];
          }
          // flush
          node.flush(DATA_STRUCT.WEB);
        }
        return true;
      // all
      } else {
        for (const node of (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? [])) {
          const isZombie: boolean = (node.state() === NODE.STATE.ZOMBIE);
          const hasFamRel: boolean = (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? []).some((relNode) =>
            (relNode.id !== node.id) && (relNode.inChildren(node.id))
          );
          // delete floater/orphaned zombies
          if (isZombie && !hasFamRel) {
            delete this.index[node.id];
            return true;
          }
          // flush
          node.flush(DATA_STRUCT.WEB);
        }
        return true;
      }
    }

    // add

    public connect(sourceID: string, targetID: string, optsOrKind: ConnectOpts | EDGE.KIND, typeOrMedia?: string): boolean {
      const opts: ConnectOpts = (typeof optsOrKind === 'string' && Object.values(EDGE.KIND).includes(optsOrKind))
        ? {
          kind: optsOrKind,
          type: optsOrKind === EDGE.KIND.EMBED ? undefined : (typeOrMedia ?? ''),
          // media stays undefined for note-embeds (markdown is not a media kind)
          media: optsOrKind === EDGE.KIND.EMBED ? (typeOrMedia as NODE.MEDIA | undefined) : undefined,
        }
        : optsOrKind as ConnectOpts;
      const { kind, type = '', header, media, position } = opts;
      if (kind === EDGE.KIND.REF) {
        console.warn('please connect to a more specific relationship(\'REL.REF.ATTR\', \'REL.REF.LINK\', or \'REL.REF.EMBED\'');
        return false;
      }
      if (kind === EDGE.KIND.ATTR && header !== undefined) {
        throw new Error('attrs do not support headers');
      }
      this.checkLock();
      this.store.signal({ kind: 'web', op: 'connect', id: sourceID });
      const sourceNode: Node | undefined = this.get(sourceID, { payload: QUERY_TYPE.NODE });
      if (!sourceNode) {
        console.warn(`source node with id "${sourceID}" not found`);
        return false;
      }
      if (!this.has(targetID)) {
        console.warn(`target node with id "${targetID}" not found`);
        return false;
      }
      if (kind === EDGE.KIND.ATTR) {
        if (!Object.keys(sourceNode.attrs).includes(type)) {
          sourceNode.attrs[type] = new Set([targetID]);
        } else {
          sourceNode.attrs[type].add(targetID);
        }
        return sourceNode.attrs[type].has(targetID);
      }
      if (kind === EDGE.KIND.LINK) {
        // occurrence identity: same (type, target, header) at a DIFFERENT
        // position is a distinct occurrence, not a duplicate.
        const hasLink = sourceNode.links.find((link: Link) =>
          link.type === type && link.id === targetID && link.header === header && link.position === position
        );
        if (hasLink === undefined) {
          sourceNode.links.push({
            type,
            id: targetID,
            ...(header !== undefined && { header }),
            ...(position !== undefined && { position }),
          } as Link);
        }
        return true;
      }
      if (kind === EDGE.KIND.EMBED) {
        // media-absence = note-embed; a given media must be a real media kind
        if ((media !== undefined) && !Object.values(NODE.MEDIA).includes(media)) {
          console.warn('invalid media kind: ' + media);
          return false;
        }
        const hasEmbed = sourceNode.embeds.find((embed: Embed) =>
          embed.media === media && embed.id === targetID && embed.header === header && embed.position === position
        );
        if (hasEmbed === undefined) {
          sourceNode.embeds.push({
            id: targetID,
            ...(media !== undefined && { media }),
            ...(header !== undefined && { header }),
            ...(position !== undefined && { position }),
          } as Embed);
        }
        return true;
      }
      return false;
    }

    // edit

    public disconnect(sourceID: string, targetID: string, optsOrKind: DisconnectOpts | EDGE.KIND, typeOrMedia?: string): boolean {
      const opts: DisconnectOpts = (typeof optsOrKind === 'string' && Object.values(EDGE.KIND).includes(optsOrKind))
        ? {
          kind: optsOrKind,
          type: optsOrKind === EDGE.KIND.EMBED ? undefined : (typeOrMedia ?? ''),
          // media stays undefined for note-embeds (markdown is not a media kind)
          media: optsOrKind === EDGE.KIND.EMBED ? (typeOrMedia as NODE.MEDIA | undefined) : undefined,
        }
        : optsOrKind as DisconnectOpts;
      const { kind, type = '', header, media, position } = opts;
      if (kind === EDGE.KIND.REF) {
        console.warn('please disconnect a more specific relationship(\'REL.REF.ATTR\', \'REL.REF.LINK\', or \'REL.REF.EMBED\'');
        return false;
      }
      this.checkLock();
      this.store.signal({ kind: 'web', op: 'disconnect', id: sourceID });
      const sourceNode: Node | undefined = this.get(sourceID, { payload: QUERY_TYPE.NODE });
      if (!sourceNode) {
        console.warn(`source node with id "${sourceID}" not found`);
        return false;
      }
      if (!this.has(targetID)) {
        console.warn(`target node with id "${targetID}" not found`);
        return false;
      }
      if (kind === EDGE.KIND.ATTR) {
        if (sourceNode.attrs[type]?.size === 1) {
          delete sourceNode.attrs[type];
          return !Object.keys(sourceNode.attrs).includes(type);
        }
        sourceNode.attrs[type]?.delete(targetID);
        return !sourceNode.attrs[type]?.has(targetID);
      }
      // occurrence targeting: a given position removes ONLY that occurrence;
      // omitted position is position-BLIND (removes the first match regardless
      // of anchor -- back-compat with pre-position callers).
      if (kind === EDGE.KIND.LINK) {
        for (let i = 0; i < sourceNode.links.length; i++) {
          const l = sourceNode.links[i];
          if (l.id === targetID && l.type === type && l.header === header
            && ((position === undefined) || (l.position === position))) {
            sourceNode.links.splice(i, 1);
            return true;
          }
        }
        return !sourceNode.links.find((link: Link) =>
          link.type === type && link.id === targetID && link.header === header
          && ((position === undefined) || (link.position === position))
        );
      }
      if (kind === EDGE.KIND.EMBED) {
        for (let i = 0; i < sourceNode.embeds.length; i++) {
          const e = sourceNode.embeds[i];
          if (e.id === targetID && e.media === media && e.header === header
            && ((position === undefined) || (e.position === position))) {
            sourceNode.embeds.splice(i, 1);
            return true;
          }
        }
        return !sourceNode.embeds.find((embed: Embed) =>
          embed.media === media && embed.id === targetID && embed.header === header
          && ((position === undefined) || (embed.position === position))
        );
      }
      return false;
    }

    public retype(
      oldType: string,
      newType: string,
      kind: EDGE.KIND = EDGE.KIND.REF,
    ): boolean {
      this.checkLock();
      this.store.signal({ kind: 'web', op: 'retype' });
      const retypes: boolean[] = [];
      for (const node of (this.all({ payload: QUERY_TYPE.NODE }) as Node[] ?? [])) {
        if ((kind === EDGE.KIND.REF) || (kind === EDGE.KIND.ATTR)) {
          if (Object.keys(node.attrs).includes(oldType)
          && !Object.keys(node.attrs).includes(newType)) {
            node.attrs[newType] = new Set(node.attrs[oldType]);
            delete node.attrs[oldType];
            retypes.push(Object.keys(node.attrs).includes(newType));
          }
        }
        if ((kind === EDGE.KIND.REF) || (kind === EDGE.KIND.LINK)) {
          for (const l of node.links) {
            if (l.type === oldType) {
              l.type = newType;
              retypes.push(l.type === newType);
            }
          }
        }
      }
      return retypes.every((r) => r === true);
    }

    public transfer(
      sourceID: string,
      targetID: string,
      kind: EDGE.KIND = EDGE.KIND.REF,
    ): boolean {
      this.checkLock();
      this.store.signal({ kind: 'web', op: 'transfer', id: sourceID });
      if (sourceID === targetID) {
        console.warn('source and target are the same');
        return false;
      }
      const sourceNode: Node | undefined = this.get(sourceID, { payload: QUERY_TYPE.NODE });
      const targetNode: Node | undefined = this.get(targetID, { payload: QUERY_TYPE.NODE });
      if (!sourceNode) {
        console.warn(`source node with id "${sourceID}" not in index`);
        return false;
      }
      if (!targetNode) {
        console.warn(`target node with id "${targetID}" not in index`);
        return false;
      }
      if ((kind === EDGE.KIND.REF) || (kind === EDGE.KIND.ATTR)) {
        for (const [key, val] of Object.entries(sourceNode.attrs)) {
          // create
          if (!Object.keys(targetNode.attrs).includes(key)) {
            targetNode.attrs[key] = val;
          // add
          } else {
            val.forEach((v) => {
              if (v !== targetID) { targetNode.attrs[key].add(v); } 
            });
          }
        }
        sourceNode.attrs = {} as Attrs;
      }
      if ((kind === EDGE.KIND.REF) || (kind === EDGE.KIND.LINK)) {
        targetNode.links = targetNode.links.concat(sourceNode.links.filter((l) => l.id !== targetID));
        sourceNode.links = [] as Links;
      }
      if ((kind === EDGE.KIND.REF) || (kind === EDGE.KIND.EMBED)) {
        targetNode.embeds = targetNode.embeds.concat(sourceNode.embeds.filter((e) => e.id !== targetID));
        sourceNode.embeds = [] as Embeds;
      }
      return true;
    }

    // back-ref (inverse) index -- the projection itself lives in the field
    // declaration up top; these are the rebuild/ensure faces over it.

    public rebuildBackRefsIndex(): void {
      this.backRefsIndex.rebuild(this.store);
    }

    // re-project only if stale, then serve. Routes through the public
    // 'rebuildBackRefsIndex()' (not DerivedIndex.ensure) so the rebuild stays an
    // observable seam (tests spy on it to assert the caching behavior).
    public ensureBackRefsIndex(): BackRefs {
      if (this.backRefsIndex.dirty) { this.rebuildBackRefsIndex(); }
      return this.backRefsIndex.value as BackRefs;
    }

  };
}
