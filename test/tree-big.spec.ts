import assert from 'node:assert';

import { Base } from '../src/base';
import { Tree } from '../src/tree';


const Bonsai = Tree(Base);
let data: any;
let bonsai: any;

describe('big tree', () => {

  beforeEach(() => {
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
      },
      {
        init: {
          id: '6',
        },
        data: {
          uri: 'file://data/6',
          filename: 'six',
          title: 'Six',
        },
      },
      {
        init: {
          id: '7',
        },
        data: {
          uri: 'file://data/7',
          filename: 'seven',
          title: 'Seven',
        },
      },
      {
        init: {
          id: '8',
        },
        data: {
          uri: 'file://data/8',
          filename: 'eight',
          title: 'Eight',
        },
      }
    ];
    const opts: any = {
      uniqKeys: ['uri', 'filename'],
      zombieKey: 'filename',
    };
    bonsai = new Bonsai(data, opts);
    // specific setup
    /*      1
     *      |
     *      2 
     *     / \
     *    3   4
     *   / \ / \
     *  5  6 7  8
     */
    bonsai.setRoot('1');
    bonsai.graft('2', ['one'], 'filename');
    bonsai.graft('3', ['one', 'two'], 'filename');
    bonsai.graft('4', ['one', 'two'], 'filename');
    bonsai.graft('5', ['one', 'two', 'three'], 'filename');
    bonsai.graft('6', ['one', 'two', 'three'], 'filename');
    bonsai.graft('7', ['one', 'two', 'four'], 'filename');
    bonsai.graft('8', ['one', 'two', 'four'], 'filename');
  });

  it('ancestors', () => {
    assert.deepStrictEqual(bonsai.ancestors('1'), []);
    assert.deepStrictEqual(bonsai.ancestors('2'), ['1']);
    assert.deepStrictEqual(bonsai.ancestors('3'), ['1', '2']);
    assert.deepStrictEqual(bonsai.ancestors('4'), ['1', '2']);
    assert.deepStrictEqual(bonsai.ancestors('5'), ['1', '2', '3']);
    assert.deepStrictEqual(bonsai.ancestors('6'), ['1', '2', '3']);
    assert.deepStrictEqual(bonsai.ancestors('7'), ['1', '2', '4']);
    assert.deepStrictEqual(bonsai.ancestors('8'), ['1', '2', '4']);
  });

  it('lineage', () => {
    assert.deepStrictEqual(bonsai.lineage('1'), ['2', '3', '4', '5', '6', '7', '8']);
    assert.deepStrictEqual(bonsai.lineage('2'), ['1', '3', '4', '5', '6', '7', '8']);
    assert.deepStrictEqual(bonsai.lineage('3'), ['1', '2', '5', '6']);
    assert.deepStrictEqual(bonsai.lineage('4'), ['1', '2', '7', '8']);
    assert.deepStrictEqual(bonsai.lineage('5'), ['1', '2', '3']);
    assert.deepStrictEqual(bonsai.lineage('6'), ['1', '2', '3']);
    assert.deepStrictEqual(bonsai.lineage('7'), ['1', '2', '4']);
    assert.deepStrictEqual(bonsai.lineage('8'), ['1', '2', '4']);
  });

  // todo: test all relations
});
