import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import { NODE } from '../src/const';
import { Node } from '../src/node';
import { Base } from '../src/base';
import { Tree } from '../src/tree';


// todo: test 'treeLevel' === -1 for nodes not in the tree.

const Bonsai = Tree(Base);
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
    bonsai = new Bonsai(data, opts);
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
    bonsai.graft('2', ['one'], 'filename');
    bonsai.graft('3', ['one', 'two'], 'filename');
    bonsai.graft('4', ['one', 'two'], 'filename');
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
      const initBonsai: any = new Bonsai(initData, initOpts);
      /*
       *    1
       *    |
       *    2
       *    |
       *    3
       */
      initBonsai.setRoot('1');
      initBonsai.graft('2', ['one'], 'filename');
      initBonsai.graft('3', ['one', 'two'], 'filename');
      // test
      assert.deepEqual(initBonsai.lineage('1'), ['2', '3']);
      assert.deepEqual(initBonsai.lineage('2'), ['1', '3']);
      assert.deepEqual(initBonsai.lineage('3'), ['1', '2']);
    });

  });

  describe('properties', () => {

    describe('orphans', () => {

      it('index has orphans', () => {
        assert.deepEqual(bonsai.orphans(bonsai.all('id')), ['5']);
      });

      it('index has no orphans', () => {
        bonsai.rm('5');
        assert.deepEqual(bonsai.orphans(bonsai.all('id')), []);
      });

      it('with query', () => {
        assert.deepEqual(bonsai.orphans(bonsai.all('id'), 'node'), [{
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
        }]);
      });

    });

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
        assert.deepEqual(bonsai.ancestors('1', ['id', 'uri', 'filename']), []);
        assert.deepEqual(bonsai.ancestors('2', ['id', 'uri', 'filename']), [{
          id: '1',
          uri: 'file://data/1',
          filename: 'one'
        }]);
        assert.deepEqual(bonsai.ancestors('3', ['id', 'uri', 'filename']), [
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
        assert.deepEqual(bonsai.ancestors('4', ['id', 'uri', 'filename']), [
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
        assert.strictEqual(bonsai.parent('1', ['id', 'uri', 'filename']), '');
        assert.deepEqual(bonsai.parent('2', ['id', 'uri', 'filename']), {
          id: '1',
          uri: 'file://data/1',
          filename: 'one',
        });
        assert.deepEqual(bonsai.parent('3', ['id', 'uri', 'filename']), {
          id: '2',
          uri: 'file://data/2',
          filename: 'two',
        });
        assert.deepEqual(bonsai.parent('4', ['id', 'uri', 'filename']), {
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
        assert.deepEqual(bonsai.siblings('1', ['id', 'uri', 'filename']), []);
        assert.deepEqual(bonsai.siblings('2', ['id', 'uri', 'filename']), []);
        assert.deepEqual(bonsai.siblings('3', ['id', 'uri', 'filename']), [{
          id: '4',
          uri: 'file://data/4',
          filename: 'four',
        }]);
        assert.deepEqual(bonsai.siblings('4', ['id', 'uri', 'filename']), [{
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
        assert.deepEqual(bonsai.children('1', ['id', 'uri', 'filename']), [{
          id: '2',
          uri: 'file://data/2',
          filename: 'two',
        }]);
        assert.deepEqual(bonsai.children('2', ['id', 'uri', 'filename']), [
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
        assert.deepEqual(bonsai.children('3', ['id', 'uri', 'filename']), []);
        assert.deepEqual(bonsai.children('4', ['id', 'uri', 'filename']), []);
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
        assert.deepEqual(bonsai.descendants('1', ['id', 'uri', 'filename']), [
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
        assert.deepEqual(bonsai.descendants('2', ['id', 'uri', 'filename']), [
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
        assert.deepEqual(bonsai.descendants('3', ['id', 'uri', 'filename']), []);
        assert.deepEqual(bonsai.descendants('4', ['id', 'uri', 'filename']), []);
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
        assert.deepEqual(bonsai.lineage('1', ['id', 'uri', 'filename']), [
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
        assert.deepEqual(bonsai.lineage('2', ['id', 'uri', 'filename']), [
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
        assert.deepEqual(bonsai.lineage('3', ['id', 'uri', 'filename']), [
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
        assert.deepEqual(bonsai.lineage('4', ['id', 'uri', 'filename']), [
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
          assert.deepEqual(bonsai.root('node'), {
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
          const errorBonsai = new Bonsai(smallItem);
          assert.strictEqual(errorBonsai.root(), undefined);
        });

      });

    });

    describe('flushRelFams()', () => {

      it(NODE.TYPE.DEFAULT, () => {
        // setup
        const testNode1: Node | undefined = bonsai.get('1');
        const testNode2: Node | undefined = bonsai.get('2');
        // pretest
        if (!testNode1) { assert.fail(); }
        if (!testNode2) { assert.fail(); }
        assert.deepEqual(testNode1.children, ['2']);
        assert.deepEqual(testNode2.children, ['3', '4']);
        // exec
        assert.strictEqual(bonsai.flushRelFams(), true);
        // test
        assert.deepEqual(testNode1.children, []);
        assert.deepEqual(testNode2.children, []);
      });

    });

    describe('node lvl', () => {

      describe('graft()', () => {

        it('node exists; full path already populated', () => {
        /*
          *    1
          *    |
          *    2 
          *   / \
          *  3   4
          *       \
          *        5 <-- graft / insert
          */
          // read as: graft node with id '5' via the path defined by node 'filename's with the given path 'One', 'Two', and 'Four'.
          assert.deepEqual(bonsai.graft('5', ['one', 'two', 'four'], 'filename'), true);
          // parent
          assert.deepEqual(bonsai.children('4'), ['5']);
          assert.deepEqual(bonsai.lineage('4'), ['1', '2', '5']);
          // child
          assert.deepEqual(bonsai.parent('5'), '4');
          assert.deepEqual(bonsai.ancestors('5'), ['1', '2', '4']);
          assert.deepEqual(bonsai.lineage('5'), ['1', '2', '4']);
        });

        it('node exists; full path not (yet) populated', () => {
        /*
          *    1
          *    |
          *    2 
          *   / \
          *  3   4
          *       \
          *       ( )  <-- missing node, which is populated with an id
          *         \
          *          5 <-- graft / insert
          */
          // read as: graft node with id '5' via the path defined by node 'filename's with the given path 'One', 'Two', 'Four', and 'Missing'.
          assert.deepEqual(bonsai.graft('5', ['one', 'two', 'four', 'missing'], 'filename'), true);
          // parent
          assert.deepEqual(bonsai.children('4'), ['404']);
          assert.deepEqual(bonsai.lineage('4'), ['1', '2', '404', '5']);
          // missing
          assert.deepEqual(bonsai.get('404'), {
            id: '404',
            kind: NODE.KIND.ZOMBIE,
            type: undefined,
            data: {
              filename: 'missing',
            },
            children: ['5'],
            attrs: {},
            links: [],
            embeds: [],
          });
          // child
          assert.deepEqual(bonsai.parent('5'), '404');
          assert.deepEqual(bonsai.ancestors('5'), ['1', '2', '4', '404']);
          assert.deepEqual(bonsai.lineage('5'), ['1', '2', '4', '404']);
        });

        // todo
        it('missing node; fill in data of missing node', () => {
          /*
          *    1
          *    |
          *    2 
          *   / \
          *  3   4
          *       \
          *      (404) <-- graft / insert missing node
          *         \
          *          5
          */
          // read as: graft node with id '5' via the path defined by node 'filename's with the given path 'One', 'Two', 'Four', and 'Missing'.
          assert.deepEqual(bonsai.graft('5', ['one', 'two', 'four', 'missing'], 'filename'), true);
          // before
          assert.deepEqual(bonsai.get('404'), {
            id: '404',
            kind: NODE.KIND.ZOMBIE,
            type: undefined,
            data: {
              filename: 'missing',
            },
            children: ['5'],
            attrs: {},
            links: [],
            embeds: [],
          });
          // adding
          bonsai.fill('404', {
            filename: 'not-missing',
          });
          // after
          assert.deepEqual(bonsai.get('404'), {
            id: '404',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              filename: 'not-missing',
            },
            children: ['5'],
            attrs: {},
            links: [],
            embeds: [],
          });
        });
    
        it('error; node does not exist; do not graft', () => {
          // before
          assert.deepEqual(bonsai.children('1'), ['2']);
          assert.deepEqual(bonsai.graft('-1', ['one'], 'filename'), false);
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
          const treeIDs: string[] = ['1', '2', '3', '4', '5'];
          const testSourceNode: Node | undefined = bonsai.get('2'); // mid-node
          const testTargetNode: Node | undefined = bonsai.get('5'); // orphan
          // pretest
          if (!testSourceNode) { assert.fail(); }
          if (!testTargetNode) { assert.fail(); }
          assert.deepEqual(bonsai.orphans(treeIDs), ['5']);
          assert.deepEqual(bonsai.parent(testTargetNode.id), '');
          assert.deepEqual(testTargetNode.children, []);
          assert.deepEqual(bonsai.parent(testSourceNode.id), '1');
          assert.deepEqual(testSourceNode.children, ['3', '4']);
          // exec
          const replacedNode: Node | undefined = bonsai.replace(testSourceNode.id, testTargetNode.id);
          // test
          if (!replacedNode) { assert.fail(); }
          assert.deepEqual(bonsai.orphans(treeIDs), ['2']);
          assert.deepEqual(testSourceNode.children, []);
          assert.deepEqual(bonsai.parent(testSourceNode.id), '');
          assert.deepEqual(bonsai.parent(replacedNode.id), '1');
          assert.deepEqual(replacedNode.children, ['3', '4']);
        });

        it('target node cannot already exist in tree', () => {
          // test
          assert.strictEqual(bonsai.replace('2', '1'), undefined);
          // after
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'target with "id" "1" already exists in tree');
        });

        it('source node does not exist', () => {
          // test
          assert.strictEqual(bonsai.replace('-1', '1'), undefined);
          // after
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with "id" "-1" does not exist');
        });

        it('target node does not exist', () => {
          // test
          assert.strictEqual(bonsai.replace('1', '-1'), undefined);
          // after
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with "id" "-1" does not exist');
        });

      });

      describe('prune()', () => {

        it('leaf node; node exists; full path populated; no zombies', () => {
          /*
          *    1
          *    |
          *    2 
          *   / \
          *  3   4 <-- prune / remove
          */
          // read as: remove node with id '4' via the path defined by node 'filename's with the given path ['one', 'two'].
          assert.deepEqual(bonsai.prune('4', ['one', 'two'], 'filename'), true);
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

        it('leaf node; node exists; full path populated; has zombies, parent', () => {
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
          assert.deepEqual(bonsai.prune('5', ['one', 'two', 'four', 'braaains'], 'filename'), true);
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
          // read as: remove node with id '2' via the path defined by node 'filename's with the given path ['one', 'two'].
          assert.deepEqual(bonsai.prune('2', ['one'], 'filename'), false);
          // parent
          assert.deepEqual(bonsai.children('1'), ['2']);
          // child
          assert.deepEqual(bonsai.lineage('2'), ['1', '3', '4']);
        });

        it('error; root node', () => {
          /*    1 <-- attempt prune / remove
           *    |
           *    2
           *   / \
           *  3   4
           */
          // read as: remove node with id '2' via the path defined by node 'filename's with the given path ['one', 'two'].
          assert.deepEqual(bonsai.prune('1', [], 'filename'), false);
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

      // todo
      // describe('printTree()', () => {
      // });

      // todo: add methods to validate tree...?

    });

  });

});
