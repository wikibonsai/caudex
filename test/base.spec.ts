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
        assert.deepEqual(base.all({ payload: QUERY_TYPE.ID }), ['1', '2']);
      });

      it('all(\'node\')', () => {
        assert.deepEqual(base.all({ payload: QUERY_TYPE.NODE }), [
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

    describe('all() filters', () => {

      beforeEach(() => {
        const filterData = [
          { init: { id: '1' }, data: { uri: 'file://data/1', filename: 'one', title: 'One', headers: [] } },
          { init: { id: '2' }, data: { uri: 'file://data/2', filename: 'two', title: 'Two', headers: [] } },
          { init: { id: '4' }, data: { uri: 'file://data/4', filename: 'four', title: 'Four', headers: [] } },
        ];
        const opts: any = { uniqKeys: ['uri', 'filename'], zombieKey: 'filename' };
        base = new Base(filterData, opts);
        base.index['1'].type = 'entry';
        base.index['2'].type = 'index';
        base.index['4'].type = 'entry';
        base.add('zombie-name');
      });

      it('filter by nodeKind DOC', () => {
        const out = base.all({ filter: { nodeKind: NODE.KIND.DOC } }) as string[];
        assert.strictEqual(out.length, 3);
        assert.ok(out.includes('1') && out.includes('2') && out.includes('4'));
      });

      it('filter by nodeState ZOMBIE', () => {
        const out = base.all({ filter: { nodeState: NODE.STATE.ZOMBIE } }) as string[];
        assert.deepEqual(out, ['404']);
      });

      it('filter by nodeType entry', () => {
        const out = base.all({ filter: { nodeType: 'entry' } }) as string[];
        assert.deepEqual(out.sort(), ['1', '4']);
      });

      it('filter by nodeType index', () => {
        const out = base.all({ filter: { nodeType: 'index' } }) as string[];
        assert.deepEqual(out, ['2']);
      });

      it('filter by filename', () => {
        assert.deepEqual(base.all({ filter: { filename: 'one' } }), ['1']);
      });

      it('filter by nodeKind and nodeType', () => {
        const out = base.all({ filter: { nodeKind: NODE.KIND.DOC, nodeType: 'entry' } }) as string[];
        assert.deepEqual(out.sort(), ['1', '4']);
      });

      it('filter with no matches', () => {
        assert.deepEqual(base.all({ filter: { nodeType: 'nonexistent' } }), []);
      });

    });

    describe('all() payloads', () => {

      beforeEach(() => {
        const payloadData = [
          { init: { id: '1' }, data: { uri: 'file://data/1', filename: 'one', title: 'One', headers: [] } },
          { init: { id: '2' }, data: { uri: 'file://data/2', filename: 'two', title: 'Two', headers: [] } },
          { init: { id: '3' }, data: { uri: 'file://data/3', filename: 'three', title: 'Three', headers: [] } },
          { init: { id: '4' }, data: { uri: 'file://data/4', filename: 'four', title: 'Four', headers: [] } },
        ];
        const opts: any = { uniqKeys: ['uri', 'filename'], zombieKey: 'filename' };
        base = new Base(payloadData, opts);
      });

      it('payload id (default)', () => {
        const out = base.all() as string[];
        assert.deepEqual(out.sort(), ['1', '2', '3', '4']);
      });

      it('payload id (explicit)', () => {
        const out = base.all({ payload: QUERY_TYPE.ID }) as string[];
        assert.deepEqual(out.sort(), ['1', '2', '3', '4']);
      });

      it('payload node', () => {
        const out = base.all({ payload: QUERY_TYPE.NODE }) as Node[];
        assert.strictEqual(out.length, 4);
        assert.strictEqual(out[0].id, '1');
      });

      it('payload data', () => {
        const out = base.all({ payload: QUERY_TYPE.DATA }) as any[];
        assert.strictEqual(out.length, 4);
        assert.ok(out.every((d: any) => d.uri && d.filename && d.title && Array.isArray(d.headers)));
      });

      it('payload nodekind', () => {
        const out = base.all({ payload: QUERY_TYPE.NODEKIND }) as string[];
        assert.strictEqual(out.length, 4);
        assert.ok(out.every((k: string) => k === NODE.KIND.DOC));
      });

      it('payload nodetype', () => {
        const out = base.all({ payload: QUERY_TYPE.NODETYPE }) as string[];
        assert.strictEqual(out.length, 4);
      });

      it('payload single data key', () => {
        assert.deepEqual((base.all({ payload: 'filename' }) as string[]).sort(), ['four', 'one', 'three', 'two']);
      });

      it('payload multiple data keys', () => {
        const out = base.all({ payload: ['filename', 'uri'] }) as any[];
        assert.strictEqual(out.length, 4);
        assert.deepEqual(out.find((o: any) => o.filename === 'one'), { filename: 'one', uri: 'file://data/1' });
      });

      it('filter and payload combined', () => {
        base.index['1'].type = 'entry';
        base.index['4'].type = 'entry';
        const out = base.all({ filter: { nodeType: 'entry' }, payload: 'filename' }) as string[];
        assert.deepEqual(out.sort(), ['four', 'one']);
      });

    });

    describe('get() payloads', () => {

      it('payload node (default)', () => {
        const out = base.get('1');
        assert.ok(out && typeof out === 'object' && (out as Node).id === '1');
      });

      it('payload id', () => {
        assert.strictEqual(base.get('1', { payload: QUERY_TYPE.ID }), '1');
      });

      it('payload data', () => {
        const out = base.get('1', { payload: QUERY_TYPE.DATA }) as any;
        assert.ok(out.uri && out.filename && out.title);
      });

      it('payload nodekind', () => {
        assert.strictEqual(base.get('1', { payload: QUERY_TYPE.NODEKIND }), NODE.KIND.DOC);
      });

      it('payload nodetype', () => {
        assert.strictEqual(base.get('1', { payload: QUERY_TYPE.NODETYPE }), NODE.TYPE.DEFAULT);
      });

      it('payload single data key', () => {
        assert.strictEqual(base.get('1', { payload: 'filename' }), 'one');
      });

      it('payload multiple keys', () => {
        const out = base.get('1', { payload: ['filename', 'uri'] }) as any;
        assert.deepEqual(out, { filename: 'one', uri: 'file://data/1' });
      });

      it('nonexistent id', () => {
        assert.strictEqual(base.get('-1', { payload: QUERY_TYPE.DATA }), undefined);
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

    describe('query opts', () => {

      describe('filter', () => {
        it('filter.nodeKind returns only matching kind', () => {
          assert.deepEqual(base.all({ filter: { nodeKind: NODE.KIND.DOC } }), ['1', '2']);
          base.add('zombie-filename');
          assert.deepEqual(base.all({ filter: { nodeKind: NODE.KIND.DOC } }), ['1', '2']);
          assert.deepEqual(base.all({ filter: { nodeState: NODE.STATE.ZOMBIE } }), ['404']);
        });

        it('filter.nodeType returns only matching type', () => {
          base.index['1'].type = NODE.TYPE.ENTRY as string;
          base.index['2'].type = NODE.TYPE.DEFAULT;
          assert.deepEqual(base.all({ filter: { nodeType: NODE.TYPE.ENTRY } }), ['1']);
          assert.deepEqual(base.all({ filter: { nodeType: NODE.TYPE.DEFAULT } }), ['2']);
        });

        it('filter.filename returns only matching node', () => {
          assert.deepEqual(base.all({ filter: { filename: 'one' } }), ['1']);
          assert.deepEqual(base.all({ filter: { filename: 'two' } }), ['2']);
          assert.deepEqual(base.all({ filter: { filename: 'nonexistent' } }), []);
        });

        it('filter combines with payload', () => {
          base.index['1'].type = NODE.TYPE.ENTRY as string;
          const out = base.all({ filter: { nodeType: NODE.TYPE.ENTRY }, payload: QUERY_TYPE.NODE }) as Node[];
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].id, '1');
          assert.deepEqual(
            base.all({ filter: { filename: 'one' }, payload: 'title' }),
            ['One']
          );
        });
      });

      describe('payload', () => {

        it('payload id (default)', () => {
          assert.deepEqual(base.all(), ['1', '2']);
          assert.deepEqual(base.all({ payload: QUERY_TYPE.ID }), ['1', '2']);
        });

        it('payload node', () => {
          const nodes = base.all({ payload: QUERY_TYPE.NODE }) as Node[];
          assert.strictEqual(nodes.length, 2);
          assert.strictEqual(nodes[0].id, '1');
          assert.strictEqual(nodes[0].kind, NODE.KIND.DOC);
          assert.strictEqual(nodes[0].type, NODE.TYPE.DEFAULT);
        });

        it('payload nodekind', () => {
          assert.deepEqual(base.all({ payload: QUERY_TYPE.NODEKIND }), [NODE.KIND.DOC, NODE.KIND.DOC]);
        });

        it('payload nodetype', () => {
          assert.deepEqual(base.all({ payload: QUERY_TYPE.NODETYPE }), [NODE.TYPE.DEFAULT, NODE.TYPE.DEFAULT]);
        });

        it('payload data', () => {
          const out = base.all({ payload: QUERY_TYPE.DATA }) as any[];
          assert.strictEqual(out.length, 2);
          assert.deepEqual(out[0], { uri: 'file://data/1', filename: 'one', title: 'One' });
          assert.deepEqual(out[1], { uri: 'file://data/2', filename: 'two', title: 'Two' });
        });

        it('payload single string (data key)', () => {
          assert.deepEqual(base.all({ payload: 'filename' }), ['one', 'two']);
          assert.deepEqual(base.all({ payload: 'title' }), ['One', 'Two']);
        });

        it('payload string[] (multiple keys → object)', () => {
          const out = base.all({ payload: ['id', 'filename', 'title'] }) as any[];
          assert.strictEqual(out.length, 2);
          assert.deepEqual(out[0], { id: '1', filename: 'one', title: 'One' });
          assert.deepEqual(out[1], { id: '2', filename: 'two', title: 'Two' });
        });
      });

      describe('get', () => {

        it('get with payload id', () => {
          assert.strictEqual(base.get('1', { payload: QUERY_TYPE.ID }), '1');
        });

        it('get with payload node (default)', () => {
          const node = base.get('1', { payload: QUERY_TYPE.NODE }) as Node;
          assert.strictEqual(node.id, '1');
          assert.strictEqual(node.kind, NODE.KIND.DOC);
        });

        it('get with payload nodekind', () => {
          assert.strictEqual(base.get('1', { payload: QUERY_TYPE.NODEKIND }), NODE.KIND.DOC);
        });

        it('get with payload nodetype', () => {
          assert.strictEqual(base.get('1', { payload: QUERY_TYPE.NODETYPE }), NODE.TYPE.DEFAULT);
        });

        it('get with payload data', () => {
          assert.deepEqual(base.get('1', { payload: QUERY_TYPE.DATA }), {
            uri: 'file://data/1',
            filename: 'one',
            title: 'One',
          });
        });

        it('get with payload single string', () => {
          assert.strictEqual(base.get('1', { payload: 'filename' }), 'one');
        });

        it('get with payload string[]', () => {
          assert.deepEqual(base.get('1', { payload: ['id', 'uri', 'filename'] }), {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          });

        });

        it('get missing id with payload returns undefined', () => {
          assert.strictEqual(base.get('-1', { payload: QUERY_TYPE.NODE }), undefined);
          assert.strictEqual(base.get('-1', { payload: 'filename' }), undefined);
        });

        it('get with filter: filter is ignored; result depends only on payload', () => {
          // get(id, opts) does not apply filter; only payload shapes the result.
          const noFilter = base.get('1', { payload: QUERY_TYPE.NODE }) as Node;
          const withFilter = base.get('1', { filter: { filename: 'other' }, payload: QUERY_TYPE.NODE }) as Node;
          assert.strictEqual(noFilter.id, withFilter.id, 'filter is ignored; same node returned');
        });

      });

      describe('zombies(opts)', () => {

        it('zombies with payload id (default)', () => {
          base.add('brains');
          assert.deepEqual(base.zombies(), ['404']);
        });

        it('zombies with payload zombie key value', () => {
          base.add('brains');
          assert.deepEqual(base.zombies({ payload: QUERY_TYPE.ZOMBIE }), ['brains']);
        });

        it('zombies with payload data', () => {
          base.add('brains');
          assert.deepEqual(base.zombies({ payload: QUERY_TYPE.DATA }), [{ filename: 'brains' }]);
        });

        it('zombies with payload node', () => {
          base.add('brains');
          const out = base.zombies({ payload: QUERY_TYPE.NODE }) as Node[];
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].state(), NODE.STATE.ZOMBIE);
        });

        it('zombies with payload filename', () => {
          base.add('brains');
          assert.deepEqual(base.zombies({ payload: 'filename' }), ['brains']);
        });
      });

    });

  });

  describe('index properties', () => {

    describe('zombies', () => {

      it('returns zombie ids when present', () => {
        base.add('braaaains');
        assert.deepEqual(base.zombies(), ['404']);
      });

      it('empty', () => {
        assert.deepEqual(base.zombies(), []);
      });

      it('with query', () => {
        base.add('braaaains');
        assert.deepEqual(base.zombies({ payload: QUERY_TYPE.NODE }), [{
          id: '404',
          kind: undefined,
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
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with id "2" already exists');
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
          if (!zombieNode || (zombieNode.state() !== NODE.STATE.ZOMBIE)) { assert.fail(); }
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
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with id "-1" does not exist');
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
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with id "-1" does not exist');
          // e.g. nothing removed
          assert.strictEqual(Object.keys(base.index).length, 2);
        });

      });

      describe('flushGraph()', () => {

        it('clears relationship refs', () => {
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
          assert.strictEqual(base.flushGraph(), true);
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
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with id "-1" does not exist');
        });

        it('with query', () => {
          base.index['1'].attrs['test'] = new Set(['2', '3']);
          assert.deepEqual(base.get('1', { payload: ['id', 'node', 'uri', 'filename'] }), {
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
            kind: undefined,
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
          assert.deepEqual(zombieNode.kind, undefined);
          assert.deepEqual(zombieNode.state(), NODE.STATE.ZOMBIE);
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
          assert.deepEqual(zombieNode.kind, undefined);
          assert.deepEqual(zombieNode.state(), NODE.STATE.ZOMBIE);
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
          assert.deepEqual(zombieNode.kind, undefined);
          assert.deepEqual(zombieNode.state(), NODE.STATE.ZOMBIE);
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

        it('node exists; has relationships (backembeds); zombify', () => {
          // before
          const node: Node | undefined = base.get('2');
          if (node === undefined) { assert.fail('test node should not be \'undefined\''); }
          node.embeds = [{
            id: '1',
          }];
          // go
          assert.strictEqual(base.rm('1'), true);
          // after: an embed is a reference like any other -- the node must
          // zombify (keeping the embed target resolvable), not vanish outright
          assert.strictEqual(base.has('1'), true);
          const zombieNode: Node | undefined = base.get('1');
          if (zombieNode === undefined) { assert.fail(); }
          assert.deepEqual(zombieNode.state(), NODE.STATE.ZOMBIE);
        });

        it('node does not exist', () => {
          // before
          assert.strictEqual(Object.keys(base.index).length, 2);
          // go
          assert.strictEqual(base.rm('-1'), false);
          // after
          assert.strictEqual(fakeConsoleWarn.called, true);
          assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'node with id "-1" does not exist');
          assert.strictEqual(Object.keys(base.index).length, 2);
        });

      });

    });

  });

});
