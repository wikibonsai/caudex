import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import { create, Node, NODE, QUERY_TYPE, EDGE } from '../src/index';


// node state & phase -- fully DERIVED, never stored:
//
//   'node.state(): NODE.STATE' -- whether the document EXISTS (zombie ->
//     live), derived from kind-absence. Graph-free.
//   'node.phase(): NODE.PHASE' -- the node's integration phase (tree x web
//     attachment), evaluated lazily against the graph via the context bound
//     at node creation:
//                     in web        not in web
//     in tree     integrated       spur
//     not in tree   orphan           isolate
//
// phase() reports truthfully for ANY node (a referenced zombie reads
// 'orphan'); the bulk queries ('phases()' + cells) gate zombies out by
// state so health ratios count only live docs.
//
// fixture:
//   tree: 1 -> 2          web: 2 -> 3 (link)
//   4: unconnected        z ('zzz'): zombie via add(string)
//
//   1 = spur (tree only)      2 = integrated (tree + web)
//   3 = orphan (web only)           4 = isolate (neither)

let data: any;
let wb: any;
let fakeConsoleWarn: any;
let stubNanoid: any;

describe('node state & phase', () => {

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
    wb.connect('2', '3', EDGE.KIND.LINK, 'linktype');
  });

  afterEach(() => {
    fakeConsoleWarn.restore();
    stubNanoid.restore();
  });

  describe('state (derived; zombie -> live)', () => {

    it('a live node: state live, kind doc', () => {
      const node: Node = wb.get('1');
      assert.strictEqual(node.state(), NODE.STATE.LIVE);
      assert.strictEqual(node.kind, NODE.KIND.DOC);
    });

    it('a zombie node: state zombie, kind and type undefined', () => {
      const zombie: Node = wb.add('zzz');
      assert.strictEqual(zombie.state(), NODE.STATE.ZOMBIE);
      assert.strictEqual(zombie.kind, undefined);
      assert.strictEqual(zombie.type, undefined);
    });

    it('fill(); zombie becomes live via the kind assignment (nothing stored)', () => {
      const zombie: Node = wb.add('zzz');
      const filled: Node = wb.fill(zombie.id, { uri: 'file://data/z', filename: 'zzz', title: 'Zzz' });
      assert.strictEqual(filled.state(), NODE.STATE.LIVE);
      assert.strictEqual(filled.kind, NODE.KIND.DOC);
    });

    it('rm(); a still-referenced node zombifies (kind dropped -> state follows)', () => {
      // '3' is link-referenced by '2' -> zombifies instead of deleting
      assert.strictEqual(wb.rm('3'), true);
      const node: Node = wb.get('3');
      assert.strictEqual(node.state(), NODE.STATE.ZOMBIE);
      assert.strictEqual(node.kind, undefined);
      assert.strictEqual(node.type, undefined);
      assert.deepEqual(node.data, { filename: 'three' });
    });

    it('zombies(); lists exactly the zombie nodes', () => {
      wb.add('zzz');
      assert.deepEqual(wb.zombies(), ['404']);
    });

    it('filter opt nodeState; payload NODESTATE', () => {
      wb.add('zzz');
      assert.deepEqual(
        wb.nodes({ filter: { nodeState: NODE.STATE.ZOMBIE } }),
        ['404'],
      );
      assert.strictEqual(wb.get('1', { payload: QUERY_TYPE.NODESTATE }), NODE.STATE.LIVE);
    });

  });

  describe('phase() (the integration phase; derived from the graph)', () => {

    it('phase(); the 2x2', () => {
      assert.strictEqual(wb.get('1').phase(), NODE.PHASE.SPUR);
      assert.strictEqual(wb.get('2').phase(), NODE.PHASE.INTEGRATED);
      assert.strictEqual(wb.get('3').phase(), NODE.PHASE.ORPHAN);
      assert.strictEqual(wb.get('4').phase(), NODE.PHASE.ISOLATE);
    });

    it('phase(); reported truthfully for zombies (state stays zombie)', () => {
      const zombie: Node = wb.add('zzz');
      // unreferenced zombie: attached to nothing
      assert.strictEqual(zombie.phase(), NODE.PHASE.ISOLATE);
      assert.strictEqual(zombie.state(), NODE.STATE.ZOMBIE);
      // referenced zombie: web-attached -> orphan, state still zombie
      wb.connect('1', zombie.id, EDGE.KIND.LINK, 'linktype');
      assert.strictEqual(zombie.phase(), NODE.PHASE.ORPHAN);
      assert.strictEqual(zombie.state(), NODE.STATE.ZOMBIE);
    });

    it('phase(); a graph-unbound node throws (state() works standalone)', () => {
      const loose: Node = new Node('x', { filename: 'x' }, NODE.KIND.DOC);
      assert.strictEqual(loose.state(), NODE.STATE.LIVE);
      assert.throws(() => loose.phase(), /requires a graph-bound node/);
    });

    it('a bare root (no children) reads as tree-unattached', () => {
      // attachment is raw child-pointer state; a root with no grafts has none
      const solo = create(
        [{ init: { id: 's' }, data: { uri: 'file://data/s', filename: 'solo', title: 'Solo' } }],
        { uniqKeys: ['uri', 'filename'], zombieKey: 'filename' },
      );
      solo.setRoot('s');
      assert.strictEqual((solo.get('s') as Node).phase(), NODE.PHASE.ISOLATE);
    });

  });

  describe('bulk queries (zombies gated out by state)', () => {

    it('phases(); all four cells in one pass', () => {
      assert.deepEqual(wb.phases(), {
        [NODE.PHASE.ISOLATE]: ['4'],
        [NODE.PHASE.ORPHAN]: ['3'],
        [NODE.PHASE.SPUR]: ['1'],
        [NODE.PHASE.INTEGRATED]: ['2'],
      });
    });

    it('phase cell queries; each cell lists exactly its nodes', () => {
      assert.deepEqual(wb.spurs(), ['1']);
      assert.deepEqual(wb.integrated(), ['2']);
      assert.deepEqual(wb.orphans(), ['3']);
      assert.deepEqual(wb.isolates(), ['4']);
    });

    it('phase cell queries; zombies appear in NO cell (even when web-attached)', () => {
      const zombie: Node = wb.add('zzz');
      wb.connect('1', zombie.id, EDGE.KIND.LINK, 'linktype');
      const all: string[] = [
        ...wb.integrated(), ...wb.orphans(), ...wb.spurs(), ...wb.isolates(),
      ];
      assert.strictEqual(all.includes(zombie.id), false);
    });

    it('phase cell queries; payload opt', () => {
      assert.deepEqual(wb.isolates({ payload: QUERY_TYPE.NODEKIND }), [NODE.KIND.DOC]);
    });

  });

  describe('freshness (attachment context evaluates lazily, rides the change events)', () => {

    it('graft; an orphan with family becomes integrated', () => {
      assert.strictEqual(wb.get('3').phase(), NODE.PHASE.ORPHAN);   // warm the indexes
      wb.graft('2', '3');
      assert.strictEqual(wb.get('3').phase(), NODE.PHASE.INTEGRATED);
    });

    it('connect; a spur with a reference becomes integrated', () => {
      const one: Node = wb.get('1');
      assert.strictEqual(one.phase(), NODE.PHASE.SPUR);   // warm
      wb.connect('4', '1', EDGE.KIND.LINK, 'linktype');
      // the SAME node object answers fresh -- state is never stored on it
      assert.strictEqual(one.phase(), NODE.PHASE.INTEGRATED);
    });

    it('disconnect; integrated loses its last reference, back to spur', () => {
      assert.strictEqual(wb.get('2').phase(), NODE.PHASE.INTEGRATED);   // warm
      wb.disconnect('2', '3', EDGE.KIND.LINK, 'linktype');
      assert.strictEqual(wb.get('2').phase(), NODE.PHASE.SPUR);
    });

    it('scoped invalidation; a web-op leaves the tree-attachment index warm', () => {
      wb.get('1').phase();   // warm both
      assert.strictEqual(wb.treeAttachedIndex.dirty, false);
      assert.strictEqual(wb.webAttachedIndex.dirty, false);
      wb.connect('4', '1', EDGE.KIND.LINK, 'linktype');
      assert.strictEqual(wb.treeAttachedIndex.dirty, false);
      assert.strictEqual(wb.webAttachedIndex.dirty, true);
    });

  });

});
