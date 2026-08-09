import assert from 'node:assert';

import type { ChangeEvent, StoragePort } from '../src/store';
import { DerivedIndex, NodeStore } from '../src/store';
import { Node, NODE } from '../src/index';


let store: NodeStore;

const buildNode = (id: string, data: any = {}): Node =>
  new Node(id, NODE.KIND.DOC, NODE.TYPE.DEFAULT, data);

describe('store (StoragePort)', () => {

  describe('construction', () => {

    it('with uniqKeys; init one empty column per key', () => {
      store = new NodeStore(['filename', 'uri']);
      assert.deepEqual(store.uniqKeys, ['filename', 'uri']);
      assert.deepEqual(store.uniqKeyMap, { 'filename': {}, 'uri': {} });
    });

    it('without uniqKeys; no key map', () => {
      store = new NodeStore();
      assert.deepEqual(store.uniqKeys, []);
      assert.strictEqual(store.uniqKeyMap, undefined);
    });

  });

  describe('node crud', () => {

    beforeEach(() => {
      store = new NodeStore(['filename']);
    });

    it('put; get; has', () => {
      const node: Node = buildNode('1', { filename: 'one' });
      store.put(node);
      assert.strictEqual(store.has('1'), true);
      assert.strictEqual(store.get('1'), node);
    });

    it('get; missing id yields undefined (no warn -- semantic layer owns messaging)', () => {
      assert.strictEqual(store.get('404'), undefined);
      assert.strictEqual(store.has('404'), false);
    });

    it('all; insertion order', () => {
      const one: Node = buildNode('1');
      const two: Node = buildNode('2');
      store.put(one);
      store.put(two);
      assert.deepEqual(store.all(), [one, two]);
    });

    it('delete; removes the node only -- key map entries are left in place (parity with raw index deletes)', () => {
      const node: Node = buildNode('1', { filename: 'one' });
      store.put(node);
      store.indexKey('filename', 'one', '1');
      assert.strictEqual(store.delete('1'), true);
      assert.strictEqual(store.has('1'), false);
      // key map deliberately untouched -- de-indexing is an explicit, separate op
      assert.deepEqual(store.uniqKeyMap, { 'filename': { 'one': '1' } });
    });

    it('delete; missing id yields false', () => {
      assert.strictEqual(store.delete('404'), false);
    });

    it('clear; empties nodes, leaves key map (parity with base.clear())', () => {
      store.put(buildNode('1', { filename: 'one' }));
      store.indexKey('filename', 'one', '1');
      store.clear();
      assert.deepEqual(store.all(), []);
      assert.deepEqual(store.uniqKeyMap, { 'filename': { 'one': '1' } });
    });

    it('nodes; live record view (transitional accessor for base.index)', () => {
      const node: Node = buildNode('1');
      store.put(node);
      assert.deepEqual(store.nodes, { '1': node });
      // in-place mutation through the view is visible to the store
      store.nodes['1'].type = 'entry';
      assert.strictEqual((store.get('1') as Node).type, 'entry');
    });

  });

  describe('unique key lookup', () => {

    beforeEach(() => {
      store = new NodeStore(['filename']);
    });

    it('indexKey; findIDByKey', () => {
      store.indexKey('filename', 'one', '1');
      assert.strictEqual(store.findIDByKey('filename', 'one'), '1');
    });

    it('findIDByKey; missing value yields undefined', () => {
      assert.strictEqual(store.findIDByKey('filename', 'nope'), undefined);
    });

    it('deindexKey; removes the entry', () => {
      store.indexKey('filename', 'one', '1');
      store.deindexKey('filename', 'one');
      assert.strictEqual(store.findIDByKey('filename', 'one'), undefined);
    });

    it('indexKey / deindexKey / findIDByKey; no-ops without a key map', () => {
      store = new NodeStore();
      store.indexKey('filename', 'one', '1');
      store.deindexKey('filename', 'one');
      assert.strictEqual(store.findIDByKey('filename', 'one'), undefined);
    });

  });

  describe('serialize', () => {

    it('serialize; json of the node record', () => {
      store = new NodeStore(['filename']);
      const node: Node = buildNode('1', { filename: 'one' });
      store.put(node);
      assert.strictEqual(store.serialize(), JSON.stringify({ '1': node }));
    });

  });

  describe('derived indexes', () => {

    let projectorCalls: number;

    beforeEach(() => {
      store = new NodeStore(['filename']);
      projectorCalls = 0;
    });

    const countProjector = (s: StoragePort): number => {
      projectorCalls += 1;
      return s.all().length;
    };

    it('starts dirty; first ensure() projects, then serves from cache', () => {
      const idx: DerivedIndex<number> = store.defineIndex('count', countProjector);
      assert.strictEqual(idx.dirty, true);
      store.put(buildNode('1'));
      assert.strictEqual(idx.ensure(store), 1);
      assert.strictEqual(idx.dirty, false);
      assert.strictEqual(projectorCalls, 1);
      // cached -- no re-projection
      assert.strictEqual(idx.ensure(store), 1);
      assert.strictEqual(projectorCalls, 1);
    });

    it('invalidate() marks dirty; next ensure() re-projects', () => {
      const idx: DerivedIndex<number> = store.defineIndex('count', countProjector);
      idx.ensure(store);
      idx.invalidate();
      assert.strictEqual(idx.dirty, true);
      store.put(buildNode('1'));
      assert.strictEqual(idx.ensure(store), 1);
      assert.strictEqual(projectorCalls, 2);
    });

    it('rebuild() re-projects unconditionally and clears dirty', () => {
      const idx: DerivedIndex<number> = store.defineIndex('count', countProjector);
      idx.ensure(store);
      idx.rebuild(store);
      assert.strictEqual(projectorCalls, 2);
      assert.strictEqual(idx.dirty, false);
    });

    it('value; reads the current projection without rebuilding', () => {
      const idx: DerivedIndex<number> = store.defineIndex('count', countProjector);
      assert.strictEqual(idx.value, undefined);
      idx.ensure(store);
      assert.strictEqual(idx.value, 0);
      assert.strictEqual(projectorCalls, 1);
    });

    it('invalidateIndexes(); sweeps every registered index', () => {
      const one: DerivedIndex<number> = store.defineIndex('one', countProjector);
      const two: DerivedIndex<number> = store.defineIndex('two', countProjector);
      one.ensure(store);
      two.ensure(store);
      store.invalidateIndexes();
      assert.strictEqual(one.dirty, true);
      assert.strictEqual(two.dirty, true);
    });

    it('defineIndex with scopes; signal() invalidates only matching indexes and notifies listeners', () => {
      const treeIdx: DerivedIndex<number> = store.defineIndex('tree-scoped', countProjector, { scopes: ['node', 'tree'] });
      const webIdx: DerivedIndex<number> = store.defineIndex('web-scoped', countProjector, { scopes: ['node', 'web'] });
      treeIdx.ensure(store);
      webIdx.ensure(store);
      const events: ChangeEvent[] = [];
      store.onChange((e: ChangeEvent) => events.push(e));
      store.signal({ kind: 'tree', op: 'graft' });
      assert.strictEqual(treeIdx.dirty, true);
      assert.strictEqual(webIdx.dirty, false);
      assert.deepEqual(events, [{ kind: 'tree', op: 'graft' }]);
    });

    it('defineIndex default scopes; every kind invalidates', () => {
      const idx: DerivedIndex<number> = store.defineIndex('all-scoped', countProjector);
      idx.ensure(store);
      store.signal({ kind: 'web', op: 'connect' });
      assert.strictEqual(idx.dirty, true);
    });

  });

});
