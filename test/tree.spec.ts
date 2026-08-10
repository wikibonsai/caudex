import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import { NODE, QUERY_TYPE } from '../src/const';
import { Node } from '../src/node';
import { createTree } from '../src/tree';


// todo: test 'treeLevel' === -1 for nodes not in the tree.


let data: any;
let bonsai: any;
let fakeConsoleWarn: any;
let stubNanoid: any;

describe('tree', () => {

  beforeEach(() => {
    console.warn = (msg) => msg + '\n';
    fakeConsoleWarn = sinon.spy(console, 'warn');
    stubNanoid = sinon.stub(nanoid, 'nanoid').returns('404');
    data = [
      {
        init: {
          id: '1',
        },
        data: {
          uri: 'file://data/1',
          filename: 'one',
          title: 'One',
        },
      },
      {
        init: {
          id: '2',
        },
        data: {
          uri: 'file://data/2',
          filename: 'two',
          title: 'Two',
        },
      },
      {
        init: {
          id: '3',
        },
        data: {
          uri: 'file://data/3',
          filename: 'three',
          title: 'Three',
        },
      },
      {
        init: {
          id: '4',
        },
        data: {
          uri: 'file://data/4',
          filename: 'four',
          title: 'Four',
        },
      },
      {
        init: {
          id: '5',
        },
        data: {
          uri: 'file://data/5',
          filename: 'five',
          title: 'Five',
        },
      }
    ];
    const opts: any = {
      uniqKeys: ['uri', 'filename'],
      zombieKey: 'filename',
    };
    bonsai = createTree(data, opts);
    // tree-specific setup
    /*
    *    1
    *    |
    *    2 
    *   / \
    *  3   4
    * 
    *    5 <--- orphan
    */
    bonsai.setRoot('1');
    bonsai.graft('1', '2');
    bonsai.graft('2', '3');
    bonsai.graft('2', '4');
  });

  afterEach(() => {
    fakeConsoleWarn.restore();
    stubNanoid.restore();
  });

  describe('init', () => {

    it('base', () => {
      // init-specific setup
      const initData: any = [
        {
          init: {
            id: '1',
          },
          data: {
            uri: 'file://data/1',
            filename: 'one',
            title: 'One',
          },
        },
        {
          init: {
            id: '2',
          },
          data: {
            uri: 'file://data/2',
            filename: 'two',
            title: 'Two',
          },
        },
        {
          init: {
            id: '3',
          },
          data: {
            uri: 'file://data/3',
            filename: 'three',
            title: 'Three',
          },
        }
      ];
      const initOpts =  {
        uniqKeys: ['uri', 'filename']
      };
      const initBonsai: any = createTree(initData, initOpts);
      /*
       *    1
       *    |
       *    2
       *    |
       *    3
       */
      initBonsai.setRoot('1');
      initBonsai.graft('1', '2');
      initBonsai.graft('2', '3');
      // test
      assert.deepEqual(initBonsai.lineage('1'), ['2', '3']);
      assert.deepEqual(initBonsai.lineage('2'), ['1', '3']);
      assert.deepEqual(initBonsai.lineage('3'), ['1', '2']);
    });

  });

  describe('properties', () => {

    // note: 'orphans' moved to the Phase layer (phase.ts) with the 2x2 phase
    // semantics -- see state.spec.ts. Tree(Base) compositions no longer have it.

    describe('ancestors', () => {

      it('node exists; ordered root to target node', () => {
        assert.deepEqual(bonsai.ancestors('1'), []);
        assert.deepEqual(bonsai.ancestors('2'), ['1']);
        assert.deepEqual(bonsai.ancestors('3'), ['1', '2']);
        assert.deepEqual(bonsai.ancestors('4'), ['1', '2']);
      });

      it('node does not exist', () => {
        assert.strictEqual(bonsai.ancestors('-1'), undefined);
      });

      it('with query', () => {
        assert.deepEqual(bonsai.ancestors('1', { payload: ['id', 'uri', 'filename'] }), []);
        assert.deepEqual(bonsai.ancestors('2', { payload: ['id', 'uri', 'filename'] }), [{
          id: '1',
          uri: 'file://data/1',
          filename: 'one'
        }]);
        assert.deepEqual(bonsai.ancestors('3', { payload: ['id', 'uri', 'filename'] }), [
          {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          },
          {
            id: '2',
            uri: 'file://data/2',
            filename: 'two',
          }
        ]);
        assert.deepEqual(bonsai.ancestors('4', { payload: ['id', 'uri', 'filename'] }), [
          {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          },
          {
            id: '2',
            uri: 'file://data/2',
            filename: 'two',
          }
        ]);
      });

    });

    describe('parent', () => {

      it('node exists; return single string', () => {
        assert.strictEqual(bonsai.parent('1'), '');
        assert.strictEqual(bonsai.parent('2'), '1');
        assert.strictEqual(bonsai.parent('3'), '2');
        assert.strictEqual(bonsai.parent('4'), '2');
      });

      it('node does not exist', () => {
        assert.strictEqual(bonsai.parent('-1'), undefined);
      });

      it('with query', () => {
        assert.strictEqual(bonsai.parent('1', { payload: ['id', 'uri', 'filename'] }), '');
        assert.deepEqual(bonsai.parent('2', { payload: ['id', 'uri', 'filename'] }), {
          id: '1',
          uri: 'file://data/1',
          filename: 'one',
        });
        assert.deepEqual(bonsai.parent('3', { payload: ['id', 'uri', 'filename'] }), {
          id: '2',
          uri: 'file://data/2',
          filename: 'two',
        });
        assert.deepEqual(bonsai.parent('4', { payload: ['id', 'uri', 'filename'] }), {
          id: '2',
          uri: 'file://data/2',
          filename: 'two',
        });
      });

    });

    describe('siblings', () => {

      it('node exists', () => {
        assert.deepEqual(bonsai.siblings('1'), []);
        assert.deepEqual(bonsai.siblings('2'), []);
        assert.deepEqual(bonsai.siblings('3'), ['4']);
        assert.deepEqual(bonsai.siblings('4'), ['3']);
      });

      it('node does not exist', () => {
        assert.strictEqual(bonsai.siblings('-1'), undefined);
      });

      it('with query', () => {
        assert.deepEqual(bonsai.siblings('1', { payload: ['id', 'uri', 'filename'] }), []);
        assert.deepEqual(bonsai.siblings('2', { payload: ['id', 'uri', 'filename'] }), []);
        assert.deepEqual(bonsai.siblings('3', { payload: ['id', 'uri', 'filename'] }), [{
          id: '4',
          uri: 'file://data/4',
          filename: 'four',
        }]);
        assert.deepEqual(bonsai.siblings('4', { payload: ['id', 'uri', 'filename'] }), [{
          id: '3',
          uri: 'file://data/3',
          filename: 'three',
        }]);
      });

    });

    describe('children', () => {

      it('node exists', () => {
        assert.deepEqual(bonsai.children('1'), ['2']);
        assert.deepEqual(bonsai.children('2'), ['3', '4']);
        assert.deepEqual(bonsai.children('3'), []);
        assert.deepEqual(bonsai.children('4'), []);
      });

      it('node does not exist', () => {
        assert.strictEqual(bonsai.children('-1'), undefined);
      });

      it('with query', () => {
        assert.deepEqual(bonsai.children('1', { payload: ['id', 'uri', 'filename'] }), [{
          id: '2',
          uri: 'file://data/2',
          filename: 'two',
        }]);
        assert.deepEqual(bonsai.children('2', { payload: ['id', 'uri', 'filename'] }), [
          {
            id: '3',
            uri: 'file://data/3',
            filename: 'three',
          },
          {
            id: '4',
            uri: 'file://data/4',
            filename: 'four',
          }
        ]);
        assert.deepEqual(bonsai.children('3', { payload: ['id', 'uri', 'filename'] }), []);
        assert.deepEqual(bonsai.children('4', { payload: ['id', 'uri', 'filename'] }), []);
      });

    });

    describe('descendants', () => {

      it('node exists; ordered children to leaf', () => {
        assert.deepEqual(bonsai.descendants('1'), ['2', '3', '4']);
        assert.deepEqual(bonsai.descendants('2'), ['3', '4']);
        assert.deepEqual(bonsai.descendants('3'), []);
        assert.deepEqual(bonsai.descendants('4'), []);
      });

      it('node does not exist', () => {
        assert.strictEqual(bonsai.lineage('-1'), undefined);
      });

      it('node exists; ordered children to leaf', () => {
        assert.deepEqual(bonsai.descendants('1', { payload: ['id', 'uri', 'filename'] }), [
          {
            id: '2',
            uri: 'file://data/2',
            filename: 'two',
          },
          {
            id: '3',
            uri: 'file://data/3',
            filename: 'three',
          },
          {
            id: '4',
            uri: 'file://data/4',
            filename: 'four',
          }
        ]);
        assert.deepEqual(bonsai.descendants('2', { payload: ['id', 'uri', 'filename'] }), [
          {
            id: '3',
            uri: 'file://data/3',
            filename: 'three',
          },
          {
            id: '4',
            uri: 'file://data/4',
            filename: 'four',
          }
        ]);
        assert.deepEqual(bonsai.descendants('3', { payload: ['id', 'uri', 'filename'] }), []);
        assert.deepEqual(bonsai.descendants('4', { payload: ['id', 'uri', 'filename'] }), []);
      });

    });

    describe('lineage', () => {

      it('node exists; return both ancestors and descendants, ordered node to leaf, without given node', () => {
        assert.deepEqual(bonsai.lineage('1'), ['2', '3', '4']);
        assert.deepEqual(bonsai.lineage('2'), ['1', '3', '4']);
        assert.deepEqual(bonsai.lineage('3'), ['1', '2']);
        assert.deepEqual(bonsai.lineage('4'), ['1', '2']);
      });

      it('node does not exist', () => {
        assert.strictEqual(bonsai.lineage('-1'), undefined);
      });

      it('with query', () => {
        assert.deepEqual(bonsai.lineage('1', { payload: ['id', 'uri', 'filename'] }), [
          {
            id: '2',
            uri: 'file://data/2',
            filename: 'two',
          },
          {
            id: '3',
            uri: 'file://data/3',
            filename: 'three',
          },
          {
            id: '4',
            uri: 'file://data/4',
            filename: 'four',
          }
        ]);
        assert.deepEqual(bonsai.lineage('2', { payload: ['id', 'uri', 'filename'] }), [
          {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          },
          {
            id: '3',
            uri: 'file://data/3',
            filename: 'three',
          },
          {
            id: '4',
            uri: 'file://data/4',
            filename: 'four',
          }
        ]);
        assert.deepEqual(bonsai.lineage('3', { payload: ['id', 'uri', 'filename'] }), [
          {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          },
          {
            id: '2',
            uri: 'file://data/2',
            filename: 'two',
          },
        ]);
        assert.deepEqual(bonsai.lineage('4', { payload: ['id', 'uri', 'filename'] }), [
          {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          },
          {
            id: '2',
            uri: 'file://data/2',
            filename: 'two',
          }
        ]);
      });

    });

    describe('level (in tree)', () => {

      it('node exists', () => {
        assert.deepEqual(bonsai.level('1'), 0);
        assert.deepEqual(bonsai.level('2'), 1);
        assert.deepEqual(bonsai.level('3'), 2);
        assert.deepEqual(bonsai.level('4'), 2);
      });

      it('node does not exist', () => {
        assert.strictEqual(bonsai.level('-1'), undefined);
      });

    });

    describe('query opts', () => {

      describe('filter', () => {

        it('ancestors with filter: relation list is not filtered; full ancestors returned', () => {
          // Tree methods do not apply filter to the relation ID list; filter is only passed through to get().
          assert.deepEqual(bonsai.ancestors('4'), ['1', '2']);
          const withFilter = bonsai.ancestors('4', { filter: { filename: 'one' } });
          assert.deepEqual(withFilter, ['1', '2'], 'filter does not restrict relation list; both ancestors returned');
        });

        it('root with filter: filter is ignored; same root returned', () => {
          assert.strictEqual(bonsai.root(), '1');
          const withFilter = bonsai.root({ filter: { filename: 'two' } });
          assert.strictEqual(typeof withFilter === 'object' ? (withFilter as Node).id : withFilter, '1', 'filter ignored; same root');
        });

        it('parent with filter: filter is ignored; same parent returned', () => {
          assert.strictEqual(bonsai.parent('2'), '1');
          assert.strictEqual(bonsai.parent('2', { filter: { nodeType: NODE.TYPE.ENTRY } }), '1', 'filter ignored');
        });

        it('siblings with filter: relation list is not filtered; full siblings returned', () => {
          assert.deepEqual(bonsai.siblings('3'), ['4']);
          const withFilter = bonsai.siblings('3', { filter: { filename: 'four' } });
          assert.deepEqual(withFilter, ['4'], 'filter does not restrict relation list');
        });

        it('children with filter: relation list is not filtered; full children returned', () => {
          assert.deepEqual(bonsai.children('2'), ['3', '4']);
          const withFilter = bonsai.children('2', { filter: { filename: 'three' } });
          assert.deepEqual(withFilter, ['3', '4'], 'filter does not restrict relation list; both children returned');
        });

        it('descendants with filter: relation list is not filtered; full descendants returned', () => {
          assert.deepEqual(bonsai.descendants('1'), ['2', '3', '4']);
          const withFilter = bonsai.descendants('1', { filter: { filename: 'two' } }) as string[];
          assert.strictEqual(withFilter.length, 3, 'filter does not restrict relation list');
        });

        it('lineage with filter: relation list is not filtered; full lineage returned', () => {
          const noFilter = bonsai.lineage('3') as string[];
          const withFilter = bonsai.lineage('3', { filter: { filename: 'one' } }) as string[];
          assert.deepEqual(withFilter, noFilter, 'filter does not restrict relation list');
        });

      });

      describe('payload', () => {

        it('ancestors with payload nodekind', () => {
          assert.deepEqual(bonsai.ancestors('4', { payload: QUERY_TYPE.NODEKIND }), [NODE.KIND.DOC, NODE.KIND.DOC]);
        });

        it('ancestors with payload nodetype', () => {
          assert.deepEqual(bonsai.ancestors('4', { payload: QUERY_TYPE.NODETYPE }), [NODE.TYPE.DEFAULT, NODE.TYPE.DEFAULT]);
        });

        it('ancestors with payload data', () => {
          const out = bonsai.ancestors('4', { payload: QUERY_TYPE.DATA }) as any[];
          assert.strictEqual(out.length, 2);
          assert.deepEqual(out[0], { uri: 'file://data/1', filename: 'one', title: 'One' });
          assert.deepEqual(out[1], { uri: 'file://data/2', filename: 'two', title: 'Two' });
        });

        it('children with payload single key', () => {
          assert.deepEqual(bonsai.children('1', { payload: 'filename' }), ['two']);
          assert.deepEqual(bonsai.children('2', { payload: 'filename' }), ['three', 'four']);
        });

        it('parent with payload data', () => {
          assert.deepEqual(bonsai.parent('2', { payload: QUERY_TYPE.DATA }), {
            uri: 'file://data/1',
            filename: 'one',
            title: 'One',
          });
        });

        it('lineage with payload string[]', () => {
          const out = bonsai.lineage('3', { payload: ['id', 'filename'] }) as any[];
          const ids = out.map((o: any) => o.id).sort();
          assert.ok(ids.length >= 2);
          assert.ok(ids.includes('1') && ids.includes('2'));
        });

      });

      describe('tree method payloads', () => {

        it('root payload node', () => {
          const out = bonsai.root({ payload: QUERY_TYPE.NODE }) as Node;
          assert.ok(out && out.id === '1' && out.data);
        });

        it('root payload filename', () => {
          assert.strictEqual(bonsai.root({ payload: 'filename' }), 'one');
        });

        it('parent payload node', () => {
          const out = bonsai.parent('2', { payload: QUERY_TYPE.NODE }) as Node;
          assert.ok(out && out.id === '1');
        });

        it('parent payload filename', () => {
          assert.strictEqual(bonsai.parent('2', { payload: 'filename' }), 'one');
        });

        it('children payload node', () => {
          const out = bonsai.children('1', { payload: QUERY_TYPE.NODE }) as Node[];
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].id, '2');
        });

        it('children payload filename', () => {
          assert.deepEqual(bonsai.children('2', { payload: 'filename' }), ['three', 'four']);
        });

        it('siblings payload node', () => {
          const out = bonsai.siblings('3', { payload: QUERY_TYPE.NODE }) as Node[];
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].id, '4');
        });

        it('ancestors payload node', () => {
          const out = bonsai.ancestors('4', { payload: QUERY_TYPE.NODE }) as Node[];
          assert.strictEqual(out.length, 2);
          assert.strictEqual(out[0].id, '1');
          assert.strictEqual(out[1].id, '2');
        });

        it('ancestors payload filename', () => {
          assert.deepEqual(bonsai.ancestors('4', { payload: 'filename' }), ['one', 'two']);
        });

        it('descendants payload node', () => {
          const out = bonsai.descendants('1', { payload: QUERY_TYPE.NODE }) as Node[];
          assert.strictEqual(out.length, 3);
          assert.ok(out.some((n: Node) => n.id === '2') && out.some((n: Node) => n.id === '3') && out.some((n: Node) => n.id === '4'));
        });

        it('lineage payload node', () => {
          const out = bonsai.lineage('3', { payload: QUERY_TYPE.NODE }) as Node[];
          assert.ok(out.length >= 2);
          assert.ok(out.some((n: Node) => n.id === '1') && out.some((n: Node) => n.id === '2'));
        });

      });

      describe('tree method filters', () => {

        it('children with filter returns full list; filter not applied', () => {
          bonsai.index['2'].type = 'entry';
          bonsai.index['3'].type = 'entry';
          bonsai.index['4'].type = 'index';
          const out = bonsai.children('2', { filter: { nodeType: 'entry' } }) as string[];
          assert.strictEqual(out.length, 2, 'filter does not restrict relation list; both children returned');
          assert.ok(out.includes('3') && out.includes('4'));
        });

        it('descendants with filter returns full list; filter not applied', () => {
          bonsai.index['2'].type = 'entry';
          bonsai.index['3'].type = 'index';
          bonsai.index['4'].type = 'entry';
          const out = bonsai.descendants('1', { filter: { nodeType: 'entry' } }) as string[];
          assert.strictEqual(out.length, 3, 'filter does not restrict relation list');
        });

        it('ancestors with filter returns full list; filter not applied', () => {
          bonsai.index['1'].type = 'entry';
          bonsai.index['2'].type = 'index';
          const out = bonsai.ancestors('4', { filter: { nodeKind: NODE.KIND.DOC } }) as string[];
          assert.deepEqual(out, ['1', '2'], 'filter does not restrict relation list');
        });

        it('children ignores filter header', () => {
          const unfiltered = bonsai.children('2');
          const withHeader = bonsai.children('2', { filter: { header: 'x' } });
          assert.deepEqual(withHeader, unfiltered, 'filter.header ignored; same result as unfiltered');
        });

      });

    });

  });

  describe('methods', () => {

    describe('root lvl', () => {

      describe('setRoot()', () => {

        it('node exists', () => {
          assert.deepEqual(bonsai.setRoot('1'), true);
        });

        it('node does not exist', () => {
          assert.deepEqual(bonsai.setRoot('-1'), false);
        });

      });
    
      describe('root()', () => {

        it('root set', () => {
          assert.deepEqual(bonsai.root(), '1');
          assert.deepEqual(bonsai.root({ payload: QUERY_TYPE.NODE }), {
            id: '1',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              filename: 'one',
              title: 'One',
              uri: 'file://data/1'
            },
            attrs: {},
            children: ['2'],
            links: [],
            embeds: [],
          });
        });

        it('root not set', () => {
          // setup
          const smallItem = [
            {
              init: {
                id: '1',
              },
              data: {
                uri: 'file://data/1',
                filename: 'one',
                title: 'One',
              },
            }
          ];
          const errorBonsai = createTree(smallItem);
          assert.strictEqual(errorBonsai.root(), undefined);
        });

      });

    });

    describe('node lvl', () => {

      describe('graft()', () => {

        it('node exists; success', () => {
          /*
           *    1
           *    |
           *    2 
           *   / \
           *  3   4
           *       \
           *        5 <-- graft / insert
           */
          assert.deepEqual(bonsai.graft('4', '5'), true);
          // parent
          assert.deepEqual(bonsai.children('4'), ['5']);
          assert.deepEqual(bonsai.lineage('4'), ['1', '2', '5']);
          // child
          assert.deepEqual(bonsai.parent('5'), '4');
          assert.deepEqual(bonsai.ancestors('5'), ['1', '2', '4']);
          assert.deepEqual(bonsai.lineage('5'), ['1', '2', '4']);
        });

        it('node exists; already in tree (above); do not graft', () => {
          /*
           *    1
           *    |
           *    2 <----- already exists
           *   / \
           *  3   4
           *       \
           *        2 <-- do not graft / insert
           */
          // before
          assert.deepEqual(bonsai.children('1'), ['2']);
          assert.deepEqual(bonsai.lineage('4'), ['1', '2']);
          // go
          assert.deepEqual(bonsai.graft('4', '2'), false);
          // after
          assert.deepEqual(bonsai.children('1'), ['2']);
          assert.deepEqual(bonsai.lineage('4'), ['1', '2']);
        });

        it('node exists; already in tree (below); do not graft', () => {
          /*
           *    1
           *    |
           *    4 <-- do not graft / insert
           *    |
           *    2
           *   / \
           *  3   4 <----- already exists
           *
           */
          // before
          assert.deepEqual(bonsai.children('1'), ['2']);
          assert.deepEqual(bonsai.lineage('4'), ['1', '2']);
          // go
          assert.deepEqual(bonsai.graft('1', '4'), false);
          // after
          assert.deepEqual(bonsai.children('1'), ['2']);
          assert.deepEqual(bonsai.lineage('4'), ['1', '2']);
        });


        it('error; parent node does not exist; do not graft', () => {
          // before
          assert.deepEqual(bonsai.children('1'), ['2']);
          // go
          assert.deepEqual(bonsai.graft('-1', '1'), false);
          // after
          assert.deepEqual(bonsai.children('1'), ['2']);
        });

        it('error; child node does not exist; do not graft', () => {
          // before
          assert.deepEqual(bonsai.children('1'), ['2']);
          // go
          assert.deepEqual(bonsai.graft('1', '-1'), false);
          // after
          assert.deepEqual(bonsai.children('1'), ['2']);
        });

      });

      describe('replace()', () => {

        it('nodes exists', () => {
        /*
         *    1
         *    |
         *    2   <-- replace with '5', then '2' should be an orphan
         *   / \
         *  3   4
         */
          // setup
          const testSourceNode: Node | undefined = bonsai.get('2'); // mid-node
          const testTargetNode: Node | undefined = bonsai.get('5'); // unattached
          // pretest
          if (!testSourceNode) { assert.fail(); }
          if (!testTargetNode) { assert.fail(); }
          assert.deepEqual(bonsai.parent(testTargetNode.id), '');
          assert.deepEqual(testTargetNode.children, []);
          assert.deepEqual(bonsai.parent(testSourceNode.id), '1');
          assert.deepEqual(testSourceNode.children, ['3', '4']);
          // exec
          assert.deepEqual(bonsai.replace(testSourceNode.id, testTargetNode.id), true);
          // test
          const replacedNode: Node | undefined = bonsai.get('5');
          if (!replacedNode) { assert.fail(); }
          assert.deepEqual(testSourceNode.children, []);
          assert.deepEqual(bonsai.parent(testSourceNode.id), '');
          assert.deepEqual(bonsai.parent(replacedNode.id), '1');
          assert.deepEqual(replacedNode.children, ['3', '4']);
        });

        it('target node cannot already exist in tree', () => {
          // test
          assert.strictEqual(bonsai.replace('2', '1'), false);
          // after
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'target with "id" "1" already exists in tree');
        });

        it('source node does not exist', () => {
          // test
          assert.strictEqual(bonsai.replace('-1', '1'), false);
          // after
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with id "-1" does not exist');
        });

        it('target node does not exist', () => {
          // test
          assert.strictEqual(bonsai.replace('1', '-1'), false);
          // after
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with id "-1" does not exist');
        });

      });

      describe('transplant()', () => {

        it('nodes exists', () => {
          /*
           * before:
           *    1
           *    |
           *    2 
           *   / \
           *  3   4
           * 
           *    2          5
           *   / \  -->  / | \
           *  3   4     2  3  4
           *
           * after:
           *     1
           *     |
           *     5 
           *   / | \
           *  2  3  4
           */
          // before
          assert.deepStrictEqual(bonsai.get('1').children, ['2']);
          assert.deepStrictEqual(bonsai.get('2').children, ['3', '4']);
          assert.deepStrictEqual(bonsai.get('5').children, []);
          // go
          const subtree: any = [
            { id: '1', children: ['5'] },
            { id: '5', children: ['2', '3', '4'] },
            { id: '2', children: [] },
            { id: '3', children: [] },
            { id: '4', children: [] }
          ];
          assert.strictEqual(bonsai.transplant('1', subtree), true);
          // after
          assert.deepStrictEqual(bonsai.get('1').children, ['5']);
          assert.deepStrictEqual(bonsai.get('5').children, ['2', '3', '4']);
          assert.deepStrictEqual(bonsai.get('2').children, []);
          assert.deepStrictEqual(bonsai.get('3').children, []);
          assert.deepStrictEqual(bonsai.get('4').children, []);
        });

        it('invalidates the parent index (a warm parent() answers fresh after transplant)', () => {
          /*
           *    2          2
           *   / \  -->    |
           *  3   4        4
           *               |
           *               3
           */
          // warm the parent index before transplanting
          assert.strictEqual(bonsai.parent('3'), '2');
          const subtree: any = [
            { id: '2', children: ['4'] },
            { id: '4', children: ['3'] },
            { id: '3', children: [] },
          ];
          assert.strictEqual(bonsai.transplant('2', subtree), true);
          assert.strictEqual(bonsai.parent('3'), '4');
        });

        it('invalid; subroot not included in subtree', () => {
          // before
          assert.deepStrictEqual(bonsai.get('1').children, ['2']);
          // go
          const subtree: any = [{ id: '5', children: ['2'] }];
          assert.strictEqual(bonsai.transplant('1', subtree), false);
          // after
          assert.deepStrictEqual(bonsai.get('1').children, ['2']);
          assert.strictEqual(fakeConsoleWarn.calledWith('subroot with id "1" not found in the subtree'), true);
        });

        it('subtree invalid; subroot does not exist', () => {
          // before
          assert.strictEqual(bonsai.has('5'), true);
          assert.strictEqual(bonsai.has('6'), false);
          // go
          const subtree: any = [{ id: '6', children: ['5'] }];
          assert.strictEqual(bonsai.transplant('6', subtree), false);
          // after
          assert.strictEqual(bonsai.has('6'), false);
          assert.strictEqual(fakeConsoleWarn.calledWith('subroot with id "6" not found in the index'), true);
        });

        it('subtree invalid; cycle created; rollback', () => {
          /*
           * before:
           *    1
           *    |
           *    2 
           *   / \
           *  3   4
           * 
           *    2          2
           *   / \  -->  /   \
           *  3   4     3     1 <-- duplicate node (same as root) should trigger rollback
           *
           * after:
           *    1
           *    |
           *    2 
           *   / \
           *  3   4
           */
          // before
          assert.deepStrictEqual(bonsai.get('2').children, ['3', '4']);
          // go
          const subtree: any = [
            { id: '2', children: ['3', '1'] }
          ];
          bonsai.transplant('2', subtree);
          // assert.strictEqual(bonsai.transplant('2', subtree), false);
          // after
          assert.deepStrictEqual(bonsai.get('1').children, ['2']);
          assert.deepStrictEqual(bonsai.get('2').children, ['3', '4']);
          assert.strictEqual(fakeConsoleWarn.calledWith('node with id "1" already visited'), true);
        });

      });

      describe('prune()', () => {

        it('leaf node; node exists; parent exists', () => {
          /*
          *    1
          *    |
          *    2 
          *   / \
          *  3   4 <-- prune / remove
          */
          assert.deepEqual(bonsai.prune('2', '4'), true);
          // parent
          assert.deepEqual(bonsai.children('2'), ['3']);
          // (now orphaned) child
          assert.deepEqual(bonsai.lineage('4'), []);
          // original node still in index
          assert.deepEqual(bonsai.get('4'), {
            id: '4',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              uri: 'file://data/4',
              filename: 'four',
              title: 'Four',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          });
        });

        it('leaf node; node exists; parent exists; has zombie parent', () => {
          /*
          *    1
          *    |
          *    2 
          *   / \
          *  3   4
          *       \
          *      (404)
          *         \
          *          5 <-- prune / remove
          */
          // setup
          const fourNode: Node | undefined = bonsai.get('4');
          const zombieNode: Node | undefined = bonsai.add('braaains');
          const fiveNode: Node | undefined = bonsai.get('5');
          if (!fourNode) { assert.fail(); }
          if (!zombieNode) { assert.fail(); }
          if (!fiveNode) { assert.fail(); }
          fourNode.children.push(zombieNode.id);
          zombieNode.children.push(fiveNode.id);
          assert.deepEqual(bonsai.prune('404', '5'), true);
          // parent
          assert.deepEqual(bonsai.children('404'), []);
          // (now orphaned) child
          assert.deepEqual(bonsai.lineage('5'), []);
          // original node still in index
          assert.deepEqual(bonsai.get('5'), {
            id: '5',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              uri: 'file://data/5',
              filename: 'five',
              title: 'Five',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          });
        });

        it('error; branch node', () => {
          /*    1
           *    |
           *    2 <-- attempt prune / remove
           *   / \
           *  3   4
           */
          assert.deepEqual(bonsai.prune('1', '2'), false);
          // parent
          assert.deepEqual(bonsai.children('1'), ['2']);
          // child
          assert.deepEqual(bonsai.lineage('2'), ['1', '3', '4']);
        });

        it('error; self node', () => {
          /*    1 <-- attempt prune / remove to self
           *    |
           *    2
           *   / \
           *  3   4
           */
          assert.deepEqual(bonsai.prune('1', '1'), false);
          assert.deepEqual(bonsai.lineage('1'), ['2', '3', '4']);
        });

        it('error; node does not exist; do not prune', () => {
          // before
          assert.deepEqual(bonsai.children('1'), ['2']);
          bonsai.prune('-1', ['one'], 'filename');
          // after
          assert.deepEqual(bonsai.children('1'), ['2']);
        });

      });

    });

    describe('tree lvl', () => {

      describe('flushTree()', () => {

        it('clears tree relationship refs', () => {
          // setup
          const testNode1: Node | undefined = bonsai.get('1');
          const testNode2: Node | undefined = bonsai.get('2');
          // pretest
          if (!testNode1) { assert.fail(); }
          if (!testNode2) { assert.fail(); }
          assert.deepEqual(testNode1.children, ['2']);
          assert.deepEqual(testNode2.children, ['3', '4']);
          // exec
          assert.strictEqual(bonsai.flushTree(), true);
          // test
          assert.deepEqual(testNode1.children, []);
          assert.deepEqual(testNode2.children, []);
        });
  
      });

      describe('isTree()', () => {

        it('valid tree', () => {
          assert.strictEqual(bonsai.isTree(), true);
        });

        it('valid tree; orphan nodes', () => {
          // go
          assert.strictEqual(bonsai.isTree(), true);
          // after
          const orphanNode: Node | undefined = bonsai.get('5');
          assert.strictEqual(orphanNode !== undefined, true);
          assert.strictEqual(bonsai.parent('5'), '');
        });
    
        it('valid tree; larger tree', () => {
          // before
          for (let i = 6; i <= 20; i++) {
            bonsai.add({
              init: { id: i.toString() },
              data: { uri: `file://data/${i}`, filename: `file${i}`, title: `Title ${i}` }
            });
            bonsai.graft((i-1).toString(), i.toString());
          }
          // go
          assert.strictEqual(bonsai.isTree(), true);
        });

        it('invalid tree; empty tree', () => {
          // before
          const emptyBonsai = createTree([], {});
          // go
          assert.strictEqual(emptyBonsai.isTree(), false);
        });

        it('invalid tree; cycle', () => {
          const cyclicTree = createTree([
            { init: { id: '1' }, data: { filename: 'one' } },
            { init: { id: '2' }, data: { filename: 'two' } },
            { init: { id: '3' }, data: { filename: 'three' } },
          ]);
          cyclicTree.setRoot('1');
          cyclicTree.graft('1', '2');
          cyclicTree.graft('2', '3');
          // create a cycle
          cyclicTree.get('3')?.children.push('1');
          // go
          assert.strictEqual(cyclicTree.isTree(), false);
          // after
          assert.strictEqual(fakeConsoleWarn.calledWith('node with id "1" already visited'), true);
        });
    
        it('invalid tree; duplicate nodes', () => {
          const duplicateTree = createTree([
            { init: { id: '1' }, data: { filename: 'one' } },
            { init: { id: '2' }, data: { filename: 'two' } },
          ]);
          duplicateTree.setRoot('1');
          duplicateTree.graft('1', '2');
          // add a duplicate reference
          duplicateTree.get('1')?.children.push('2');
          // go
          assert.strictEqual(duplicateTree.isTree(), false);
          // after
          assert.strictEqual(fakeConsoleWarn.calledWith('node with id "2" already visited'), true);
        });

        it('invalid tree; missing nodes', () => {
          const missingNodeTree = createTree([
            { init: { id: '1' }, data: { filename: 'one' } },
          ]);
          missingNodeTree.setRoot('1');
          // add a non-existent node
          missingNodeTree.get('1')?.children.push('2');
          // go
          assert.strictEqual(missingNodeTree.isTree(), false);
          // after
          assert.strictEqual(fakeConsoleWarn.calledWith('node with id "2" not found'), true);
        });

      });

      describe('printTree()', () => {

        let consoleOutput: string;
        let originalLog: (message?: any, ...optionalParams: any[]) => void;

        beforeEach(() => {
          originalLog = console.log;
          consoleOutput = '';
          console.log = (msg: string) => { consoleOutput += msg + '\n'; };
        });

        afterEach(() => {
          // Restore the original console.log after each test
          console.log = originalLog;
        });

        it('default', () => {
          // setup
          const treeBonsai = createTree([
            { init: { id: 'A' }, data: { title: 'Root' } },
            { init: { id: 'B' }, data: { title: 'Child 1' } },
            { init: { id: 'C' }, data: { title: 'Child 2' } },
            { init: { id: 'D' }, data: { title: 'Grandchild 1' } },
            { init: { id: 'E' }, data: { title: 'Grandchild 2' } },
          ]);
          treeBonsai.setRoot('A');
          treeBonsai.graft('A', 'B');
          treeBonsai.graft('A', 'C');
          treeBonsai.graft('B', 'D');
          treeBonsai.graft('B', 'E');
          const expectedOutput = 
            'A: "Root"\n' +
            '├── B: "Child 1"\n' +
            '│   ├── D: "Grandchild 1"\n' +
            '│   └── E: "Grandchild 2"\n' +
            '└── C: "Child 2"\n';
          // go
          const result = treeBonsai.printTree('title');
          // assert
          assert.strictEqual(result, expectedOutput);
          assert.strictEqual(consoleOutput, expectedOutput + '\n');
        });

        it('missing data', () => {
          // setup
          const missingDataBonsai = createTree([
            { init: { id: 'A' }, data: { title: 'Root' } },
            { init: { id: 'B' }, data: {} },  // Missing title
            { init: { id: 'C' }, data: { title: 'Child 2' } },
          ]);
          missingDataBonsai.setRoot('A');
          missingDataBonsai.graft('A', 'B');
          missingDataBonsai.graft('A', 'C');
          const expectedOutput = 
          'A: "Root"\n' +
          '├── B: node not found\n' +
          '└── C: "Child 2"\n';
          // go
          const result = missingDataBonsai.printTree('title', false);  // Don't print to console
          // assert
          assert.strictEqual(result, expectedOutput);
        });

        it('error; root undefined', () => {
          // go
          const emptyBonsai = createTree([]);
          // assert
          assert.throws(() => {
            emptyBonsai.printTree('title');
          }, Error, 'root undefined');
        });
      });

    });

  });

});
