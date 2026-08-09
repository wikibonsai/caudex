import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import type { Edge } from '../src/edge';
import { Caudex, NODE, EDGE } from '../src/index';


// the Edge object: web relations (attr / link / embed) reified as normalized
// '{source, target, ...}' objects -- the API facade for the edges-as-rows
// storage that lands with the engine adapter (refactor #2). 'edges()' is a
// derived VIEW over the source-owned forward refs; storage is unchanged.
//
// 'position' is the occurrence anchor: the character offset of the ref in the
// source doc. It is what makes two otherwise-identical links distinct
// occurrences, and what context snippets / block-level citation derive from
// (store the anchor, derive the sentence). attrs are a SET per type -- no
// position.

let data: any;
let wb: any;
let fakeConsoleWarn: any;
let stubNanoid: any;

describe('edges (web relations, reified)', () => {

  beforeEach(() => {
    console.warn = (msg) => msg + '\n';
    fakeConsoleWarn = sinon.spy(console, 'warn');
    stubNanoid = sinon.stub(nanoid, 'nanoid').returns('404');
    data = [
      { init: { id: '1' }, data: { uri: 'file://data/1', filename: 'one', title: 'One' } },
      { init: { id: '2' }, data: { uri: 'file://data/2', filename: 'two', title: 'Two' } },
      { init: { id: '3' }, data: { uri: 'file://data/3', filename: 'three', title: 'Three' } },
      { init: { id: '4' }, data: { uri: 'file://data/4', filename: 'four', title: 'Four' } },
    ];
    wb = new Caudex(data, { uniqKeys: ['uri', 'filename'], zombieKey: 'filename' });
    wb.setRoot('1');
    wb.graft('1', '2');
  });

  afterEach(() => {
    fakeConsoleWarn.restore();
    stubNanoid.restore();
  });

  describe('edges()', () => {

    it('one normalized shape across attr / link / embed', () => {
      wb.connect('1', '2', EDGE.KIND.ATTR, 'tags');
      wb.connect('1', '3', { kind: EDGE.KIND.LINK, type: 'linktype', header: 'section-a' });
      wb.connect('2', '4', { kind: EDGE.KIND.EMBED, media: NODE.MEDIA.IMAGE });
      wb.connect('2', '3', EDGE.KIND.EMBED);   // doc-embed: no media
      assert.deepEqual(wb.edges(), [
        { source: '1', target: '2', kind: EDGE.KIND.ATTR, type: 'tags' },
        { source: '1', target: '3', kind: EDGE.KIND.LINK, type: 'linktype', header: 'section-a' },
        { source: '2', target: '4', kind: EDGE.KIND.EMBED, media: NODE.MEDIA.IMAGE },
        { source: '2', target: '3', kind: EDGE.KIND.EMBED },
      ] as Edge[]);
    });

    it('filter by type / header', () => {
      wb.connect('1', '3', { kind: EDGE.KIND.LINK, type: 'linktype' });
      wb.connect('1', '3', { kind: EDGE.KIND.LINK, type: 'other', header: 'section-a' });
      wb.connect('1', '2', EDGE.KIND.ATTR, 'other');
      // projector order: attrs, then links, then embeds per node
      assert.deepEqual(wb.edges({ type: 'other' }), [
        { source: '1', target: '2', kind: EDGE.KIND.ATTR, type: 'other' },
        { source: '1', target: '3', kind: EDGE.KIND.LINK, type: 'other', header: 'section-a' },
      ] as Edge[]);
      assert.deepEqual(wb.edges({ kind: EDGE.KIND.LINK, type: 'other' }), [
        { source: '1', target: '3', kind: EDGE.KIND.LINK, type: 'other', header: 'section-a' },
      ] as Edge[]);
      assert.deepEqual(wb.edges({ header: 'section-a' }), [
        { source: '1', target: '3', kind: EDGE.KIND.LINK, type: 'other', header: 'section-a' },
      ] as Edge[]);
    });

    it('filter by source / target / kind', () => {
      wb.connect('1', '2', EDGE.KIND.ATTR, 'tags');
      wb.connect('1', '3', EDGE.KIND.LINK, 'linktype');
      wb.connect('3', '1', EDGE.KIND.LINK, 'linktype');
      assert.deepEqual(wb.edges({ source: '1' }), [
        { source: '1', target: '2', kind: EDGE.KIND.ATTR, type: 'tags' },
        { source: '1', target: '3', kind: EDGE.KIND.LINK, type: 'linktype' },
      ] as Edge[]);
      assert.deepEqual(wb.edges({ target: '1' }), [
        { source: '3', target: '1', kind: EDGE.KIND.LINK, type: 'linktype' },
      ] as Edge[]);
      assert.deepEqual(wb.edges({ kind: EDGE.KIND.LINK }), [
        { source: '1', target: '3', kind: EDGE.KIND.LINK, type: 'linktype' },
        { source: '3', target: '1', kind: EDGE.KIND.LINK, type: 'linktype' },
      ] as Edge[]);
    });

    it('empty caudex web; empty list', () => {
      assert.deepEqual(wb.edges(), []);
    });

  });

  describe('position (the occurrence anchor)', () => {

    it('a link carries its position when connected with one', () => {
      wb.connect('1', '3', { kind: EDGE.KIND.LINK, type: 'linktype', position: 42 });
      assert.deepEqual(wb.edges(), [
        { source: '1', target: '3', kind: EDGE.KIND.LINK, type: 'linktype', position: 42 },
      ] as Edge[]);
    });

    it('same (type, target, header) at DIFFERENT positions = distinct occurrences', () => {
      wb.connect('1', '3', { kind: EDGE.KIND.LINK, type: 'linktype', position: 42 });
      wb.connect('1', '3', { kind: EDGE.KIND.LINK, type: 'linktype', position: 187 });
      assert.strictEqual((wb.edges({ kind: EDGE.KIND.LINK }) as Edge[]).length, 2);
    });

    it('same position connected twice = one occurrence (dedup)', () => {
      wb.connect('1', '3', { kind: EDGE.KIND.LINK, type: 'linktype', position: 42 });
      wb.connect('1', '3', { kind: EDGE.KIND.LINK, type: 'linktype', position: 42 });
      assert.strictEqual((wb.edges({ kind: EDGE.KIND.LINK }) as Edge[]).length, 1);
    });

    it('no positions given; dedup behaves as before (one ref)', () => {
      wb.connect('1', '3', EDGE.KIND.LINK, 'linktype');
      wb.connect('1', '3', EDGE.KIND.LINK, 'linktype');
      assert.strictEqual((wb.edges({ kind: EDGE.KIND.LINK }) as Edge[]).length, 1);
    });

    it('embeds carry positions too', () => {
      wb.connect('2', '4', { kind: EDGE.KIND.EMBED, media: NODE.MEDIA.IMAGE, position: 7 });
      assert.deepEqual(wb.edges({ kind: EDGE.KIND.EMBED }), [
        { source: '2', target: '4', kind: EDGE.KIND.EMBED, media: NODE.MEDIA.IMAGE, position: 7 },
      ] as Edge[]);
    });

    it('attrs are a set per type; position is ignored', () => {
      wb.connect('1', '2', { kind: EDGE.KIND.ATTR, type: 'tags', position: 42 });
      assert.deepEqual(wb.edges({ kind: EDGE.KIND.ATTR }), [
        { source: '1', target: '2', kind: EDGE.KIND.ATTR, type: 'tags' },
      ] as Edge[]);
    });

  });

  describe('disconnect by occurrence', () => {

    it('position given; removes ONLY that occurrence', () => {
      wb.connect('1', '3', { kind: EDGE.KIND.LINK, type: 'linktype', position: 42 });
      wb.connect('1', '3', { kind: EDGE.KIND.LINK, type: 'linktype', position: 187 });
      assert.strictEqual(
        wb.disconnect('1', '3', { kind: EDGE.KIND.LINK, type: 'linktype', position: 187 }),
        true,
      );
      assert.deepEqual(wb.edges({ kind: EDGE.KIND.LINK }), [
        { source: '1', target: '3', kind: EDGE.KIND.LINK, type: 'linktype', position: 42 },
      ] as Edge[]);
    });

    it('position omitted; position-blind (removes an anchored occurrence too)', () => {
      wb.connect('1', '3', { kind: EDGE.KIND.LINK, type: 'linktype', position: 42 });
      assert.strictEqual(wb.disconnect('1', '3', EDGE.KIND.LINK, 'linktype'), true);
      assert.deepEqual(wb.edges({ kind: EDGE.KIND.LINK }), []);
    });

    it('embeds; position given removes only that occurrence', () => {
      wb.connect('2', '4', { kind: EDGE.KIND.EMBED, media: NODE.MEDIA.IMAGE, position: 7 });
      wb.connect('2', '4', { kind: EDGE.KIND.EMBED, media: NODE.MEDIA.IMAGE, position: 99 });
      assert.strictEqual(
        wb.disconnect('2', '4', { kind: EDGE.KIND.EMBED, media: NODE.MEDIA.IMAGE, position: 7 }),
        true,
      );
      assert.deepEqual(wb.edges({ kind: EDGE.KIND.EMBED }), [
        { source: '2', target: '4', kind: EDGE.KIND.EMBED, media: NODE.MEDIA.IMAGE, position: 99 },
      ] as Edge[]);
    });

  });

  describe('freshness (rides the change events)', () => {

    it('web mutation stales the view; next read is fresh', () => {
      assert.deepEqual(wb.edges(), []);   // warm
      wb.connect('1', '3', EDGE.KIND.LINK, 'linktype');
      assert.strictEqual((wb.edges() as Edge[]).length, 1);
      wb.disconnect('1', '3', EDGE.KIND.LINK, 'linktype');
      assert.deepEqual(wb.edges(), []);
    });

    it('tree-only mutation leaves the view warm (scoped {node, web})', () => {
      wb.edges();   // warm
      assert.strictEqual(wb.edgesIndex.dirty, false);
      wb.graft('2', '3');
      assert.strictEqual(wb.edgesIndex.dirty, false);
    });

    it('direct forward-ref pokes are seen after any web/node mutation (lazy tolerance)', () => {
      wb.edges();   // warm
      wb.index['1'].links.push({ type: 'poked', id: '4' });
      wb.connect('2', '3', EDGE.KIND.LINK, 'x');   // any invalidating mutation
      const out: Edge[] = wb.edges() as Edge[];
      assert.ok(out.some((r: Edge) => r.source === '1' && r.target === '4' && r.type === 'poked'));
    });

  });

});
