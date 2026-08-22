import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import { create, Node, NODE, QUERY_TYPE, EDGE } from '../src/index';


// node state -- fully DERIVED, never stored:
//
//   'node.state(): NODE.STATE' -- whether the document EXISTS (zombie ->
//     live), derived from kind-absence. Graph-free.
//
// (the integration phase 'node.phase()' lives in 'phase.spec.ts'; the
// name-based existence check 'caudex.state(name)' -- where 'void' appears --
// lives in 'resolve.spec.ts'.)
//
// fixture:
//   tree: 1 -> 2          web: 2 -> 3 (link)
//   4: unconnected        z ('zzz'): zombie via add(string)
//   (the web link keeps '3' referenced, so rm('3') zombifies instead of deleting)

let data: any;
let wb: any;
let fakeConsoleWarn: any;
let stubNanoid: any;

describe('node state (derived; zombie -> live)', () => {

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
