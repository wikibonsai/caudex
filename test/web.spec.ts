import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import type { Attrs, Embeds, Links } from '../src/types';
import { NODE, QUERY_TYPE, REL } from '../src/const';
import { Node } from '../src/node';
import { Base } from '../src/base';
import { Web } from '../src/web';


const Wiki = Web(Base);
let data: any;
let wiki: any;
let fakeConsoleWarn: any;
let stubNanoid: any;

describe('web', () => {

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
      }
    ];
    const opts: any = {
      uniqKeys: ['uri', 'filename'],
      zombieKey: 'filename',
    };
    wiki = new Wiki(data, opts);
  });

  afterEach(() => {
    fakeConsoleWarn.restore();
    stubNanoid.restore();
  });

  describe('properties', () => {

    describe('reftypes', () => {

      it('base', () => {
        const node: Node | undefined = wiki.get('1');
        if (!node) { assert.fail(); }
        node.attrs = {
          'attrtype': new Set(['2']),
        };
        node.links = [{
          id: '3',
          type: 'linktype',
        }];
        assert.deepEqual(wiki.reftypes(), new Set(['attrtype', 'linktype']));
      });

    });

    describe('attrtypes', () => {

      it('base', () => {
        const node: Node | undefined = wiki.get('1');
        if (!node) { assert.fail(); }
        node.attrs = {
          'attrtype': new Set(['2']),
        };
        assert.deepEqual(wiki.attrtypes(), new Set(['attrtype']));
      });

    });

    describe('linktypes', () => {

      it('base', () => {
        const node: Node | undefined = wiki.get('1');
        if (!node) { assert.fail(); }
        node.links = [{
          id: '2',
          type: 'linktype',
        }];
        assert.deepEqual(wiki.linktypes(), new Set(['linktype']));
      });

    });

    describe('floaters', () => {

      it('index has floaters', () => {
        assert.deepEqual(wiki.floaters(), ['1', '2', '3', '4']);
      });

      it('index has no floaters', () => {
        wiki.connect('link', '1', '2');
        wiki.connect('link', '1', '3');
        wiki.connect('link', '1', '4');
        assert.deepEqual(wiki.floaters(), []);
      });

      it('with query', () => {
        assert.deepEqual(wiki.floaters('filename'), ['one', 'two', 'three', 'four']);
      });

    });

    describe('foreattrs / backattrs', () => {

      it('node exists', () => {
        // setup
        wiki.index['1'].attrs['test'] = new Set(['2']);
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
      });

      it('node does not exist', () => {
        assert.strictEqual(wiki.foreattrs('-1'), undefined);
        assert.strictEqual(wiki.backattrs('-1'), undefined);
      });

      it('with query', () => {
        // setup
        wiki.index['1'].attrs['test'] = new Set(['2', '3']);
        assert.deepEqual(wiki.foreattrs('1', ['id', 'uri', 'filename']), {
          'test': [
            {
              id: '2',
              filename: 'two',
              uri: 'file://data/2',
            },
            {
              id: '3',
              uri: 'file://data/3',
              filename: 'three',
            }
          ]
        });
        assert.deepEqual(wiki.backattrs('2', ['id', 'uri', 'filename']), {
          'test': [{
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          }]
        });
        assert.deepEqual(wiki.backattrs('3', ['id', 'uri', 'filename']), {
          'test': [{
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          }]
        });
      });

    });

    describe('forelinks / backlinks', () => {

      it('node exists', () => {
        // setup
        wiki.index['1'].links.push({
          type: 'test',
          id: '2',
        });
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'test',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'test',
          id: '1',
        }]);
      });

      it('node does not exist', () => {
        assert.strictEqual(wiki.forelinks('-1'), undefined);
        assert.strictEqual(wiki.backlinks('-1'), undefined);
      });

      it('with query', () => {
        // setup
        wiki.index['1'].links = [
          {
            type: 'test',
            id: '2',
          },
          {
            type: 'test',
            id: '3',
          },
        ];
        assert.deepEqual(wiki.forelinks('1', ['id', 'uri', 'filename']), [
          [
            'test',
            {
              id: '2',
              filename: 'two',
              uri: 'file://data/2',
            },
          ],
          [
            'test',
            {
              id: '3',
              uri: 'file://data/3',
              filename: 'three',
            },
          ]
        ]);
        assert.deepEqual(wiki.backlinks('2', ['id', 'uri', 'filename']), [[
          'test',
          {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          },
        ]]);
        assert.deepEqual(wiki.backlinks('3', ['id', 'uri', 'filename']), [[
          'test',
          {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          },
        ]]);
      });

    });

    describe('foreembeds / backembeds', () => {

      it('node exists', () => {
        // setup
        wiki.index['1'].embeds.push({
          id: '2',
          media: NODE.MEDIA.MARKDOWN,
        });
        assert.deepEqual(wiki.foreembeds('1'), [{
          id: '2',
          media: NODE.MEDIA.MARKDOWN,
        }]);
        assert.deepEqual(wiki.backembeds('2'), [{
          id: '1',
          media: NODE.MEDIA.MARKDOWN,
        }]);
      });

      it('node does not exist', () => {
        assert.strictEqual(wiki.foreembeds('-1'), undefined);
        assert.strictEqual(wiki.backembeds('-1'), undefined);
      });

      it('with query', () => {
        // setup
        wiki.index['1'].embeds = [
          {
            id: '2',
            media: NODE.MEDIA.MARKDOWN,
          },
          {
            id: '3',
            media: NODE.MEDIA.MARKDOWN,
          },
        ];
        assert.deepEqual(wiki.foreembeds('1', ['id', 'uri', 'filename']), [
          {
            id: '2',
            filename: 'two',
            uri: 'file://data/2',
          },
          {
            id: '3',
            uri: 'file://data/3',
            filename: 'three',
          },
        ]);
        assert.deepEqual(wiki.backembeds('2', ['id', 'uri', 'filename']), [
          {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          },
        ]);
        assert.deepEqual(wiki.backembeds('3', ['id', 'uri', 'filename']), [
          {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          },
        ]);
      });

    });

    describe('neighbors', () => {

      // neighbors behavior identical for both 'attrs' and 'links'

      it('node exists; attr', () => {
        // setup
        wiki.index['1'].attrs['test'] = new Set(['2']);
        assert.deepEqual(wiki.neighbors('1'), ['2']);
        assert.deepEqual(wiki.neighbors('2'), ['1']);
      });

      it('node exists; link', () => {
        // setup
        wiki.index['1'].links.push({
          type: 'test',
          id: '2',
        });
        assert.deepEqual(wiki.neighbors('1'), ['2']);
        assert.deepEqual(wiki.neighbors('2'), ['1']);
      });

      it('node exists; embed', () => {
        // setup
        wiki.index['1'].embeds.push({
          id: '2',
          media: NODE.MEDIA.MARKDOWN,
        });
        assert.deepEqual(wiki.neighbors('1'), ['2']);
        assert.deepEqual(wiki.neighbors('2'), ['1']);
      });

      it('node exists; filter; attr', () => {
        // setup
        wiki.index['1'].attrs['test'] = new Set(['2']);
        wiki.index['1'].links.push({
          type: 'test',
          id: '3',
        });
        wiki.index['1'].embeds.push({
          id: '4',
          media: NODE.MEDIA.MARKDOWN,
        });
        assert.deepEqual(wiki.neighbors('1', REL.REF.ATTR), ['2']);
        assert.deepEqual(wiki.neighbors('2', REL.REF.ATTR), ['1']);
        assert.deepEqual(wiki.neighbors('3', REL.REF.ATTR), []);
        assert.deepEqual(wiki.neighbors('4', REL.REF.ATTR), []);
      });

      it('node exists; filter; link', () => {
        // setup
        wiki.index['1'].attrs['test'] = new Set(['2']);
        wiki.index['1'].links.push({
          type: 'test',
          id: '3',
        });
        wiki.index['1'].embeds.push({
          id: '4',
          media: NODE.MEDIA.MARKDOWN,
        });
        assert.deepEqual(wiki.neighbors('1', REL.REF.LINK), ['3']);
        assert.deepEqual(wiki.neighbors('2', REL.REF.LINK), []);
        assert.deepEqual(wiki.neighbors('3', REL.REF.LINK), ['1']);
        assert.deepEqual(wiki.neighbors('4', REL.REF.LINK), []);
      });

      it('node exists; filter; embed', () => {
        // setup
        wiki.index['1'].attrs['test'] = new Set(['2']);
        wiki.index['1'].links.push({
          type: 'test',
          id: '3',
        });
        wiki.index['1'].embeds.push({
          id: '4',
          media: NODE.MEDIA.MARKDOWN,
        });
        // assert.deepEqual(wiki.neighbors('1', REL.REF.EMBED), ['4']);
        // assert.deepEqual(wiki.neighbors('2', REL.REF.EMBED), []);
        // assert.deepEqual(wiki.neighbors('3', REL.REF.EMBED), []);
        assert.deepEqual(wiki.neighbors('4', REL.REF.EMBED), ['1']);
      });

      it('node does not exist', () => {
        assert.strictEqual(wiki.neighbors('-1'), undefined);
      });

    });

  });

  describe('methods', () => {

    describe('flushRelRefs()', () => {

      it('all; flush refs; delete zombies with no refs', () => {
        // setup
        wiki.index['1'].attrs['test1'] = new Set(['2']);
        wiki.index['1'].links = [{
          type: NODE.TYPE.DEFAULT,
          id: '2',
        }];
        wiki.index['2'].attrs['test2'] = new Set(['1']);
        wiki.index['2'].links = [{
          type: NODE.TYPE.DEFAULT,
          id: '1',
        }];
        wiki.add('ima-zombie 🧟');
        // before flush
        assert.deepEqual(wiki.foreattrs('1'), {
          'test1': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('1'), {
          'test2': new Set(['2']),
        });
        assert.deepEqual(wiki.forelinks('1'), [{
          id: '2',
          type: NODE.TYPE.DEFAULT,
        }]);
        assert.deepEqual(wiki.backlinks('1'), [{
          id: '2',
          type: NODE.TYPE.DEFAULT,
        }]);
        assert.deepEqual(wiki.foreattrs('2'), {
          'test2': new Set(['1']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test1': new Set(['1']),
        });
        assert.deepEqual(wiki.forelinks('2'), [{
          id: '1',
          type: NODE.TYPE.DEFAULT,
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          id: '1',
          type: NODE.TYPE.DEFAULT,
        }]);
        assert.deepEqual(wiki.zombies().length, 1);
        // flush
        assert.deepEqual(wiki.flushRelRefs(), true);
        // after flush
        assert.deepEqual(wiki.foreattrs('1'), {});
        assert.deepEqual(wiki.backattrs('1'), {});
        assert.deepEqual(wiki.foreattrs('2'), {});
        assert.deepEqual(wiki.backattrs('2'), {});
        assert.deepEqual(wiki.zombies().length, 0);
      });

      it('single; node exists; flush refs; delete zombies with no refs', () => {
        // setup
        const zombie: Node | undefined = wiki.add('ima-zombie 🧟');
        if (!zombie) { assert.fail(); }
        wiki.index['1'].attrs['test'] = new Set(['2']);
        wiki.index['1'].links = [
          {
            type: NODE.TYPE.DEFAULT,
            id: '2',
          },
          {
            type: NODE.TYPE.DEFAULT,
            id: '404',
          },
        ];
        // before flush
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
        assert.deepEqual(wiki.zombies().length, 1);
        // flush
        assert.deepEqual(wiki.flushRelRefs('1'), true);
        // after flush
        assert.deepEqual(wiki.foreattrs('1'), {});
        assert.deepEqual(wiki.backattrs('2'), {});
        // since the flushed node is the only one that references the zombie,
        // delete the zombie.
        assert.deepEqual(wiki.zombies().length, 0);
      });

      it('single; node exists; flush refs; do not delete zombies with refs', () => {
        // setup
        const zombie: Node | undefined = wiki.add('ima-zombie 🧟');
        if (!zombie) { assert.fail(); }
        wiki.index['1'].attrs['test'] = new Set(['2']);
        wiki.index['1'].links = [
          {
            type: NODE.TYPE.DEFAULT,
            id: '2',
          },
          {
            type: undefined,
            id: '404',
          },
        ];
        wiki.index['2'].attrs['test'] = new Set(['404']);
        // before flush
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
        assert.deepEqual(wiki.zombies().length, 1);
        // flush
        assert.deepEqual(wiki.flushRelRefs('1'), true);
        // after flush
        assert.deepEqual(wiki.foreattrs('1'), {});
        assert.deepEqual(wiki.backattrs('2'), {});
        // since the flushed node is the only one that references the zombie,
        // delete the zombie.
        assert.deepEqual(wiki.zombies().length, 1);
        assert.deepEqual(wiki.zombies(QUERY_TYPE.NODE), [{
          id: '404',
          kind: NODE.KIND.ZOMBIE,
          type: undefined,
          data: {
            filename: 'ima-zombie 🧟',
          },
          attrs: {},
          children: [],
          links: [],
          embeds: [],
        }]);
      });

      it('single; is zombie; is child; do not delete zombie', () => {
        // setup
        const zombie: Node | undefined = wiki.add('ima-zombie 🧟');
        if (!zombie) { assert.fail(); }
        wiki.index['1'].attrs['test'] = new Set(['2']);
        wiki.index['1'].children = ['404'];
        wiki.index['1'].links = [
          {
            type: undefined,
            id: '404',
          },
          {
            type: NODE.TYPE.DEFAULT,
            id: '2',
          },
        ];
        // before flush
        assert.deepEqual(wiki.get('1')?.children, ['404']);
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
        assert.deepEqual(wiki.zombies().length, 1);
        // flush
        assert.deepEqual(wiki.flushRelRefs('1'), true);
        // after flush
        assert.deepEqual(wiki.get('1')?.children, ['404']);
        assert.deepEqual(wiki.foreattrs('1'), {});
        assert.deepEqual(wiki.backattrs('2'), {});
        // since the flushed node is the only one that references the zombie,
        // delete the zombie.
        assert.deepEqual(wiki.zombies().length, 1);
        assert.deepEqual(wiki.zombies(QUERY_TYPE.NODE), [{
          id: '404',
          kind: NODE.KIND.ZOMBIE,
          type: undefined,
          data: {
            filename: 'ima-zombie 🧟',
          },
          attrs: {},
          children: [],
          links: [],
          embeds: [],
        }]);
      });

      it('single; node does not exist', () => {
        assert.deepEqual(wiki.flushRelRefs('-1'), false);
      });

    });

    describe('connect(); attribute', () => {

      it('create new', () => {
        assert.deepEqual(wiki.connect(REL.REF.ATTR, '1', '2', 'test'), true);
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
      });

      it('append to type', () => {
        assert.deepEqual(wiki.connect(REL.REF.ATTR, '1', '2', 'test'), true);
        assert.deepEqual(wiki.connect(REL.REF.ATTR, '1', '3', 'test'), true);
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2', '3']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
        assert.deepEqual(wiki.backattrs('3'), {
          'test': new Set(['1']),
        });
      });

      it('source node does not exist', () => {
        assert.deepEqual(wiki.connect(REL.REF.ATTR, 'missing', '2', 'test'), false);
        assert.deepEqual(wiki.backattrs('2'), {});
      });

      it('target node does not exist; create zombie node with data', () => {
        assert.deepEqual(wiki.connect(REL.REF.ATTR, '1', 'missing', 'test'), false);
        assert.deepEqual(wiki.foreattrs('1'), {});
      });

    });

    describe('connect(); link', () => {

      it('untyped', () => {
        assert.deepEqual(wiki.connect(REL.REF.LINK, '1', '2'), true);
        assert.deepEqual(wiki.forelinks('1'), [{
          type: '',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: '',
          id: '1',
        }]);
      });

      it('typed', () => {
        assert.deepEqual(wiki.connect(REL.REF.LINK, '1', '2', 'test'), true);
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'test',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'test',
          id: '1',
        }]);
      });

      it('typed; multiples all saved', () => {
        assert.deepEqual(wiki.connect(REL.REF.LINK, '1', '2', 'test'), true);
        assert.deepEqual(wiki.connect(REL.REF.LINK, '1', '3', 'test'), true);
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'test',
          id: '2',
        },{
          type: 'test',
          id: '3',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'test',
          id: '1',
        }]);
        assert.deepEqual(wiki.backlinks('3'), [{
          type: 'test',
          id: '1',
        }]);
      });

      it('typed; do not store duplicates', () => {
        assert.deepEqual(wiki.connect(REL.REF.LINK, '1', '2', 'test'), true);
        assert.deepEqual(wiki.connect(REL.REF.LINK, '1', '2', 'test'), true);
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'test',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'test',
          id: '1',
        }]);
        assert.deepEqual(wiki.backlinks('3'), []);
      });

      it('source node does not exist', () => {
        assert.deepEqual(wiki.connect(REL.REF.LINK, 'missing', '2', 'test'), false);
        assert.deepEqual(wiki.backlinks('2'), []);
      });

      it('target node does not exist', () => {
        assert.deepEqual(wiki.connect(REL.REF.LINK, '1', 'missing', 'test'), false);
        assert.deepEqual(wiki.forelinks('1'), []);
      });

    });

    describe('connect(); embed', () => {

      // todo:
      // - no 'type' is automatically MEDIA.MARKDOWN
      // - explicit MEDIA.MARKDOWN
      // - invalid media kind / 'type'
      it.skip('media kinds', () => { return; });

      it('base', () => {
        assert.deepEqual(wiki.connect(REL.REF.EMBED, '1', '2'), true);
        assert.deepEqual(wiki.foreembeds('1'), [{
          id: '2',
          media: NODE.MEDIA.MARKDOWN,
        }]);
        assert.deepEqual(wiki.backembeds('2'), [{
          id: '1',
          media: NODE.MEDIA.MARKDOWN,
        }]);
      });

      it('multiples all saved', () => {
        assert.deepEqual(wiki.connect(REL.REF.EMBED, '1', '2'), true);
        assert.deepEqual(wiki.connect(REL.REF.EMBED, '1', '3'), true);
        assert.deepEqual(wiki.foreembeds('1'), [{
          id: '2',
          media: NODE.MEDIA.MARKDOWN,
        },{
          id: '3',
          media: NODE.MEDIA.MARKDOWN,
        }]);
        assert.deepEqual(wiki.backembeds('2'), [{
          id: '1',
          media: NODE.MEDIA.MARKDOWN,
        }]);
        assert.deepEqual(wiki.backembeds('3'), [{
          id: '1',
          media: NODE.MEDIA.MARKDOWN,
        }]);
      });

      it('do not store duplicates', () => {
        assert.deepEqual(wiki.connect(REL.REF.EMBED, '1', '2'), true);
        assert.deepEqual(wiki.connect(REL.REF.EMBED, '1', '2'), true);
        assert.deepEqual(wiki.foreembeds('1'), [{
          id: '2',
          media: NODE.MEDIA.MARKDOWN,
        }]);
        assert.deepEqual(wiki.backembeds('2'), [{
          id: '1',
          media: NODE.MEDIA.MARKDOWN,
        }]);
        assert.deepEqual(wiki.backembeds('3'), []);
      });

      it('source node does not exist', () => {
        assert.deepEqual(wiki.connect(REL.REF.EMBED, 'missing', '2'), false);
        assert.deepEqual(wiki.backembeds('2'), []);
      });

      it('target node does not exist', () => {
        assert.deepEqual(wiki.connect(REL.REF.EMBED, '1', 'missing'), false);
        assert.deepEqual(wiki.foreembeds('1'), []);
      });

    });

    describe('retype(); ref', () => {

      it('base; retypes both all ref kinds', () => {
        // setup
        wiki.index['1'].attrs['old-type'] = new Set(['2']);
        wiki.index['1'].links = [{
          type: 'old-type',
          id: '2',
        }] as Links;
        // before retype
        assert.deepEqual(wiki.foreattrs('1'), {
          'old-type': new Set('2'),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'old-type': new Set('1'),
        });
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'old-type',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'old-type',
          id: '1',
        }]);
        // retype
        const res: boolean = wiki.retype('old-type', 'new-type');
        // after retype
        assert.strictEqual(res, true);
        assert.deepEqual(wiki.foreattrs('1'), {
          'new-type': new Set('2'),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'new-type': new Set('1'),
        });
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'new-type',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'new-type',
          id: '1',
        }]);
      });

    });

    describe('retype(); attr', () => {

      it('base', () => {
        // setup
        wiki.index['1'].attrs['old-type'] = new Set(['2']);
        // before retype
        assert.deepEqual(wiki.foreattrs('1'), {
          'old-type': new Set('2'),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'old-type': new Set('1'),
        });
        // retype
        const res: boolean = wiki.retype('old-type', 'new-type', REL.REF.ATTR);
        // after retype
        assert.strictEqual(res, true);
        assert.deepEqual(wiki.foreattrs('1'), {
          'new-type': new Set('2'),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'new-type': new Set('1'),
        });
      });

      it('does not retype links', () => {
        // setup
        wiki.index['1'].links = [{
          type: 'old-type',
          id: '2',
        }] as Links;
        // before retype
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'old-type',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'old-type',
          id: '1',
        }]);
        // retype
        const res: boolean = wiki.retype('old-type', 'new-type', REL.REF.ATTR);
        // after retype
        assert.strictEqual(res, true);
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'old-type',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'old-type',
          id: '1',
        }]);
      });

    });

    describe('retype(); link', () => {

      it('base', () => {
        // setup
        wiki.index['1'].links = [{
          type: 'old-type',
          id: '2',
        }] as Links;
        // before retype
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'old-type',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'old-type',
          id: '1',
        }]);
        // retype
        const res: boolean = wiki.retype('old-type', 'new-type', REL.REF.LINK);
        // after retype
        assert.strictEqual(res, true);
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'new-type',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'new-type',
          id: '1',
        }]);
      });

      it('does not retype attrs', () => {
        // setup
        wiki.index['1'].attrs['old-type'] = new Set(['2']);
        // before retype
        assert.deepEqual(wiki.foreattrs('1'), {
          'old-type': new Set('2'),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'old-type': new Set('1'),
        });
        // retype
        const res: boolean = wiki.retype('old-type', 'new-type', REL.REF.LINK);
        // after retype
        assert.strictEqual(res, true);
        assert.deepEqual(wiki.foreattrs('1'), {
          'old-type': new Set('2'),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'old-type': new Set('1'),
        });
      });

    });

    describe('transfer()', () => {

      beforeEach(() => {
        wiki.index['1'].attrs = {
          'attrtype': new Set(['2']),
        } as Attrs;
        wiki.index['1'].links = [{
          type: 'linktype',
          id: '2',
        }] as Links;
        wiki.index['1'].embeds = [{
          media: NODE.MEDIA.MARKDOWN,
          id: '2',
        }] as Embeds;
      });

      describe('ref', () => {

        it('base; source and target both exist', () => {
          // go
          assert.strictEqual(wiki.transfer('1', '3'), true);
          // after
          const transferredNode: Node | undefined = wiki.get('3');
          if (!transferredNode) { assert.fail(); }
          // assert
          const sourceNode: Node | undefined = wiki.get('1');
          if (!sourceNode) { assert.fail(); }
          const targetNode: Node | undefined = wiki.get('3');
          if (!targetNode) { assert.fail(); }
          // source
          assert.deepEqual(sourceNode.attrs, {});
          assert.deepEqual(sourceNode.links, []);
          assert.deepEqual(sourceNode.embeds, []);
          // target
          assert.deepEqual(targetNode.attrs, {
            'attrtype': new Set(['2'])
          } as Attrs);
          assert.deepEqual(targetNode.links, [{
            type: 'linktype',
            id: '2',
          }] as Links);
          assert.deepEqual(targetNode.embeds, [{
            media: NODE.MEDIA.MARKDOWN,
            id: '2',
          }] as Embeds);
        });

        it('target cannot accept self refs', () => {
          // go
          assert.strictEqual(wiki.transfer('1', '2'), true);
          // after
          const transferredNode: Node | undefined = wiki.get('2');
          if (!transferredNode) { assert.fail(); }
          // assert
          const sourceNode: Node | undefined = wiki.get('1');
          if (!sourceNode) { assert.fail(); }
          const targetNode: Node | undefined = wiki.get('3');
          if (!targetNode) { assert.fail(); }
          // source
          assert.deepEqual(sourceNode.attrs, {});
          assert.deepEqual(sourceNode.links, []);
          assert.deepEqual(sourceNode.embeds, []);
          // target
          assert.deepEqual(targetNode.attrs, {});
          assert.deepEqual(targetNode.links, []);
          assert.deepEqual(targetNode.embeds, []);
        });

        it('source does not exist', () => {
          assert.strictEqual(wiki.transfer('-1', '1'), false);
        });

        it('target does not exist', () => {
          assert.strictEqual(wiki.transfer('1', '-1'), false);
        });

      });

      describe('attr', () => {

        it('base; source and target both exist', () => {
          // go
          assert.strictEqual(wiki.transfer('1', '3', REL.REF.ATTR), true);
          // after
          const transferredNode: Node | undefined = wiki.get('3');
          if (!transferredNode) { assert.fail(); }
          // assert
          const sourceNode: Node | undefined = wiki.get('1');
          if (!sourceNode) { assert.fail(); }
          const targetNode: Node | undefined = wiki.get('3');
          if (!targetNode) { assert.fail(); }
          // source
          assert.deepEqual(sourceNode.attrs, {});
          assert.deepEqual(sourceNode.links, [{
            type: 'linktype',
            id: '2',
          }] as Links);
          assert.deepEqual(sourceNode.embeds, [{
            media: NODE.MEDIA.MARKDOWN,
            id: '2',
          }] as Embeds);
          // target
          assert.deepEqual(targetNode.attrs, {
            'attrtype': new Set(['2'])
          });
          assert.deepEqual(targetNode.links, []);
          assert.deepEqual(targetNode.embeds, []);
        });

        it('source does not exist', () => {
          assert.strictEqual(wiki.transfer('-1', '1', REL.REF.ATTR), false);
        });

        it('target does not exist', () => {
          assert.strictEqual(wiki.transfer('1', '-1', REL.REF.ATTR), false);
        });

      });

      describe('link', () => {

        it('base; source and target both exist', () => {
          // go
          assert.strictEqual(wiki.transfer('1', '3', REL.REF.LINK), true);
          // after
          const transferredNode: Node | undefined = wiki.get('3');
          if (!transferredNode) { assert.fail(); }
          // assert
          const sourceNode: Node | undefined = wiki.get('1');
          if (!sourceNode) { assert.fail(); }
          const targetNode: Node | undefined = wiki.get('3');
          if (!targetNode) { assert.fail(); }
          // source
          assert.deepEqual(sourceNode.attrs, {
            'attrtype': new Set(['2'])
          });
          assert.deepEqual(sourceNode.links, []);
          assert.deepEqual(sourceNode.embeds, [{
            media: NODE.MEDIA.MARKDOWN,
            id: '2',
          }] as Embeds);
          // target
          assert.deepEqual(targetNode.attrs, {});
          assert.deepEqual(targetNode.links, [{
            type: 'linktype',
            id: '2',
          }] as Links);
          assert.deepEqual(targetNode.embeds, []);
        });

        it('source does not exist', () => {
          assert.strictEqual(wiki.transfer('-1', '1', REL.REF.LINK), false);
        });

        it('target does not exist', () => {
          assert.strictEqual(wiki.transfer('1', '-1', REL.REF.LINK), false);
        });

      });

      describe('embed', () => {

        it('base; source and target both exist', () => {
          // go
          assert.strictEqual(wiki.transfer('1', '3', REL.REF.EMBED), true);
          // after
          const transferredNode: Node | undefined = wiki.get('3');
          if (!transferredNode) { assert.fail(); }
          // assert
          const sourceNode: Node | undefined = wiki.get('1');
          if (!sourceNode) { assert.fail(); }
          const targetNode: Node | undefined = wiki.get('3');
          if (!targetNode) { assert.fail(); }
          // source
          assert.deepEqual(sourceNode.attrs, {
            'attrtype': new Set(['2'])
          } as Attrs);
          assert.deepEqual(sourceNode.links, [{
            type: 'linktype',
            id: '2',
          }] as Links);
          assert.deepEqual(sourceNode.embeds, []);
          // target
          assert.deepEqual(targetNode.attrs, {});
          assert.deepEqual(targetNode.links, []);
          assert.deepEqual(targetNode.embeds, [{
            media: NODE.MEDIA.MARKDOWN,
            id: '2',
          }] as Embeds);
        });

        it('source does not exist', () => {
          assert.strictEqual(wiki.transfer('-1', '1', REL.REF.EMBED), false);
        });

        it('target does not exist', () => {
          assert.strictEqual(wiki.transfer('1', '-1', REL.REF.EMBED), false);
        });

      });

    });

    describe('disconnect(); attribute', () => {

      it('base; rm whole attribute', () => {
        // setup
        wiki.index['1'].attrs['test'] = new Set(['2']);
        // before rm
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
        // rm
        assert.deepEqual(wiki.disconnect(REL.REF.ATTR, '1', '2', 'test'), true);
        // after rm
        assert.deepEqual(wiki.foreattrs('1'), {});
        assert.deepEqual(wiki.backattrs('2'), {});
      });

      it('base; rm single id from attribute', () => {
        // setup
        wiki.index['1'].attrs['test'] = new Set(['2', '3']);
        // before rm
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2', '3']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
        assert.deepEqual(wiki.backattrs('3'), {
          'test': new Set(['1']),
        });
        // 
        assert.deepEqual(wiki.disconnect(REL.REF.ATTR, '1', '2', 'test'), true);
        // after rm
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['3']),
        });
        assert.deepEqual(wiki.backattrs('2'), {});
        assert.deepEqual(wiki.backattrs('3'), {
          'test': new Set(['1']),
        });
      });

      it('source node does not exist', () => {
        // setup
        wiki.index['1'].attrs['test'] = new Set(['2']);
        // rm
        assert.deepEqual(wiki.disconnect(REL.REF.ATTR, 'missing', '2', 'test'), false);
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
      });

      it('target node does not exist', () => {
        // setup
        wiki.index['1'].attrs['test'] = new Set(['2']);
        // rm
        assert.deepEqual(wiki.disconnect('test', 'file://data/1', 'missing', 'uri'), false);
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
      });

    });

    describe('disconnect(); link', () => {

      it('untyped (implicit)', () => {
        // setup
        wiki.index['1'].links = [{
          type: '',
          id: '2',
        }];
        // before rm
        assert.deepEqual(wiki.forelinks('1'), [{
          type: '',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: '',
          id: '1',
        }]);
        // rm
        assert.deepEqual(wiki.disconnect(REL.REF.LINK, '1', '2'), true);
        // after rm
        assert.deepEqual(wiki.forelinks('1'), []);
        assert.deepEqual(wiki.backlinks('2'), []);
      });

      it('untyped (explicit)', () => {
        // setup
        wiki.index['1'].links = [{
          type: '',
          id: '2',
        }];
        // before rm
        assert.deepEqual(wiki.forelinks('1'), [{
          type: '',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: '',
          id: '1',
        }]);
        // rm
        assert.deepEqual(wiki.disconnect(REL.REF.LINK, '1', '2'), true);
        // after rm
        assert.deepEqual(wiki.forelinks('1'), []);
        assert.deepEqual(wiki.backlinks('2'), []);
      });

      // todo: try to move a typed link without specifying the type

      it('typed', () => {
        // setup
        wiki.index['1'].links = [{
          type: 'test',
          id: '2',
        }];
        // before rm
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'test',
          id: '2',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'test',
          id: '1',
        }]);
        // rm
        assert.deepEqual(wiki.disconnect(REL.REF.LINK, '1', '2', 'test'), true);
        // after rm
        assert.deepEqual(wiki.forelinks('1'), []);
        assert.deepEqual(wiki.backlinks('2'), []);
      });

      it('source node does not exist', () => {
        // setup
        wiki.index['1'].links = [{
          type: 'test',
          id: '2',
        }];
        assert.deepEqual(wiki.disconnect(REL.REF.LINK, 'missing', '2', 'test'), false);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'test',
          id: '1',
        }]);
      });

      it('target node does not exist; returns true since target does not exist', () => {
        // setup
        wiki.index['1'].links = [{
          type: 'test',
          id: '2',
        }];
        assert.deepEqual(wiki.disconnect(REL.REF.LINK, '1', 'missing', 'test'), true);
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'test',
          id: '2',
        }]);
      });

    });

    describe('disconnect(); embed', () => {

      it('base (implicit)', () => {
        // setup
        wiki.index['1'].embeds = [{
          media: NODE.MEDIA.MARKDOWN,
          id: '2',
        }];
        // before rm
        assert.deepEqual(wiki.foreembeds('1'), [{
          media: NODE.MEDIA.MARKDOWN,
          id: '2',
        }]);
        assert.deepEqual(wiki.backembeds('2'), [{
          media: NODE.MEDIA.MARKDOWN,
          id: '1',
        }]);
        // rm
        assert.deepEqual(wiki.disconnect(REL.REF.EMBED, '1', '2'), true);
        // after rm
        assert.deepEqual(wiki.foreembeds('1'), []);
        assert.deepEqual(wiki.backembeds('2'), []);
      });

      it('source node does not exist', () => {
        // setup
        wiki.index['1'].embeds = [{
          media: NODE.MEDIA.MARKDOWN,
          id: '2',
        }];
        assert.deepEqual(wiki.disconnect(REL.REF.EMBED, 'missing', '2'), false);
        assert.deepEqual(wiki.backembeds('2'), [{
          media: NODE.MEDIA.MARKDOWN,
          id: '1',
        }]);
      });

      it('target node does not exist; returns true since target does not exist', () => {
        // setup
        wiki.index['1'].embeds = [{
          media: NODE.MEDIA.MARKDOWN,
          id: '2',
        }];
        assert.deepEqual(wiki.disconnect(REL.REF.EMBED, '1', 'missing'), true);
        assert.deepEqual(wiki.foreembeds('1'), [{
          media: NODE.MEDIA.MARKDOWN,
          id: '2',
        }]);
      });

    });

  });

});
