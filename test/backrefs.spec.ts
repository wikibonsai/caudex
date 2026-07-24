import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import type { Attrs, Links } from '../src/types';
import { Caudex, REL } from '../src/index';


// mechanism tests for the back-ref (inverse) index.
//
// these exercise the CACHING machinery itself (rebuild / dirty / invalidation),
// complementing use-case.spec.ts which exercises the behavior through realistic
// file-operation flows.

let data: any;
let wb: any;
let fakeConsoleWarn: any;
let stubNanoid: any;

describe('back-ref index (mechanism)', () => {

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
  });

  afterEach(() => {
    fakeConsoleWarn.restore();
    stubNanoid.restore();
  });

  describe('rebuildBackRefsIndex() invariant', () => {

    it('an explicit rebuild yields the same back-views (deterministic derivation)', () => {
      wb.connect('1', '2', REL.REF.LINK, 'linktype');
      wb.connect('3', '2', REL.REF.LINK, 'linktype');
      wb.connect('1', '2', REL.REF.ATTR, 'tags');
      wb.connect('1', '2', REL.REF.EMBED);
      const links = wb.backlinks('2');
      const attrs = wb.backattrs('2');
      const embeds = wb.backembeds('2');
      // force a from-scratch rebuild; the cache must be a pure function of the
      // forward refs, so results are unchanged.
      wb.rebuildBackRefsIndex();
      assert.deepEqual(wb.backlinks('2'), links);
      assert.deepEqual(wb.backattrs('2'), attrs);
      assert.deepEqual(wb.backembeds('2'), embeds);
    });

  });

  describe('dirty / rebuild lifecycle', () => {

    it('rebuilds once, then serves from cache until a mutation', () => {
      wb.connect('1', '2', REL.REF.LINK, 'linktype');
      const spy = sinon.spy(wb, 'rebuildBackRefsIndex');
      // first query rebuilds (dirty after the connect)...
      wb.backlinks('2');
      assert.strictEqual(spy.callCount, 1);
      // ...second query with no mutation is served from cache
      wb.backlinks('2');
      assert.strictEqual(spy.callCount, 1);
      spy.restore();
    });

    it('every mutating op invalidates the cache (sets it dirty)', () => {
      wb.connect('1', '2', REL.REF.LINK, 'linktype');
      // each case: warm the cache (dirty -> false), mutate, expect dirty -> true.
      // asserted on the flag directly so it also covers clear() (which empties the
      // index, so a follow-up query would short-circuit before rebuilding).
      const cases: Array<[string, () => void]> = [
        ['connect', () => wb.connect('3', '2', REL.REF.LINK, 'x')],
        ['disconnect', () => wb.disconnect('3', '2', REL.REF.LINK, 'x')],
        ['transfer', () => wb.transfer('1', '4')],
        ['retype', () => wb.retype('linktype', 'renamed', REL.REF.LINK)],
        ['flushRelRefs', () => wb.flushRelRefs('4')],
        ['add', () => wb.add({ uri: 'file://data/5', filename: 'five', title: 'Five' }, { id: '5' })],
        ['rm', () => wb.rm('5')],
        ['clear', () => wb.clear()],
      ];
      for (const [name, mutate] of cases) {
        wb.rebuildBackRefsIndex();                       // warm: dirty -> false
        assert.strictEqual(wb.backRefsIndexDirty, false);
        mutate();
        assert.strictEqual(wb.backRefsIndexDirty, true, `${name} should invalidate the back-ref cache`);
      }
    });

  });

  describe('lazy design tolerates direct forward-ref mutation', () => {

    it('reads back-views correctly even when refs were set without connect()', () => {
      // bypass the API entirely (as several specs / consumers do)
      wb.index['1'].links.push({ type: 'test', id: '2' });
      wb.index['3'].attrs['tags'] = new Set(['2']);
      // a fresh instance starts dirty, so the first query rebuilds from the
      // authoritative forward refs and sees the direct pokes.
      assert.deepEqual(wb.backlinks('2'), [{ type: 'test', id: '1' }] as Links);
      assert.deepEqual(wb.backattrs('2'), { tags: new Set(['3']) } as Attrs);
    });

  });

  describe('back-view ordering follows index order', () => {

    it('lists referrers in index-insertion order regardless of connect order', () => {
      // connect 3 before 1; the result should still be [1, 3]
      wb.connect('3', '2', REL.REF.LINK, 'linktype');
      wb.connect('1', '2', REL.REF.LINK, 'linktype');
      assert.deepEqual(wb.backlinks('2'), [
        { type: 'linktype', id: '1' },
        { type: 'linktype', id: '3' },
      ] as Links);
    });

  });

  describe('has() is O(1) and prototype-safe', () => {

    it('returns true for real ids and false for inherited object keys', () => {
      assert.strictEqual(wb.has('1'), true);
      assert.strictEqual(wb.has('nope'), false);
      // guard against the `id in index` / prototype footgun
      assert.strictEqual(wb.has('toString'), false);
      assert.strictEqual(wb.has('constructor'), false);
      assert.strictEqual(wb.has('hasOwnProperty'), false);
    });

  });

});
