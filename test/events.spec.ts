import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import type { ChangeEvent } from '../src/store';
import { create, EDGE } from '../src/index';


// mechanism tests for the typed change-event API (composition refactor, phase 4
// caudex-half): every mutation signals a scoped event through the store; the
// scope both invalidates the matching derived indexes and reaches subscribers.
//
// kinds mirror the app's revision axes: 'node' (node set changed -- both indexes
// stale), 'tree' (hierarchy changed -- parentIndex only), 'web' (relations
// changed -- backRefsIndex only).

let data: any;
let wb: any;
let events: ChangeEvent[];
let fakeConsoleWarn: any;
let stubNanoid: any;

describe('change events (mechanism)', () => {

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
    wb = create(data, { uniqKeys: ['uri', 'filename'], zombieKey: 'filename' });
    wb.setRoot('1');
    wb.graft('1', '2');
    wb.graft('2', '3');
    events = [];
  });

  afterEach(() => {
    fakeConsoleWarn.restore();
    stubNanoid.restore();
  });

  const subscribe = (): void => {
    wb.store.onChange((e: ChangeEvent) => events.push(e));
  };

  const lastEvent = (): ChangeEvent | undefined => events[events.length - 1];

  describe('subscription', () => {

    it('onChange() delivers events; returned unsubscribe stops them', () => {
      const unsubscribe: () => void = wb.store.onChange((e: ChangeEvent) => events.push(e));
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      assert.strictEqual(events.length, 1);
      unsubscribe();
      wb.connect('3', '2', EDGE.KIND.LINK, 'linktype');
      assert.strictEqual(events.length, 1);
    });

  });

  describe('node-kind events (base mutations)', () => {

    it('add / rm / fill / flushGraph / clear each signal their op', () => {
      subscribe();
      wb.add({ uri: 'file://data/5', filename: 'five', title: 'Five' }, { id: '5' });
      assert.deepEqual(lastEvent(), { kind: 'node', op: 'add' });
      wb.fill('5', { uri: 'file://data/5', filename: 'five', title: 'Cinq' });
      assert.deepEqual(lastEvent(), { kind: 'node', op: 'fill', id: '5' });
      wb.rm('5');
      assert.deepEqual(lastEvent(), { kind: 'node', op: 'rm', id: '5' });
      wb.flushGraph();
      assert.deepEqual(lastEvent(), { kind: 'node', op: 'flushGraph' });
      wb.clear();
      assert.deepEqual(lastEvent(), { kind: 'node', op: 'clear' });
    });

    it('node-kind invalidates BOTH derived indexes', () => {
      wb.rebuildParentIndex();
      wb.rebuildBackRefsIndex();
      wb.add({ uri: 'file://data/5', filename: 'five', title: 'Five' }, { id: '5' });
      assert.strictEqual(wb.parentIndexDirty, true);
      assert.strictEqual(wb.backRefsIndexDirty, true);
    });

  });

  describe('tree-kind events (hierarchy mutations)', () => {

    it('graft / prune / replace / transplant / flushTree each signal their op', () => {
      subscribe();
      wb.graft('2', '4');
      assert.deepEqual(lastEvent(), { kind: 'tree', op: 'graft', id: '4' });
      wb.prune('2', '4');
      assert.deepEqual(lastEvent(), { kind: 'tree', op: 'prune', id: '4' });
      wb.replace('3', '4');
      assert.deepEqual(lastEvent(), { kind: 'tree', op: 'replace', id: '4' });
      wb.transplant('2', [{ id: '2', children: [] }]);
      assert.deepEqual(lastEvent(), { kind: 'tree', op: 'transplant', id: '2' });
      wb.flushTree();
      assert.deepEqual(lastEvent(), { kind: 'tree', op: 'flushTree' });
    });

    it('tree-kind invalidates ONLY the parent index', () => {
      wb.rebuildParentIndex();
      wb.rebuildBackRefsIndex();
      wb.graft('2', '4');
      assert.strictEqual(wb.parentIndexDirty, true);
      assert.strictEqual(wb.backRefsIndexDirty, false);
    });

  });

  describe('web-kind events (relation mutations)', () => {

    it('connect / disconnect / retype / transfer / flushWeb each signal their op', () => {
      subscribe();
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      assert.deepEqual(lastEvent(), { kind: 'web', op: 'connect', id: '1' });
      wb.disconnect('1', '2', EDGE.KIND.LINK, 'linktype');
      assert.deepEqual(lastEvent(), { kind: 'web', op: 'disconnect', id: '1' });
      wb.retype('linktype', 'renamed', EDGE.KIND.LINK);
      assert.deepEqual(lastEvent(), { kind: 'web', op: 'retype' });
      wb.transfer('1', '4');
      assert.deepEqual(lastEvent(), { kind: 'web', op: 'transfer', id: '1' });
      wb.flushWeb('4');
      assert.deepEqual(lastEvent(), { kind: 'web', op: 'flushWeb', id: '4' });
    });

    it('web-kind invalidates ONLY the back-ref index', () => {
      wb.rebuildParentIndex();
      wb.rebuildBackRefsIndex();
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      assert.strictEqual(wb.parentIndexDirty, false);
      assert.strictEqual(wb.backRefsIndexDirty, true);
    });

  });

  describe('content-only ops do NOT signal (parity with no-invalidation today)', () => {

    it('edit / flushData are silent', () => {
      subscribe();
      wb.edit('1', 'title', 'Uno');
      wb.flushData('1');
      assert.strictEqual(events.length, 0);
    });

  });

});
