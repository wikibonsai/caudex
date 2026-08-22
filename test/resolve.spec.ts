import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import { create, Node, NODE, QUERY_TYPE } from '../src/index';


// resolve() -- THE identity query: name -> node, walking the configured
// uniqKeys in priority order (first match wins). returns the node REGARDLESS
// of state -- callers read 'node.state()'; 'undefined' = no node behind the
// name.
//
// state(name) -- resolve's semantic companion: the name-based existence check,
// the full TERMS lifecycle in one answer (void -> zombie -> live). the ONE
// place 'void' is produced: no node ever holds it (state derives on nodes;
// the absence of a node IS the answer). tested here as the DELTA over
// resolve() + 'node.state()' (mechanics live in 'state.spec.ts').

let data: any;
let wb: any;
let fakeConsoleWarn: any;
let stubNanoid: any;

describe('resolve & state(name)', () => {

  beforeEach(() => {
    console.warn = (msg) => msg + '\n';
    fakeConsoleWarn = sinon.spy(console, 'warn');
    stubNanoid = sinon.stub(nanoid, 'nanoid').returns('404');
    data = [
      { init: { id: '1' }, data: { uri: 'file://data/1', filename: 'one', title: 'One' } },
      { init: { id: '2' }, data: { uri: 'file://data/2', filename: 'two', title: 'Two' } },
    ];
    wb = create(data, { uniqKeys: ['uri', 'filename'], zombieKey: 'filename' });
    wb.add('zzz'); // zombie: referenced, no doc behind it
  });

  afterEach(() => {
    fakeConsoleWarn.restore();
    stubNanoid.restore();
  });

  describe('resolve()', () => {

    it('live; resolves a filename to its node', () => {
      const node: Node | undefined = wb.resolve('one');
      assert.strictEqual(node?.id, '1');
      assert.strictEqual(node?.state(), NODE.STATE.LIVE);
    });

    it('zombie; resolves to the zombie node (caller reads state)', () => {
      const node: Node | undefined = wb.resolve('zzz');
      assert.notStrictEqual(node, undefined);
      assert.strictEqual(node?.state(), NODE.STATE.ZOMBIE);
    });

    it('void; no node behind the name -> undefined', () => {
      assert.strictEqual(wb.resolve('no-such-name'), undefined);
    });

    it('identity walks uniqKeys in priority order (uri key hits too)', () => {
      const node: Node | undefined = wb.resolve('file://data/2');
      assert.strictEqual(node?.id, '2');
    });

    it('payload opt rides QueryOpts (misses stay undefined -- state(name) is the semantic answer)', () => {
      assert.strictEqual(wb.resolve('one', { payload: QUERY_TYPE.ID }), '1');
      assert.strictEqual(wb.resolve('no-such-name', { payload: QUERY_TYPE.NODESTATE }), undefined);
    });

  });

  describe('state(name) (void -> zombie -> live)', () => {

    it('delegates to node.state() for resolved names', () => {
      assert.strictEqual(wb.state('one'), NODE.STATE.LIVE);
      assert.strictEqual(wb.state('zzz'), NODE.STATE.ZOMBIE);
    });

    it('void; NODE.STATE.VOID -- the query-boundary answer', () => {
      assert.strictEqual(wb.state('no-such-name'), NODE.STATE.VOID);
      assert.strictEqual(NODE.STATE.VOID, 'void');
    });

  });

});
