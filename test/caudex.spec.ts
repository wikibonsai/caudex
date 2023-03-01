import assert from 'node:assert';

import type { Attrs, Embeds, Links } from '../src/types';
import { Caudex, Node, NODE, QUERY_TYPE } from '../src/index';


let data: any;
let wb: any;

describe('full caudex', () => {

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
      }
    ];
    const opts: any = {
      uniqKeys: ['uri', 'filename'],
      zombieKey: 'filename',
    };
    wb = new Caudex(data, opts);
    wb.setRoot('1');
  });

  it('root', () => {
    assert.deepEqual(wb.root(QUERY_TYPE.NODE), {
      id: '1',
      kind: NODE.KIND.DOC,
      type: NODE.TYPE.DEFAULT,
      data: {
        uri: 'file://data/1',
        filename: 'one',
        title: 'One',
      },
      attrs: {} as Attrs,
      children: [] as string[],
      links: [] as Links,
      embeds: [] as Embeds,
    } as Node);
  });

});
