import assert from 'node:assert';

import { NODE } from '../src/const';
import { Node } from '../src/node';


let node: Node;

describe('node', () => {

  beforeEach(() => {
    node = new Node('1',
      NODE.KIND.DOC,
      'node-type', {
        uri: 'file://data/1',
        filename: 'one',
        title: 'One',
      }
    );
    node.children = ['2'];
    node.attrs = {
      'attr-type': new Set(['3']),
    };
    node.links = [{
      id: '4',
      type: 'link-type',
    }];
    node.embeds = [{
      id: '5',
      media: NODE.MEDIA.MARKDOWN,
    }];
  });

  describe('properties', () => {

    it('expected properties', () => {
      assert.deepStrictEqual(Object.getOwnPropertyNames(node), [
        'id',
        'kind',
        'type',
        'data',
        'children',
        'attrs',
        'links',
        'embeds',
      ]);
    });

    it('id', () => {
      assert.strictEqual(node.id, '1');
    });

    it('type', () => {
      assert.strictEqual(node.type, 'node-type');
    });

    it('data', () => {
      assert.deepStrictEqual(node.data, {
        uri: 'file://data/1',
        filename: 'one',
        title: 'One',
      });
    });

    describe('relationships', () => {

      it('attrs', () => {
        assert.deepStrictEqual(node.attrs, {
          'attr-type': new Set(['3']),
        });
      });

      it('children', () => {
        assert.deepStrictEqual(node.children, ['2']);
      });

      it('links', () => {
        assert.deepStrictEqual(node.links, [{
          id: '4',
          type: 'link-type',
        }]);
      });

    });

  });

  describe('methods', () => {

    it('inAttrs()', () => {
      assert.strictEqual(node.inAttrs('3'), true);
      assert.strictEqual(node.inAttrs('-1'), false);
    });

    it('inChildren()', () => {
      assert.strictEqual(node.inChildren('2'), true);
      assert.strictEqual(node.inChildren('-1'), false);
    });

    it('inLinks()', () => {
      assert.strictEqual(node.inLinks('4'), true);
      assert.strictEqual(node.inLinks('-1'), false);
    });

    it('inEmbeds()', () => {
      assert.strictEqual(node.inEmbeds('5'), true);
      assert.strictEqual(node.inEmbeds('-1'), false);
    });

  });

});