import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import type { Attrs, Embeds, Links } from '../src/types';
import { Base, Node, NODE, QUERY_TYPE } from '../src/index';


let data: any;
let base: Base;
let fakeConsoleWarn: any;
let stubNanoid: any;

describe('base', () => {

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
      }
    ];
    const opts: any =  {
      uniqKeys: ['uri', 'filename'],
      zombieKey: 'filename',
    };
    base = new Base(data, opts);
  });

  afterEach(() => {
    fakeConsoleWarn.restore();
    stubNanoid.restore();
  });

  describe('constructor; index init', () => {

    it('index data format -- id is key and stored in node data', () => {
      assert.deepEqual(base.index, {
        '1': {
          id: '1',
          kind: NODE.KIND.DOC,
          type: NODE.TYPE.DEFAULT,
          data: {
            filename: 'one',
            title: 'One',
            uri: 'file://data/1',
          },
          attrs: {} as Attrs,
          children: [] as string[],
          links: [] as Links,
          embeds: [] as Embeds,
        } as Node,
        '2': {
          id: '2',
          kind: NODE.KIND.DOC,
          type: NODE.TYPE.DEFAULT,
          data: {
            filename: 'two',
            title: 'Two',
            uri: 'file://data/2',
          },
          attrs: {} as Attrs,
          children: [] as string[],
          links: [] as Links,
          embeds: [] as Embeds,
        } as Node,
      });
    });

    it('\'uniqKeyMap\' data format -- \'uniqKey\' keys, node value keys, node id values', () => {
      assert.deepEqual(base.uniqKeyMap, {
        filename: {
          one: '1',
          two: '2',
        },
        uri: {
          'file://data/1': '1',
          'file://data/2': '2',
        },
      });
    });

  });

  describe('index operations', () => {

    describe('has()', () => {

      it('if index has id, return true', () => {
        assert.strictEqual(base.has('1'), true);
      });

      it('if index does not have id, return false', () => {
        assert.strictEqual(base.has('-1'), false);
      });

    });

    describe('all', () => {

      it.skip('all(\'nodekind\')', () => { return; });
      it.skip('all(\'nodetype\')', () => { return; });
      it.skip('all(\'data\')', () => { return; });

      it('all() / all(\'id\')', () => {
        assert.deepEqual(base.all(), ['1', '2']);
        assert.deepEqual(base.all('id'), ['1', '2']);
      });

      it('all(\'node\')', () => {
        assert.deepEqual(base.all('node'), [
          {
            id: '1',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              filename: 'one',
              title: 'One',
              uri: 'file://data/1',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          },
          {
            id: '2',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              filename: 'two',
              title: 'Two',
              uri: 'file://data/2',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          }
        ]);
      });

    });

    describe('clear()', () => {

      it('return all ids in index', () => {
        assert.deepEqual(base.index, {
          '1': {
            id: '1',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              uri: 'file://data/1',
              filename: 'one',
              title: 'One',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          },
          '2': {
            id: '2',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              uri: 'file://data/2',
              filename: 'two',
              title: 'Two',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          },
        });
        base.clear();
        assert.deepEqual(base.index, {});
      });

    });

  });

  describe('index properties', () => {

    describe('zombies', () => {

      it(NODE.TYPE.DEFAULT, () => {
        base.add('braaaains');
        assert.deepEqual(base.zombies(), ['404']);
      });

      it('empty', () => {
        assert.deepEqual(base.zombies(), []);
      });

      it('with query', () => {
        base.add('braaaains');
        assert.deepEqual(base.zombies('node'), [{
          id: '404',
          kind: NODE.KIND.ZOMBIE,
          type: undefined,
          data: {
            filename: 'braaaains',
          },
          attrs: {},
          children: [],
          links: [],
          embeds: [],
        }]);
      });

    });

  });

  describe('node operations', () => {

    describe('unique data keys', () => {

      it('data key is unique', () => {
        assert.strictEqual(base.validate({
          uri: 'file://data/3',
          filename: '/data/3',
          title: 'Three',
        }), true);
      });

      it('data key is not unique', () => {
        assert.strictEqual(base.validate({
          uri: 'file://data/1',
          filename: '/new/url',
          title: 'New Name',
        }), false);
        assert.strictEqual(fakeConsoleWarn.called, true);
        assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'data key "uri" with value "file://data/1" already exists');
      });

    });

    describe('add', () => {

      describe('add()', () => {

        it('default case', () => {
          const node: Node | undefined = base.add({
            uri: 'file://data/3',
            filename: 'three',
            title: 'Three',
          });
          if (node === undefined) { assert.fail('added node should not be \'undefined\''); }
          assert.strictEqual(Object.keys(node).includes('id'), true);
          assert.deepEqual(node.data, {
            filename: 'three',
            title: 'Three',
            uri: 'file://data/3',
          });
          assert.deepEqual(node.attrs, {});
          assert.deepEqual(node.children, []);
          assert.deepEqual(node.links, []);
          assert.deepEqual(node.embeds, []);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['three'], '404');
            assert.strictEqual(base.uniqKeyMap['uri']['file://data/3'], '404');
          }
        });

        it('w/ \'id\' case', () => {
          const node: Node | undefined = base.add({
            uri: 'file://data/3',
            filename: 'three',
            title: 'Three',
          }, {
            id: '3',
          });
          if (node === undefined) { assert.fail('added node should not be \'undefined\''); }
          assert.strictEqual(node.id, '3');
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['three'], '3');
            assert.strictEqual(base.uniqKeyMap['uri']['file://data/3'], '3');
          }
        });

        it('w/ \'kind\' case', () => {
          const node: Node | undefined = base.add({
            uri: 'file://data/3',
            filename: 'three',
            title: 'Three',
          }, {
            kind: NODE.KIND.TEMPLATE,
          });
          if (node === undefined) { assert.fail('added node should not be \'undefined\''); }
          assert.strictEqual(node.kind, NODE.KIND.TEMPLATE);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['three'], '404');
            assert.strictEqual(base.uniqKeyMap['uri']['file://data/3'], '404');
          }
        });

        it('w/ \'type\' case', () => {
          const node: Node | undefined = base.add({
            uri: 'file://data/3',
            filename: 'three',
            title: 'Three',
          }, {
            type: 'node-type',
          });
          if (node === undefined) { assert.fail('added node should not be \'undefined\''); }
          assert.strictEqual(node.type, 'node-type');
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['three'], '404');
            assert.strictEqual(base.uniqKeyMap['uri']['file://data/3'], '404');
          }
        });

        it('zombie case', () => {
          const zombieNode: Node | undefined = base.add('some-value');
          if (!zombieNode) { assert.fail(); }
          assert.strictEqual(Object.keys(zombieNode).includes('id'), true);
          assert.deepEqual(zombieNode.data, {
            filename: 'some-value',
          });
          assert.deepEqual(zombieNode.children, []);
          assert.deepEqual(zombieNode.attrs, {});
          assert.deepEqual(zombieNode.links, []);
          assert.deepEqual(zombieNode.embeds, []);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['some-value'], zombieNode.id);
          }
        });

        it('error; id exists; do not add and return existing node', () => {
          const node: Node | undefined = base.add({
            id: '2',
            uri: 'file://data/2',
            filename: 'two',
            title: 'Two',
          });
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with "id" "2" already exists');
          assert.strictEqual(node, undefined);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['two'], '2');
            assert.strictEqual(base.uniqKeyMap['uri']['file://data/2'], '2');
          }
        });

        it('error; duplicate data key that should be unique; do not add', () => {
          const node: Node | undefined = base.add({
            id: '3',
            uri: 'file://data/2',
            filename: 'two',
            title: 'Two',
          });
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'data key "uri" with value "file://data/2" already exists');
          assert.strictEqual(node, undefined);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['two'], '2');
            assert.strictEqual(base.uniqKeyMap['uri']['file://data/2'], '2');
          }
        });

      });

    });

    describe('edit', () => {

      describe('edit()', () => {

        it('base', () => {
          const editedNode: Node | undefined = base.get('1');
          if (!editedNode) { assert.fail('node with id "1" not initialized'); }
          assert.strictEqual(editedNode.data.filename, 'one');
          assert.strictEqual(base.edit('1', 'filename', 'new-one'), true);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['new-one'], '1');
          }
        });

        it('zombie case', () => {
          const zombieNode: Node | undefined = base.add('some-value');
          if (!zombieNode || (zombieNode.kind !== NODE.KIND.ZOMBIE)) { assert.fail(); }
          assert.strictEqual(zombieNode.data.filename, 'some-value');
          const success: boolean = base.edit(zombieNode.id, 'filename', 'some-edited-value');
          assert.strictEqual(success, true);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['some-edited-value'], zombieNode.id);
          }
        });

      });

      describe('fill()', () => {

        it('base', () => {
          // setup zombie
          const zombieNode: Node | undefined = base.add('some-value');
          if (!zombieNode) { assert.fail(); }
          const data: any = {
            uri: 'file://data/3',
            filename: 'three',
            title: 'Three',
          };
          const filledZombieNode: Node | undefined = base.fill(zombieNode.id, data);
          if (filledZombieNode === undefined) { assert.fail('filled zombie node should not be \'undefined\''); }
          assert.strictEqual(Object.keys(filledZombieNode).includes('id'), true);
          assert.deepEqual(filledZombieNode.data, {
            uri: 'file://data/3',
            filename: 'three',
            title: 'Three',
          });
          assert.deepEqual(filledZombieNode.children, []);
          assert.deepEqual(filledZombieNode.attrs, {});
          assert.deepEqual(filledZombieNode.links, []);
          assert.deepEqual(filledZombieNode.embeds, []);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['three'], filledZombieNode.id);
          }
        });

        it('error; node does not exist', () => {
          assert.strictEqual(base.fill('-1', data), undefined);
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with "id" "-1" does not exist');
        });

      });

    });

    describe('flush', () => {

      describe('flushData()', () => {

        it('all', () => {
          assert.strictEqual(base.flushData(), true);
          assert.deepEqual(base.index['1'].data, {});
          assert.deepEqual(base.index['2'].data, {});
        });

        it('single; node exists', () => {
          assert.strictEqual(base.flushData('1'), true);
          assert.deepEqual(base.index['1'].data, {});
        });

        it('single; node does not exist', () => {
          assert.strictEqual(base.flushData('-1'), false);
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with "id" "-1" does not exist');
          // e.g. nothing removed
          assert.strictEqual(Object.keys(base.index).length, 2);
        });

      });

      describe('flushRels()', () => {

        it(NODE.TYPE.DEFAULT, () => {
          // setup
          const node1: Node = base.index['1'];
          const node2: Node = base.index['2'];
          node1.attrs['type1'] = new Set(['2']);
          node1.children.push('2');
          node1.links.push({
            id: '2',
            type: NODE.TYPE.DEFAULT,
          });
          node2.attrs['type2'] = new Set(['1']);
          node2.children.push('404');
          node2.links.push({
            id: '1',
            type: NODE.TYPE.DEFAULT,
          });
          const testNode1: Node | undefined = base.get('1');
          const testNode2: Node | undefined = base.get('2');
          if (!testNode1) { assert.fail(); }
          if (!testNode2) { assert.fail(); }
          // pretest
          // 1
          assert.deepEqual(testNode1.attrs, {
            type1: new Set(['2']),
          });
          assert.deepEqual(testNode1.children, ['2']);
          assert.deepEqual(testNode1.links, [{
            id: '2',
            type: NODE.TYPE.DEFAULT,
          }]);
          // 2
          assert.deepEqual(testNode2.attrs, {
            type2: new Set(['1']),
          });
          assert.deepEqual(testNode2.children, ['404']);
          assert.deepEqual(testNode2.links, [{
            id: '1',
            type: NODE.TYPE.DEFAULT,
          }]);
          // exec
          assert.strictEqual(base.flushRels(), true);
          // test
          // 1
          assert.deepEqual(testNode1.attrs, {});
          assert.deepEqual(testNode1.children, []);
          assert.deepEqual(testNode1.links, []);
          // 2
          assert.deepEqual(testNode2.attrs, {});
          assert.deepEqual(testNode2.children, []);
          assert.deepEqual(testNode2.links, []);
        });

      });

    });

    describe('get', () => {  

      describe('get()', () => {

        it('node exists', () => {
          assert.deepEqual(base.get('1'), {
            id: '1',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              filename: 'one',
              title: 'One',
              uri: 'file://data/1',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          });
        });

        it('node does not exist', () => {
          assert.strictEqual(base.get('-1'), undefined);
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with "id" "-1" does not exist');
        });

        it('with query', () => {
          base.index['1'].attrs['test'] = new Set(['2', '3']);
          assert.deepEqual(base.get('1', ['id', 'node', 'uri', 'filename']), {
            id: '1',
            node: {
              id: '1',
              kind: NODE.KIND.DOC,
              type: NODE.TYPE.DEFAULT,
              data: {
                filename: 'one',
                title: 'One',
                uri: 'file://data/1',
              },
              attrs: {
                'test': new Set(['2', '3']),
              },
              children: [],
              links: [],
              embeds: [],
            },
            filename: 'one',
            uri: 'file://data/1',
          });
        });

      });

      describe('find()', () => {

        it('node match', () => {
          assert.deepEqual(base.find('uri', 'file://data/1'), {
            id: '1',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              filename: 'one',
              title: 'One',
              uri: 'file://data/1',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          });
        });

        it('zombie value match', () => {
          base.add('ten');
          assert.deepEqual(base.find('filename', 'ten'), {
            id: '404',
            kind: NODE.KIND.ZOMBIE,
            type: undefined,
            data: {
              filename: 'ten',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          });
        });

        it('find unsuccessful; key is not a unique data key', () => {
          assert.strictEqual(base.find('title', 'file://data/1'), undefined);
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], '"dataKey" must be a unique key in node data. Did you mean "filter()"?');
        });

      });

      describe('filter()', () => {

        it('nodekind', () => {
          // test
          assert.deepEqual(base.filter(QUERY_TYPE.NODEKIND, NODE.KIND.DOC), [{
            id: '1',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              filename: 'one',
              title: 'One',
              uri: 'file://data/1',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          },{
            id: '2',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              filename: 'two',
              title: 'Two',
              uri: 'file://data/2'
            },
            attrs: {},
            children: [],
            embeds: [],
            links: [],
          }]);
        });

        it('nodetype', () => {
          // setup
          base.index[1].type = 'query';
          // test
          assert.deepEqual(base.filter(QUERY_TYPE.NODETYPE, 'query'), [{
            id: '1',
            kind: NODE.KIND.DOC,
            type: 'query',
            data: {
              filename: 'one',
              title: 'One',
              uri: 'file://data/1',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          }]);
        });

        it('data key; single', () => {
          assert.deepEqual(base.filter('title', 'One'), [{
            id: '1',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              filename: 'one',
              title: 'One',
              uri: 'file://data/1',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          }]);
        });

        it('data key; multi', () => {
          base.add({
            title: 'One',
          }, {
            id: '1a',
          });
          assert.deepEqual(base.filter('title', 'One'), [{
            id: '1',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              filename: 'one',
              title: 'One',
              uri: 'file://data/1',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          }, {
            id: '1a',
            kind: NODE.KIND.DOC,
            type: NODE.TYPE.DEFAULT,
            data: {
              title: 'One',
            },
            attrs: {},
            children: [],
            links: [],
            embeds: [],
          }]);
        });

      });

    });

    describe('rm', () => {

      describe('rm()', () => {

        it('node exists; no relationships; delete', () => {
          // setup
          base.add({
            uri: 'file://data/10',
            filename: 'ten',
            title: 'Ten',
          }, {
            id: '10',
          });
          // before rm assert
          assert.strictEqual(base.has('10'), true);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['ten'], '10');
            assert.strictEqual(base.uniqKeyMap['uri']['file://data/10'], '10');
          }
          // go
          assert.strictEqual(base.rm('10'), true);
          // after rm assert
          assert.strictEqual(base.has('10'), false);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(Object.keys(base.uniqKeyMap['filename']).includes('ten'), false);
            assert.strictEqual(Object.keys(base.uniqKeyMap['uri']).includes('file://data/10'), false);
          }
        });

        it('node exists; has relationships (parent); zombify', () => {
          // before
          const node: Node | undefined = base.get('2');
          if (node === undefined) { assert.fail('test node should not be \'undefined\''); }
          node.children = ['1'];
          // go
          assert.strictEqual(base.rm('1'), true);
          // after
          assert.strictEqual(base.has('1'), true);
          const zombieNode: Node | undefined = base.get('1');
          if (zombieNode === undefined) { assert.fail(); }
          assert.deepEqual(zombieNode.kind, NODE.KIND.ZOMBIE);
          assert.deepEqual(zombieNode.type, undefined);
          assert.deepEqual(Object.keys(zombieNode.data), ['filename']);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['one'], '1');
            assert.strictEqual(Object.keys(base.uniqKeyMap['uri']).includes('file://data/1/'), false);
          }
        });

        it('node exists; has relationships (attributed); zombify', () => {
          // before
          const node: Node | undefined = base.get('2');
          if (node === undefined) { assert.fail('test node should not be \'undefined\''); }
          node.attrs['type'] = new Set(['1']);
          // go
          assert.strictEqual(base.rm('1'), true);
          // after
          assert.strictEqual(base.has('1'), true);
          const zombieNode: Node | undefined = base.get('1');
          if (zombieNode === undefined) { assert.fail(); }
          assert.deepEqual(zombieNode.kind, NODE.KIND.ZOMBIE);
          assert.deepEqual(zombieNode.type, undefined);
          assert.deepEqual(Object.keys(zombieNode.data), ['filename']);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['one'], '1');
            assert.strictEqual(Object.keys(base.uniqKeyMap['uri']).includes('file://data/1/'), false);
          }
        });

        it('node exists; has relationships (backlinks); zombify', () => {
          // before
          const node: Node | undefined = base.get('2');
          if (node === undefined) { assert.fail('test node should not be \'undefined\''); }
          node.links = [{
            id: '1',
            type: '',
          }];
          // go
          assert.strictEqual(base.rm('1'), true);
          // after
          assert.strictEqual(base.has('1'), true);
          const zombieNode: Node | undefined = base.get('1');
          if (zombieNode === undefined) { assert.fail(); }
          assert.deepEqual(zombieNode.kind, NODE.KIND.ZOMBIE);
          assert.deepEqual(zombieNode.type, undefined);
          assert.deepEqual(Object.keys(zombieNode.data), ['filename']);
          if (!base.uniqKeyMap) {
            console.error('\'uniqKeyMap\' undefined');
            assert.fail();
          } else {
            assert.strictEqual(base.uniqKeyMap['filename']['one'], '1');
            assert.strictEqual(Object.keys(base.uniqKeyMap['uri']).includes('file://data/1/'), false);
          }
        });

        it('node does not exist', () => {
          // before
          assert.strictEqual(Object.keys(base.index).length, 2);
          // go
          assert.strictEqual(base.rm('-1'), false);
          // after
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with "id" "-1" does not exist');
          assert.strictEqual(Object.keys(base.index).length, 2);
        });

      });

    });

  });

});
