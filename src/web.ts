import type { Attrs, Embed, Embeds, Link, Links, Mixin } from './types';
import { DATA_STRUCT, NODE, QUERY_TYPE, REL } from './const';
import { Node } from './node';


export function Web<TBase extends Mixin>(Base: TBase) {
  return class Web extends Base {

    // properties

    // nodes that are not linked to any other node in the web
    // types
    floaters(query?: QUERY_TYPE.ID): string[] | undefined;
    floaters(query: QUERY_TYPE.NODE): Node[] | undefined;
    floaters(query: string | string[]): any[] | undefined;
    // define
    floaters(query: string | string[] = QUERY_TYPE.ID): string[] | Node[] | any[] | undefined {
      this.checkLock();
      /* eslint-disable indent */
      return this.all(QUERY_TYPE.NODE)
                 .filter((node: Node) =>
                   (this.neighbors(node.id)?.length === 0) &&
                   (node.kind !== NODE.KIND.ZOMBIE))
                 .map((node: Node) => this.get(node.id, query));
      /* eslint-enable indent */
    }

    // web-lvl

    reftypes(): Set<string> {
      this.checkLock();
      let reftypes: string[] = [] as string[];
      /* eslint-disable indent */
      this.all(QUERY_TYPE.NODE)
          .forEach((node: Node) => {
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
      this.all(QUERY_TYPE.NODE)
          .forEach((node: Node) =>
            attrtypes = attrtypes.concat(Object.keys(node.attrs)
                                                .map((type) => type)));
      /* eslint-enable indent */
      return new Set(attrtypes);
    }

    linktypes(): Set<string> {
      this.checkLock();
      let linktypes: string[] = [] as string[];
      /* eslint-disable indent */
      this.all(QUERY_TYPE.NODE)
          .forEach((node: Node) =>
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

    // backrefs(id: string, query?: QueryType.id): Attrs | undefined;
    // backrefs(id: string, query: QueryType.node): Record<string, Node[]> | undefined;
    // backrefs(id: string, query: string | string[]): Record<string, any> | undefined;
    // // define
    // backrefs(id: string, query: string | string[] = QueryType.id): Attrs | Record<string, Node[]> | Record<string, any> | undefined {
    // }

    // types
    foreattrs(id: string, query?: QUERY_TYPE.ID): Attrs | undefined;
    foreattrs(id: string, query: QUERY_TYPE.NODE): Record<string, Node[]> | undefined;
    foreattrs(id: string, query: string | string[]): Record<string, any> | undefined;
    // define
    foreattrs(id: string, query: string | string[] = QUERY_TYPE.ID): Attrs | Record<string, Node[]> | Record<string, any> | undefined {
      this.checkLock();
      const node: Node | undefined = this.get(id, QUERY_TYPE.NODE);
      if (!node) { return undefined; }
      // with 'id's
      if (query === QUERY_TYPE.ID) {
        return node.attrs;
      // with query
      } else {
        const queryPayload: any = {};
        for (const [type, ids] of Object.entries(node.attrs)) {
          queryPayload[type] = [];
          for (const id of ids) {
            queryPayload[type].push(this.get(id, query));
          }
        }
        return queryPayload;
      }
    }

    // types
    backattrs(id: string, query?: QUERY_TYPE.ID): Attrs | undefined;
    backattrs(id: string, query: QUERY_TYPE.NODE): Record<string, Node[]> | undefined;
    backattrs(id: string, query: string | string[]): Record<string, any> | undefined;
    // define
    backattrs(id: string, query: string | string[] = QUERY_TYPE.ID): Attrs | Record<string, Node[]> |Record<string, any> | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      // build backattrs
      const backattrs: Attrs = {} as Attrs;
      for (const node of this.all(QUERY_TYPE.NODE)) {
        if (node.inAttrs(id)) {
          for (const [type, ids] of Object.entries(node.attrs)) {
            if (ids.has(id)) {
              if (!backattrs[type]) { backattrs[type] = new Set(); }
              backattrs[type].add(node.id);
            }
          }
        }
      }
      // with 'id's
      if (query === QUERY_TYPE.ID) {
        return backattrs;
      // with query
      } else {
        const queryPayload: any = {};
        for (const [type, ids] of Object.entries(backattrs)) {
          queryPayload[type] = [];
          for (const id of ids) {
            queryPayload[type].push(this.get(id, query));
          }
        }
        return queryPayload;
      }
    }

    // types
    forelinks(id: string, query?: QUERY_TYPE.ID): Links | undefined;
    forelinks(id: string, query: QUERY_TYPE.NODE): [any, Node][] | undefined;
    forelinks(id: string, query: string | string[]): [any, string][] | undefined;
    // define
    forelinks(id: string, query: string | string[] = QUERY_TYPE.ID): Links | [any, Node][] | [any, string][] | undefined {
      this.checkLock();
      const node: Node | undefined = this.get(id);
      if (!node) { return undefined; }
      // with 'id's
      if (query === QUERY_TYPE.ID) {
        return node.links;
      // with query
      } else {
        const queryPayload: [any, string][] = [];
        for (const forelink of node.links) {
          queryPayload.push([
            forelink.type,
            this.get(forelink.id, query),
          ]);
        }
        return queryPayload;
      }
    }

    // types
    backlinks(id: string, query?: QUERY_TYPE.ID): Links | undefined;
    backlinks(id: string, query: QUERY_TYPE.NODE): [any, Node][] | undefined;
    backlinks(id: string, query: string | string[]): [any, string][] | undefined;
    // define
    backlinks(id: string, query: string | string[] = QUERY_TYPE.ID): Links | [any, Node][] | [any, string][] | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      // build backlinks
      const backlinks: Links = [];
      for (const node of this.all(QUERY_TYPE.NODE)) {
        if (node.inLinks(id)) {
          for (const link of node.links) {
            if (id === link.id) {
              backlinks.push({
                type: link.type,
                id: node.id,
              });
            }
          }
        }
      }
      // with 'id's
      if (query === QUERY_TYPE.ID) {
        return backlinks;
      // with query
      } else {
        const queryPayload: [any, string][] = [];
        for (const link of backlinks) {
          queryPayload.push([
            link.type,
            this.get(link.id, query),
          ]);
        }
        return queryPayload;
      }
    }

    // types
    foreembeds(id: string, query?: QUERY_TYPE.ID): Embeds | undefined;
    foreembeds(id: string, query: QUERY_TYPE.NODE): Node[] | undefined;
    foreembeds(id: string, query: string | string[]): string[] | undefined;
    // define
    foreembeds(id: string, query: string | string[] = QUERY_TYPE.ID): Embeds | Node[] | string[] | undefined {
      this.checkLock();
      const node: Node | undefined = this.get(id);
      if (!node) { return undefined; }
      // with 'id's
      if (query === QUERY_TYPE.ID) {
        return node.embeds;
      // with query
      } else {
        const queryPayload: string[] = [];
        for (const embed of node.embeds) {
          queryPayload.push(this.get(embed.id, query));
        }
        return queryPayload;
      }
    }

    // types
    backembeds(id: string, query?: QUERY_TYPE.ID): Embeds | undefined;
    backembeds(id: string, query: QUERY_TYPE.NODE): Node[] | undefined;
    backembeds(id: string, query: string | string[]): string[] | undefined;
    // define
    backembeds(id: string, query: string | string[] = QUERY_TYPE.ID): Embeds | Node[] | string[] | undefined {
      this.checkLock();
      if (!this.has(id)) { return undefined; }
      // build backembeds
      const backembeds: Embeds = [];
      for (const node of this.all(QUERY_TYPE.NODE)) {
        if (node.inEmbeds(id)) {
          for (const embed of node.embeds) {
            if (id === embed.id) {
              backembeds.push({
                id: node.id,
                media: NODE.MEDIA.MARKDOWN,
              });
            }
          }
        }
      }
      // with 'id's
      if (query === QUERY_TYPE.ID) {
        return backembeds;
      // with query
      } else {
        const queryPayload: string[] = [];
        for (const embed of backembeds) {
          queryPayload.push(
            this.get(embed.id, query),
          );
        }
        return queryPayload;
      }
    }

    // this is a helper method to populate 'neighbors' for the graph -- 
    // hence no query support...for now
    neighbors(id: string, kind: REL.REF = REL.REF.REF): string[] | undefined {
      this.checkLock();
      let neighbors: string[] = [];
      const node: Node | undefined = this.get(id);
      if (!node) { return undefined; }
      // attrs
      if ((kind === REL.REF.REF) || (kind === REL.REF.ATTR)) {
        let backattrs: Attrs | string[] | undefined = this.backattrs(id);
        if (!backattrs) { backattrs = []; }
        neighbors = neighbors
          .concat(Object.values(node.attrs).flatMap((ids) => Array.from(ids)))
          .concat(Object.values(backattrs).flatMap((ids) => Array.from(ids)));
      }
      // links
      if ((kind === REL.REF.REF) || (kind === REL.REF.LINK)) {
        let backlinks: Links | string[] | undefined = this.backlinks(id);
        if (!backlinks) { backlinks = []; }
        neighbors = neighbors
          .concat(node.links.map((link: Link) => link.id))
          .concat(backlinks.map((link: Link | any) => link.id));
      }
      // embeds
      if ((kind === REL.REF.REF) || (kind === REL.REF.EMBED)) {
        let backembeds: Embeds | string[] | undefined = this.backembeds(id);
        if (!backembeds) { backembeds = []; }
        neighbors = neighbors
          .concat(node.embeds.map((embed: Embed) => embed.id))
          .concat(backembeds.map((embed: Embed | any) => embed.id));
      }
      return neighbors;
    }

    // methods

    public flushRelRefs(id?: string): boolean {
      this.checkLock();
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
          const relRefNode: Node | undefined = this.get(relRefID);
          if (!relRefNode) { continue; }
          const isZombie: boolean = (relRefNode.kind === NODE.KIND.ZOMBIE);
          const hasRel: boolean = this.all(QUERY_TYPE.NODE).some((node) => (
                                            ((node.id !== relRefID) && node.inChildren(relRefID))
                                            ||
                                            (((node.id !== relRefID) && (node.id !== id))
                                              && (node.inAttrs(relRefID) ||
                                                  node.inLinks(relRefID) ||
                                                  node.inEmbeds(relRefID)))
                                          ));
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
        for (const node of this.all(QUERY_TYPE.NODE)) {
          const isZombie: boolean = (node.kind === NODE.KIND.ZOMBIE);
          const hasFamRel: boolean = this.all(QUERY_TYPE.NODE).some((relNode) =>
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

    // todo: disallow attribute add if (type === ''), or automatically set in links
    public connect(
      sourceID: string,
      targetID: string,
      kind: REL.REF,
      type: string = '',
    ): boolean {
      if (kind === REL.REF.REF) {
        console.warn('please connect to a more specific relationship(\'REL.REF.ATTR\', \'REL.REF.LINK\', or \'REL.REF.EMBED\'');
        return false;
      }
      this.checkLock();
      const sourceNode: Node | undefined = this.get(sourceID);
      if (!sourceNode) {
        console.warn(`source node with id "${sourceID}" not found`);
        return false;
      }
      if (!this.has(targetID)) {
        console.warn(`target node with id "${targetID}" not found`);
        return false;
      }
      if (kind === REL.REF.ATTR) {
        // create
        if (!Object.keys(sourceNode.attrs).includes(type)) {
          sourceNode.attrs[type] = new Set([targetID]);
        // add
        } else {
          // todo: sets or add counters
          sourceNode.attrs[type].add(targetID);
        }
        if (sourceNode.attrs[type].has(targetID)) { return true; }
      }
      if (kind === REL.REF.LINK) {
        const hasLink: Link | undefined = sourceNode.links.find((link: Link) => 
          ((link.type === type) && (link.id === targetID))
        );
        // create
        if (hasLink === undefined) {
          // todo: sets or add counters
          sourceNode.links.push({
            type: type,
            id: targetID,
          } as Link);
        }
        // todo: add if-check to verify it addition really succeeded
        return true;
      }
      if (kind === REL.REF.EMBED) {
        // todo: media kinds
        if ((type === '') || (type === NODE.MEDIA.MARKDOWN)) {
          type = NODE.MEDIA.MARKDOWN;
        } else {
          if (!Object.keys(NODE.MEDIA).includes(type)) {
            console.warn('invalid media kind: ' + type);
            return false;
          }
        }
        const hasEmbed: Embed | undefined = sourceNode.embeds.find((embed: Embed) => 
          ((embed.media === type) && (embed.id === targetID))
        );
        // create
        if (hasEmbed === undefined) {
          // todo: sets or add counters
          sourceNode.embeds.push({
            media: type,
            id: targetID,
          } as Embed);
        }
        // todo: add if-check to verify it addition really succeeded
        return true;
      }
      return false;
    }

    // edit

    public retype(
      oldType: string,
      newType: string,
      kind: REL.REF = REL.REF.REF,
    ): boolean {
      this.checkLock();
      const retypes: boolean[] = [];
      for (const node of this.all(QUERY_TYPE.NODE)) {
        if ((kind === REL.REF.REF) || (kind === REL.REF.ATTR)) {
          if (Object.keys(node.attrs).includes(oldType)
          && !Object.keys(node.attrs).includes(newType)) {
            node.attrs[newType] = new Set(node.attrs[oldType]);
            delete node.attrs[oldType];
            retypes.push(Object.keys(node.attrs).includes(newType));
          }
        }
        if ((kind === REL.REF.REF) || (kind === REL.REF.LINK)) {
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
      kind: REL.REF = REL.REF.REF,
    ): boolean {
      this.checkLock();
      if (sourceID === targetID) {
        console.warn('source and target are the same');
        return false;
      }
      const sourceNode: Node | undefined = this.get(sourceID);
      const targetNode: Node | undefined = this.get(targetID);
      if (!sourceNode) {
        console.warn(`source node with id "${sourceID}" not in index`);
        return false;
      }
      if (!targetNode) {
        console.warn(`target node with id "${targetID}" not in index`);
        return false;
      }
      if ((kind === REL.REF.REF) || (kind === REL.REF.ATTR)) {
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
      if ((kind === REL.REF.REF) || (kind === REL.REF.LINK)) {
        targetNode.links = targetNode.links.concat(sourceNode.links.filter((l) => l.id !== targetID));
        sourceNode.links = [] as Links;
      }
      if ((kind === REL.REF.REF) || (kind === REL.REF.EMBED)) {
        targetNode.embeds = targetNode.embeds.concat(sourceNode.embeds.filter((e) => e.id !== targetID));
        sourceNode.embeds = [] as Embeds;
      }
      return true;
    }

    // remove

    public disconnect(
      sourceID: string,
      targetID: string,
      kind: REL.REF,
      type: string = '',
    ): boolean {
      if (kind === REL.REF.REF) {
        console.warn('please connect to a more specific relationship(\'REL.REF.ATTR\', \'REL.REF.LINK\', or \'REL.REF.EMBED\'');
        return false;
      }
      this.checkLock();
      const sourceNode: Node | undefined = this.get(sourceID);
      if (!sourceNode) {
        console.warn(`source node with id "${sourceID}" not found`);
        return false;
      }
      if (!this.has(targetID)) {
        console.warn(`target node with id "${targetID}" not found`);
        return false;
      }
      if (kind === REL.REF.ATTR) {
        // rm whole attr
        if (sourceNode.attrs[type].size === 1) {
          delete sourceNode.attrs[type];
          if (!Object.keys(sourceNode.attrs).includes(type)) { return true; }
        // rm single id
        } else {
          sourceNode.attrs[type].delete(targetID);
          if (!sourceNode.attrs[type].has(targetID)) { return true; }
        }
      }
      if (kind === REL.REF.LINK) {
        for (let i = 0; i < sourceNode.links.length; i++) {
          // rm
          if ((sourceNode.links[i].id === targetID)
          && (sourceNode.links[i].type === type)) {
            sourceNode.links.splice(i, 1);
          }
        }
        if (!sourceNode.links.find((link: Link) => 
          (link.type === type) && (link.id === targetID))
        ) {
          return true;
        }
      }
      if (kind === REL.REF.EMBED) {
        if ((type === '') || (type === NODE.MEDIA.MARKDOWN)) {
          type = NODE.MEDIA.MARKDOWN;
        } else {
          if (!Object.keys(NODE.MEDIA).includes(type)) {
            console.warn('invalid media kind: ' + type);
            return false;
          }
        }
        for (let i = 0; i < sourceNode.embeds.length; i++) {
          // rm
          if ((sourceNode.embeds[i].id === targetID)
          && (sourceNode.embeds[i].media === type)) {
            sourceNode.embeds.splice(i, 1);
          }
        }
        if (!sourceNode.embeds.find((embed: Embed) => 
          (embed.media === type) && (embed.id === targetID))
        ) {
          return true;
        }
      }
      return false;
    }
  };
}
