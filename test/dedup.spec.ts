import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import { create } from '../src/index';


// duplicate-handling contract:
//   - add() must never silently overwrite on an init.id collision (Defect A).
//   - the constructor must offer a non-fatal failure mode (Defect B) so one bad
//     item can't abandon the whole index. Default stays 'throw' for back-compat.

const OPTS = { uniqKeys: ['uri', 'filename'], zombieKey: 'filename' } as any;

let fakeConsoleWarn: any;
let stubNanoid: any;

function items(rows: Array<{ id?: string; uri: string; filename: string; title?: string }>): any[] {
  return rows.map((r) => ({
    ...(r.id ? { init: { id: r.id } } : {}),
    data: { uri: r.uri, filename: r.filename, title: r.title ?? r.filename },
  }));
}

describe('duplicate handling', () => {

  beforeEach(() => {
    console.warn = (msg) => msg + '\n';
    fakeConsoleWarn = sinon.spy(console, 'warn');
    stubNanoid = sinon.stub(nanoid, 'nanoid').returns('minted');
  });

  afterEach(() => {
    fakeConsoleWarn.restore();
    stubNanoid.restore();
  });

  describe('Task A -- add() is collision-safe on init.id', () => {

    it('rejects an init.id collision without overwriting the existing node', () => {
      const wb: any = create(items([{ id: '1', uri: 'u1', filename: 'one', title: 'One' }]), OPTS);
      const result = wb.add({ uri: 'u2', filename: 'two', title: 'Two' }, { id: '1' });
      // rejected, symmetric with the data.id guard
      assert.strictEqual(result, undefined);
      // existing node '1' is untouched...
      assert.strictEqual(wb.get('1').data.filename, 'one');
      assert.strictEqual(wb.get('1').data.uri, 'u1');
      // ...and the colliding item was not indexed under any key
      assert.strictEqual(wb.find('filename', 'two'), undefined);
      assert.strictEqual(wb.find('uri', 'u2'), undefined);
      assert.ok(fakeConsoleWarn.called);
    });

    it('the rejected path does not corrupt uniqKeyMap (a later, valid add still works)', () => {
      const wb: any = create(items([{ id: '1', uri: 'u1', filename: 'one' }]), OPTS);
      wb.add({ uri: 'u2', filename: 'two' }, { id: '1' });   // rejected
      const ok = wb.add({ uri: 'u3', filename: 'three' }, { id: '3' }); // valid
      assert.ok(ok);
      assert.strictEqual(wb.find('filename', 'three')?.id, '3');
    });

    it('a non-colliding init.id add is unaffected (regression)', () => {
      const wb: any = create(items([{ id: '1', uri: 'u1', filename: 'one' }]), OPTS);
      const node = wb.add({ uri: 'u2', filename: 'two' }, { id: '2' });
      assert.strictEqual(node?.id, '2');
      assert.strictEqual(wb.has('2'), true);
    });

  });

  describe('Task B -- constructor non-fatal failure mode', () => {

    it('default (throw) still aborts on a duplicate item (back-compat)', () => {
      assert.throws(() => create(items([
        { id: '1', uri: 'ua', filename: 'a' },
        { id: '2', uri: 'ub', filename: 'a' }, // duplicate filename
      ]), OPTS));
    });

    it('collect: indexes every other item and records the dropped one', () => {
      const wb: any = create(items([
        { id: '1', uri: 'ua', filename: 'a' },
        { id: '2', uri: 'ub', filename: 'b' },
        { id: '3', uri: 'ubooks', filename: 'b' }, // duplicate filename
        { id: '4', uri: 'uc', filename: 'c' },
      ]), { ...OPTS, onInitError: 'collect' });
      // no throw; a, b, c indexed
      assert.strictEqual((wb.all() as string[]).length, 3);
      assert.ok(wb.find('filename', 'a'));
      assert.ok(wb.find('filename', 'b'));
      assert.ok(wb.find('filename', 'c'));
      // the dropped item is recorded, tagged as a uniqKey collision
      assert.strictEqual(wb.initErrors.length, 1);
      assert.strictEqual(wb.initErrors[0].reason, 'uniqkey');
      assert.strictEqual(wb.initErrors[0].item.data.uri, 'ubooks');
    });

    it('collect: tags an id collision distinctly from a uniqKey collision', () => {
      const wb: any = create(items([
        { id: 'DUP', uri: 'ua', filename: 'a' },
        { id: 'DUP', uri: 'ub', filename: 'b' }, // same id, distinct filename
      ]), { ...OPTS, onInitError: 'collect' });
      assert.strictEqual((wb.all() as string[]).length, 1); // only the first
      assert.strictEqual(wb.initErrors.length, 1);
      assert.strictEqual(wb.initErrors[0].reason, 'id');
      // the recorded item still carries its data so a consumer can re-add it
      assert.strictEqual(wb.initErrors[0].item.data.filename, 'b');
    });

    it('collect: leaves initErrors empty on a clean batch', () => {
      const wb: any = create(items([
        { id: '1', uri: 'ua', filename: 'a' },
        { id: '2', uri: 'ub', filename: 'b' },
      ]), { ...OPTS, onInitError: 'collect' });
      assert.strictEqual(wb.initErrors.length, 0);
      assert.strictEqual((wb.all() as string[]).length, 2);
    });

    it('a consumer can re-add a dropped id-collision item with a fresh id (app policy)', () => {
      const wb: any = create(items([
        { id: 'DUP', uri: 'ua', filename: 'a' },
        { id: 'DUP', uri: 'ub', filename: 'b' },
      ]), { ...OPTS, onInitError: 'collect' });
      // recover the id-collision by re-adding its data without the colliding id
      for (const err of wb.initErrors) {
        if (err.reason === 'id') { wb.add(err.item.data); }
      }
      assert.strictEqual((wb.all() as string[]).length, 2);
      assert.ok(wb.find('filename', 'a'));
      assert.ok(wb.find('filename', 'b'));
    });

  });

});
