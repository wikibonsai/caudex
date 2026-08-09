import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import type { Attrs, Embeds, Links } from '../src/types';
import { NODE, QUERY_TYPE, REL } from '../src/const';
const { LEVEL } = REL;
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

    describe('isolates', () => {

      it('index has isolates', () => {
        assert.deepEqual(wiki.isolates(), ['1', '2', '3', '4']);
      });

      it('index has no isolates', () => {
        wiki.connect('1', '2', REL.REF.LINK, 'link');
        wiki.connect('1', '3', REL.REF.LINK, 'link');
        wiki.connect('1', '4', REL.REF.LINK, 'link');
        assert.deepEqual(wiki.isolates(), []);
      });

      it('with query', () => {
        assert.deepEqual(wiki.isolates({ payload: 'filename' }), ['one', 'two', 'three', 'four']);
      });

    });

    describe('foreattrs / backattrs', () => {

      it('node exists', () => {
        // before
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

      it('filter.header throws', () => {
        assert.throws(
          () => wiki.foreattrs('1', { filter: { header: 'h1' } }),
          /attrs do not support headers/
        );
      });

      it('filter.level HEADER throws', () => {
        assert.throws(
          () => wiki.foreattrs('1', { filter: { level: LEVEL.HEADER } }),
          /attrs do not support headers/
        );
      });

      it('backattrs filter.header throws', () => {
        assert.throws(
          () => wiki.backattrs('2', { filter: { header: 'h1' } }),
          /attrs do not support headers/
        );
      });

      it('with query', () => {
        // before
        wiki.index['1'].attrs['test'] = new Set(['2', '3']);
        assert.deepEqual(wiki.foreattrs('1', { payload: ['id', 'uri', 'filename'] }), {
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
        assert.deepEqual(wiki.backattrs('2', { payload: ['id', 'uri', 'filename'] }), {
          'test': [{
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          }]
        });
        assert.deepEqual(wiki.backattrs('3', { payload: ['id', 'uri', 'filename'] }), {
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
        // before
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

      it('filter.level FILE returns only file-level links', () => {
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't' });
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 's1' });
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 's2' });
        const out = wiki.forelinks('1', { filter: { level: LEVEL.FILE } });
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].header, undefined);
      });

      it('filter.level HEADER returns only header-level links', () => {
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't' });
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 's1' });
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 's2' });
        const out = wiki.forelinks('1', { filter: { level: LEVEL.HEADER } });
        assert.strictEqual(out.length, 2);
        assert.strictEqual(out.every((l: any) => l.header), true);
      });

      it('filter.header returns only matching header', () => {
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 's1' });
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 's2' });
        const out = wiki.forelinks('1', { filter: { header: 's1' } });
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].header, 's1');
      });

      it('backlinks filter.level FILE', () => {
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't' });
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 's1' });
        const out = wiki.backlinks('2', { filter: { level: LEVEL.FILE } });
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].header, undefined);
      });

      it('with query', () => {
        // before
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
        assert.deepEqual(wiki.forelinks('1', { payload: ['id', 'uri', 'filename'] }), [
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
        assert.deepEqual(wiki.backlinks('2', { payload: ['id', 'uri', 'filename'] }), [[
          'test',
          {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          },
        ]]);
        assert.deepEqual(wiki.backlinks('3', { payload: ['id', 'uri', 'filename'] }), [[
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
        // before
        wiki.index['1'].embeds.push({
          id: '2',
        });
        assert.deepEqual(wiki.foreembeds('1'), [{
          id: '2',
        }]);
        assert.deepEqual(wiki.backembeds('2'), [{
          id: '1',
        }]);
      });

      it('node does not exist', () => {
        assert.strictEqual(wiki.foreembeds('-1'), undefined);
        assert.strictEqual(wiki.backembeds('-1'), undefined);
      });

      it('filter.level FILE returns only file-level embeds', () => {
        wiki.connect('1', '2', { kind: REL.REF.EMBED });
        wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'a' });
        wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'b' });
        const out = wiki.foreembeds('1', { filter: { level: LEVEL.FILE } });
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].header, undefined);
      });

      it('filter.level HEADER returns only header-level embeds', () => {
        wiki.connect('1', '2', { kind: REL.REF.EMBED });
        wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'a' });
        wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'b' });
        const out = wiki.foreembeds('1', { filter: { level: LEVEL.HEADER } });
        assert.strictEqual(out.length, 2);
      });

      it('filter.header returns only matching embed', () => {
        wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'a' });
        wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'b' });
        const out = wiki.foreembeds('1', { filter: { header: 'a' } });
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].header, 'a');
      });

      it('with query', () => {
        // before
        wiki.index['1'].embeds = [
          {
            id: '2',
          },
          {
            id: '3',
          },
        ];
        assert.deepEqual(wiki.foreembeds('1', { payload: ['id', 'uri', 'filename'] }), [
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
        assert.deepEqual(wiki.backembeds('2', { payload: ['id', 'uri', 'filename'] }), [
          {
            id: '1',
            uri: 'file://data/1',
            filename: 'one',
          },
        ]);
        assert.deepEqual(wiki.backembeds('3', { payload: ['id', 'uri', 'filename'] }), [
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
        // before
        wiki.index['1'].attrs['test'] = new Set(['2']);
        assert.deepEqual(wiki.neighbors('1'), ['2']);
        assert.deepEqual(wiki.neighbors('2'), ['1']);
      });

      it('node exists; link', () => {
        // before
        wiki.index['1'].links.push({
          type: 'test',
          id: '2',
        });
        assert.deepEqual(wiki.neighbors('1'), ['2']);
        assert.deepEqual(wiki.neighbors('2'), ['1']);
      });

      it('node exists; embed', () => {
        // before
        wiki.index['1'].embeds.push({
          id: '2',
        });
        assert.deepEqual(wiki.neighbors('1'), ['2']);
        assert.deepEqual(wiki.neighbors('2'), ['1']);
      });

      it('node exists; filter; attr', () => {
        // before
        wiki.index['1'].attrs['test'] = new Set(['2']);
        wiki.index['1'].links.push({
          type: 'test',
          id: '3',
        });
        wiki.index['1'].embeds.push({
          id: '4',
        });
        assert.deepEqual(wiki.neighbors('1', REL.REF.ATTR), ['2']);
        assert.deepEqual(wiki.neighbors('2', REL.REF.ATTR), ['1']);
        assert.deepEqual(wiki.neighbors('3', REL.REF.ATTR), []);
        assert.deepEqual(wiki.neighbors('4', REL.REF.ATTR), []);
      });

      it('node exists; filter; link', () => {
        // before
        wiki.index['1'].attrs['test'] = new Set(['2']);
        wiki.index['1'].links.push({
          type: 'test',
          id: '3',
        });
        wiki.index['1'].embeds.push({
          id: '4',
        });
        assert.deepEqual(wiki.neighbors('1', REL.REF.LINK), ['3']);
        assert.deepEqual(wiki.neighbors('2', REL.REF.LINK), []);
        assert.deepEqual(wiki.neighbors('3', REL.REF.LINK), ['1']);
        assert.deepEqual(wiki.neighbors('4', REL.REF.LINK), []);
      });

      it('node exists; filter; embed', () => {
        // before
        wiki.index['1'].attrs['test'] = new Set(['2']);
        wiki.index['1'].links.push({
          type: 'test',
          id: '3',
        });
        wiki.index['1'].embeds.push({
          id: '4',
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

    describe('query opts (filter + payload)', () => {

      describe('filter', () => {

        it('forelinks/backlinks filter.type returns only matching link type', () => {
          wiki.connect('1', '2', { kind: REL.REF.LINK, type: 'is-a' });
          wiki.connect('1', '2', { kind: REL.REF.LINK, type: 'tagged' });
          wiki.connect('1', '3', { kind: REL.REF.LINK, type: 'is-a' });
          assert.strictEqual(wiki.forelinks('1').length, 3);
          const isaLinks = wiki.forelinks('1', { filter: { type: 'is-a' } });
          assert.strictEqual(isaLinks.length, 2);
          assert.ok(isaLinks.some((l: any) => l.id === '2' && l.type === 'is-a'));
          assert.ok(isaLinks.some((l: any) => l.id === '3' && l.type === 'is-a'));
          assert.deepEqual(wiki.forelinks('1', { filter: { type: 'tagged' } }), [{ type: 'tagged', id: '2' }]);
          const backTo2 = wiki.backlinks('2', { filter: { type: 'is-a' } });
          assert.strictEqual(backTo2.length, 1);
          assert.strictEqual(backTo2[0].type, 'is-a');
          assert.strictEqual(backTo2[0].id, '1');
        });

        it('neighbors with filter kind', () => {
          wiki.index['1'].attrs['a'] = new Set(['2']);
          wiki.index['1'].links.push({ type: 't', id: '3' });
          assert.deepEqual(wiki.neighbors('1', { filter: { kind: REL.REF.ATTR } }), ['2']);
          assert.deepEqual(wiki.neighbors('1', { filter: { kind: REL.REF.LINK } }), ['3']);
        });

        it('isolates with filter: filter not applied to isolate set; full list returned', () => {
          // isolates() does not pass filter to all(); which nodes are isolates is unchanged by filter.
          const noFilter = wiki.isolates();
          const withFilter = wiki.isolates({ filter: { filename: 'one' } });
          assert.deepEqual(withFilter, noFilter, 'filter does not restrict which nodes are isolates');
        });

        it('neighbors with filter (non-kind): only filter.kind is used; other filter fields ignored', () => {
          wiki.index['1'].links.push({ type: 't', id: '2' });
          const withKind = wiki.neighbors('1', { filter: { kind: REL.REF.LINK } });
          const withKindAndFilename = wiki.neighbors('1', { filter: { kind: REL.REF.LINK, filename: 'one' } });
          assert.deepEqual(withKindAndFilename, withKind, 'filter.filename (and other non-kind fields) are ignored');
        });

      });

      describe('payload', () => {

        it('foreattrs with payload node', () => {
          wiki.index['1'].attrs['test'] = new Set(['2', '3']);
          const out = wiki.foreattrs('1', { payload: QUERY_TYPE.NODE }) as Record<string, Node[]>;
          assert.deepEqual(Object.keys(out), ['test']);
          assert.strictEqual(out.test.length, 2);
          assert.strictEqual(out.test[0].id, '2');
          assert.strictEqual(out.test[1].id, '3');
        });

        it('foreattrs with payload single key', () => {
          wiki.index['1'].attrs['test'] = new Set(['2']);
          const out = wiki.foreattrs('1', { payload: 'filename' }) as Record<string, any[]>;
          assert.deepEqual(out, { test: ['two'] });
        });

        it('forelinks with payload node', () => {
          wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't' });
          const out = wiki.forelinks('1', { payload: QUERY_TYPE.NODE }) as [any, Node][];
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0][0], 't');
          assert.strictEqual(out[0][1].id, '2');
        });

        it('forelinks with payload single key', () => {
          wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't' });
          const out = wiki.forelinks('1', { payload: 'filename' }) as [any, string][];
          assert.deepEqual(out, [['t', 'two']]);
        });

        it('backlinks with payload string[]', () => {
          wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't' });
          const out = wiki.backlinks('2', { payload: ['id', 'filename'] }) as [any, any][];
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0][0], 't');
          assert.deepEqual(out[0][1], { id: '1', filename: 'one' });
        });

        it('foreembeds with payload id (default)', () => {
          wiki.connect('1', '2', { kind: REL.REF.EMBED });
          assert.deepEqual(wiki.foreembeds('1'), [{ id: '2' }]);
        });

        it('isolates with payload node', () => {
          const out = wiki.isolates({ payload: QUERY_TYPE.NODE }) as Node[];
          assert.strictEqual(out.length, 4);
          assert.strictEqual(out[0].id, '1');
        });

      });

      describe('filter + payload combined', () => {

        it('forelinks filter.level and payload', () => {
          wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't' });
          wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 's1' });
          const fileLevel = wiki.forelinks('1', { filter: { level: LEVEL.FILE }, payload: 'filename' }) as [any, string][];
          assert.strictEqual(fileLevel.length, 1);
          assert.strictEqual(fileLevel[0][1], 'two');
          const headerLevel = wiki.forelinks('1', { filter: { level: LEVEL.HEADER }, payload: 'filename' }) as [any, string][];
          assert.strictEqual(headerLevel.length, 1);
          assert.strictEqual(headerLevel[0][1], 'two');
        });

      });

      describe('links', () => {

        beforeEach(() => {
          wiki.connect('1', '2', { kind: REL.REF.LINK, type: 'cite' });
          wiki.connect('1', '2', { kind: REL.REF.LINK, type: 'cite', header: 'intro' });
          wiki.connect('1', '3', { kind: REL.REF.LINK, type: 'see-also' });
          wiki.connect('1', '3', { kind: REL.REF.LINK, type: 'see-also', header: 'body' });
        });

        it('forelinks filter type', () => {
          const out = wiki.forelinks('1', { filter: { type: 'cite' } });
          assert.strictEqual(out.length, 2);
        });

        it('forelinks filter type and level', () => {
          const out = wiki.forelinks('1', { filter: { type: 'cite', level: LEVEL.HEADER } });
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].header, 'intro');
        });

        it('forelinks filter and payload node', () => {
          const out = wiki.forelinks('1', { filter: { level: LEVEL.FILE }, payload: QUERY_TYPE.NODE }) as [any, Node][];
          assert.strictEqual(out.length, 2);
          assert.ok(out[0][1] && (out[0][1] as Node).id);
        });

        it('forelinks filter header specific', () => {
          const out = wiki.forelinks('1', { filter: { header: 'intro' } });
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].header, 'intro');
        });

        it('forelinks filter header no match', () => {
          assert.deepEqual(wiki.forelinks('1', { filter: { header: 'nonexistent' } }), []);
        });

        it('backlinks filter type', () => {
          const out = wiki.backlinks('2', { filter: { type: 'cite' } });
          assert.strictEqual(out.length, 2);
        });

        it('backlinks filter header specific', () => {
          const out = wiki.backlinks('2', { filter: { header: 'intro' } });
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].header, 'intro');
        });

        it('backlinks filter and payload combined', () => {
          const out = wiki.backlinks('2', { filter: { level: LEVEL.FILE }, payload: 'filename' }) as [any, string][];
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0][0], 'cite');
          assert.strictEqual(out[0][1], 'one');
        });

      });

      describe('embeds', () => {

        beforeEach(() => {
          wiki.connect('1', '2', { kind: REL.REF.EMBED });
          wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'intro' });
          wiki.connect('3', '2', { kind: REL.REF.EMBED, header: 'body' });
        });

        it('backembeds filter level file', () => {
          const out = wiki.backembeds('2', { filter: { level: LEVEL.FILE } });
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].header, undefined);
        });

        it('backembeds filter level header', () => {
          const out = wiki.backembeds('2', { filter: { level: LEVEL.HEADER } });
          assert.strictEqual(out.length, 2);
        });

        it('backembeds filter header specific', () => {
          const out = wiki.backembeds('2', { filter: { header: 'intro' } });
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].header, 'intro');
        });

        it('backembeds filter and payload', () => {
          const out = wiki.backembeds('2', { filter: { level: LEVEL.HEADER }, payload: QUERY_TYPE.NODE }) as any[];
          assert.strictEqual(out.length, 2);
          assert.ok(out[0].id);
        });

      });

      describe('connect disconnect roundtrips', () => {

        it('link header roundtrip', () => {
          assert.strictEqual(wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 'h1' }), true);
          let out = wiki.forelinks('1', { filter: { header: 'h1' } });
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].header, 'h1');
          out = wiki.backlinks('2', { filter: { header: 'h1' } });
          assert.strictEqual(out.length, 1);
          assert.strictEqual(wiki.disconnect('1', '2', { kind: REL.REF.LINK, type: 't', header: 'h1' }), true);
          assert.deepEqual(wiki.forelinks('1', { filter: { header: 'h1' } }), []);
        });

        it('embed header roundtrip', () => {
          assert.strictEqual(wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'h1' }), true);
          let out = wiki.foreembeds('1', { filter: { header: 'h1' } });
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].header, 'h1');
          out = wiki.backembeds('2', { filter: { header: 'h1' } });
          assert.strictEqual(out.length, 1);
          assert.strictEqual(wiki.disconnect('1', '2', { kind: REL.REF.EMBED, header: 'h1' }), true);
          assert.deepEqual(wiki.foreembeds('1', { filter: { header: 'h1' } }), []);
        });

        it('connect file and header disconnect only header', () => {
          wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't' });
          wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 's1' });
          assert.strictEqual(wiki.disconnect('1', '2', { kind: REL.REF.LINK, type: 't', header: 's1' }), true);
          const out = wiki.forelinks('1', { filter: { level: LEVEL.FILE } });
          assert.strictEqual(out.length, 1);
          assert.strictEqual(out[0].header, undefined);
        });

        it('connect attr with header throws', () => {
          assert.throws(
            () => wiki.connect('1', '2', { kind: REL.REF.ATTR, type: 't', header: 'h' }),
            /attrs do not support headers/
          );
        });

      });

      describe('neighbors filter', () => {

        it('neighbors default', () => {
          wiki.index['1'].attrs['a'] = new Set(['2']);
          wiki.index['1'].links.push({ type: 't', id: '3' });
          wiki.index['1'].embeds.push({ id: '4' });
          const out = wiki.neighbors('1') as string[];
          assert.strictEqual(out.length, 3);
          assert.ok(out.includes('2') && out.includes('3') && out.includes('4'));
        });

        it('neighbors filter by kind link', () => {
          wiki.index['1'].attrs['a'] = new Set(['2']);
          wiki.index['1'].links.push({ type: 't', id: '3' });
          wiki.index['1'].embeds.push({ id: '4' });
          assert.deepEqual(wiki.neighbors('1', { filter: { kind: REL.REF.LINK } }), ['3']);
        });

        it('neighbors filter by kind attr', () => {
          wiki.index['1'].attrs['a'] = new Set(['2']);
          wiki.index['1'].links.push({ type: 't', id: '3' });
          assert.deepEqual(wiki.neighbors('1', { filter: { kind: REL.REF.ATTR } }), ['2']);
        });

        it('neighbors filter by kind embed', () => {
          wiki.index['1'].embeds.push({ id: '2' });
          assert.deepEqual(wiki.neighbors('1', { filter: { kind: REL.REF.EMBED } }), ['2']);
        });
      });

      describe('isolates payload', () => {
        it('isolates payload node', () => {
          const out = wiki.isolates({ payload: QUERY_TYPE.NODE }) as Node[];
          assert.strictEqual(out.length, 4);
          assert.strictEqual(out[0].id, '1');
        });

        it('isolates payload data', () => {
          const out = wiki.isolates({ payload: QUERY_TYPE.DATA }) as any[];
          assert.strictEqual(out.length, 4);
          assert.ok(out[0].uri && out[0].filename);
        });

      });

    });

  });

  describe('methods', () => {

    describe('flushRelRefs()', () => {

      it('all; flush refs; delete zombies with no refs', () => {
        // before
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
        // before
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
        // before
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
        assert.deepEqual(wiki.zombies({ payload: QUERY_TYPE.NODE }), [{
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
        // before
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
        assert.deepEqual(wiki.zombies({ payload: QUERY_TYPE.NODE }), [{
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

      it('connect with header throws', () => {
        assert.throws(
          () => wiki.connect('1', '2', { kind: REL.REF.ATTR, type: 't', header: 'h1' }),
          /attrs do not support headers/
        );
      });

      it('create new', () => {
        // go
        assert.strictEqual(wiki.connect('1', '2', REL.REF.ATTR, 'test'), true);
        // after
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
      });

      it('append to type', () => {
        // go
        assert.strictEqual(wiki.connect('1', '2', REL.REF.ATTR, 'test'), true);
        assert.strictEqual(wiki.connect('1', '3', REL.REF.ATTR, 'test'), true);
        // after
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
        // go
        assert.strictEqual(wiki.connect('missing', '2', REL.REF.ATTR, 'test'), false);
        // after
        assert.deepEqual(wiki.backattrs('2'), {});
      });

      it('target node does not exist; create zombie node with data', () => {
        // go
        assert.strictEqual(wiki.connect('1', 'missing', REL.REF.ATTR, 'test'), false);
        // after
        assert.deepEqual(wiki.foreattrs('1'), {});
      });

    });

    describe('connect(); link', () => {

      it('untyped', () => {
        // go
        assert.strictEqual(wiki.connect('1', '2', REL.REF.LINK, ''), true);
        // after
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
        // go
        assert.strictEqual(wiki.connect('1', '2', REL.REF.LINK, 'test'), true);
        // after
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
        // go
        assert.strictEqual(wiki.connect('1', '2', REL.REF.LINK, 'test'), true);
        assert.strictEqual(wiki.connect('1', '3', REL.REF.LINK, 'test'), true);
        // after
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
        // go
        assert.strictEqual(wiki.connect('1', '2', REL.REF.LINK, 'test'), true);
        assert.strictEqual(wiki.connect('1', '2', REL.REF.LINK, 'test'), true);
        // after
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
        // go
        assert.strictEqual(wiki.connect('missing', '2', REL.REF.LINK, 'test'), false);
        // after
        assert.deepEqual(wiki.backlinks('2'), []);
      });

      it('target node does not exist', () => {
        // go
        assert.strictEqual(wiki.connect('1', 'missing', REL.REF.LINK, 'test'), false);
        // after
        assert.deepEqual(wiki.forelinks('1'), []);
      });

      it('header; stores header on link', () => {
        assert.strictEqual(wiki.connect('1', '2', { kind: REL.REF.LINK, type: 'test', header: 'section-a' }), true);
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'test',
          id: '2',
          header: 'section-a',
        }]);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'test',
          header: 'section-a',
          id: '1',
        }]);
      });

      it('header; same target different headers are separate links', () => {
        assert.strictEqual(wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 'a' }), true);
        assert.strictEqual(wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 'b' }), true);
        assert.strictEqual(wiki.forelinks('1').length, 2);
        assert.deepEqual(wiki.forelinks('1'), [
          { type: 't', id: '2', header: 'a' },
          { type: 't', id: '2', header: 'b' },
        ]);
      });

      it('header; file-level and header-level both stored', () => {
        assert.strictEqual(wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't' }), true);
        assert.strictEqual(wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 's1' }), true);
        assert.strictEqual(wiki.forelinks('1').length, 2);
        const links = wiki.forelinks('1');
        assert.strictEqual(links.some((l: any) => !l.header), true);
        assert.strictEqual(links.some((l: any) => l.header === 's1'), true);
      });

    });

    describe('connect(); embed', () => {

      it('media kinds; media-absence = doc-embed, real kinds validate, junk rejected', () => {
        // doc-embed: no media arg -> media-absent embed
        assert.strictEqual(wiki.connect('1', '2', REL.REF.EMBED), true);
        assert.deepEqual(wiki.index['1'].embeds, [{ id: '2' }]);
        // media-embed: explicit real kind
        assert.strictEqual(wiki.connect('1', '3', REL.REF.EMBED, NODE.MEDIA.IMAGE), true);
        assert.deepEqual(wiki.index['1'].embeds, [{ id: '2' }, { id: '3', media: NODE.MEDIA.IMAGE }]);
        // invalid media kind rejected ('markdown' is no longer a media kind)
        assert.strictEqual(wiki.connect('1', '4', REL.REF.EMBED, 'markdown'), false);
        assert.strictEqual(fakeConsoleWarn.calledWith('invalid media kind: markdown'), true);
      });

      it('base', () => {
        // go
        assert.strictEqual(wiki.connect('1', '2', REL.REF.EMBED), true);
        // after
        assert.deepEqual(wiki.foreembeds('1'), [{
          id: '2',
        }]);
        assert.deepEqual(wiki.backembeds('2'), [{
          id: '1',
        }]);
      });

      it('multiples all saved', () => {
        // go
        assert.strictEqual(wiki.connect('1', '2', REL.REF.EMBED), true);
        assert.strictEqual(wiki.connect('1', '3', REL.REF.EMBED), true);
        // after
        assert.deepEqual(wiki.foreembeds('1'), [{
          id: '2',
        },{
          id: '3',
        }]);
        assert.deepEqual(wiki.backembeds('2'), [{
          id: '1',
        }]);
        assert.deepEqual(wiki.backembeds('3'), [{
          id: '1',
        }]);
      });

      it('do not store duplicates', () => {
        // go
        assert.strictEqual(wiki.connect('1', '2', REL.REF.EMBED), true);
        assert.strictEqual(wiki.connect('1', '2', REL.REF.EMBED), true);
        // after
        assert.deepEqual(wiki.foreembeds('1'), [{
          id: '2',
        }]);
        assert.deepEqual(wiki.backembeds('2'), [{
          id: '1',
        }]);
        assert.deepEqual(wiki.backembeds('3'), []);
      });

      it('source node does not exist', () => {
        // go
        assert.strictEqual(wiki.connect('missing', '2', REL.REF.EMBED), false);
        // after
        assert.deepEqual(wiki.backembeds('2'), []);
      });

      it('target node does not exist', () => {
        // go
        assert.strictEqual(wiki.connect('1', 'missing', REL.REF.EMBED), false);
        // after
        assert.deepEqual(wiki.foreembeds('1'), []);
      });

      it('header; stores header on embed', () => {
        assert.strictEqual(wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'intro' }), true);
        assert.deepEqual(wiki.foreembeds('1'), [{
          id: '2',
          header: 'intro',
        }]);
        assert.deepEqual(wiki.backembeds('2'), [{
          id: '1',
          header: 'intro',
        }]);
      });

      it('header; same target different headers are separate embeds', () => {
        assert.strictEqual(wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'a' }), true);
        assert.strictEqual(wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'b' }), true);
        assert.strictEqual(wiki.foreembeds('1').length, 2);
        assert.deepEqual(wiki.foreembeds('1'), [
          { id: '2', header: 'a' },
          { id: '2', header: 'b' },
        ]);
      });

    });

    describe('retype(); ref', () => {

      it('base; retypes both all ref kinds', () => {
        // before
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
        // before
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
        // before
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
        // before
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
        // before
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
        // before
        wiki.index['1'].attrs['test'] = new Set(['2']);
        // before rm
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
        // rm
        assert.strictEqual(wiki.disconnect('1', '2', REL.REF.ATTR, 'test'), true);
        // after rm
        assert.deepEqual(wiki.foreattrs('1'), {});
        assert.deepEqual(wiki.backattrs('2'), {});
      });

      it('base; rm single id from attribute', () => {
        // before
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
        assert.strictEqual(wiki.disconnect('1', '2', REL.REF.ATTR, 'test'), true);
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
        // before
        wiki.index['1'].attrs['test'] = new Set(['2']);
        // rm
        assert.strictEqual(wiki.disconnect('missing', '2', REL.REF.ATTR, 'test'), false);
        assert.deepEqual(wiki.foreattrs('1'), {
          'test': new Set(['2']),
        });
        assert.deepEqual(wiki.backattrs('2'), {
          'test': new Set(['1']),
        });
      });

      it('target node does not exist', () => {
        // before
        wiki.index['1'].attrs['test'] = new Set(['2']);
        // rm
        assert.strictEqual(wiki.disconnect('1', 'missing', REL.REF.ATTR, 'test'), false);
        // after
        assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'target node with id "missing" not found');
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
        // before
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
        assert.strictEqual(wiki.disconnect('1', '2', REL.REF.LINK, ''), true);
        // after rm
        assert.deepEqual(wiki.forelinks('1'), []);
        assert.deepEqual(wiki.backlinks('2'), []);
      });

      it('untyped (explicit)', () => {
        // before
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
        assert.strictEqual(wiki.disconnect('1', '2', REL.REF.LINK, ''), true);
        // after rm
        assert.deepEqual(wiki.forelinks('1'), []);
        assert.deepEqual(wiki.backlinks('2'), []);
      });

      // todo: try to move a typed link without specifying the type

      it('typed', () => {
        // before
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
        assert.strictEqual(wiki.disconnect('1', '2', REL.REF.LINK, 'test'), true);
        // after rm
        assert.deepEqual(wiki.forelinks('1'), []);
        assert.deepEqual(wiki.backlinks('2'), []);
      });

      it('source node does not exist', () => {
        // before
        wiki.index['1'].links = [{
          type: 'test',
          id: '2',
        }];
        assert.strictEqual(wiki.disconnect('missing', '2', REL.REF.LINK, 'test'), false);
        assert.deepEqual(wiki.backlinks('2'), [{
          type: 'test',
          id: '1',
        }]);
      });

      it('target node does not exist', () => {
        // before
        wiki.index['1'].links = [{
          type: 'test',
          id: '2',
        }];
        // go
        assert.strictEqual(wiki.disconnect('1', 'missing', REL.REF.LINK, 'test'), false);
        // after
        assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'target node with id "missing" not found');
        assert.deepEqual(wiki.forelinks('1'), [{
          type: 'test',
          id: '2',
        }]);
      });

      it('header; removes only the matching header link', () => {
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 'a' });
        wiki.connect('1', '2', { kind: REL.REF.LINK, type: 't', header: 'b' });
        assert.strictEqual(wiki.disconnect('1', '2', { kind: REL.REF.LINK, type: 't', header: 'a' }), true);
        assert.deepEqual(wiki.forelinks('1'), [{ type: 't', id: '2', header: 'b' }]);
      });

    });

    describe('disconnect(); embed', () => {

      it('base (implicit)', () => {
        // before
        wiki.index['1'].embeds = [{
          id: '2',
        }];
        // before rm
        assert.deepEqual(wiki.foreembeds('1'), [{
          id: '2',
        }]);
        assert.deepEqual(wiki.backembeds('2'), [{
          id: '1',
        }]);
        // rm
        assert.strictEqual(wiki.disconnect('1', '2', REL.REF.EMBED), true);
        // after rm
        assert.deepEqual(wiki.foreembeds('1'), []);
        assert.deepEqual(wiki.backembeds('2'), []);
      });

      it('source node does not exist', () => {
        // before
        wiki.index['1'].embeds = [{
          id: '2',
        }];
        assert.strictEqual(wiki.disconnect('missing', '2', REL.REF.EMBED), false);
        assert.deepEqual(wiki.backembeds('2'), [{
          id: '1',
        }]);
      });

      it('target node does not exist', () => {
        // before
        wiki.index['1'].embeds = [{
          id: '2',
        }];
        // go
        assert.strictEqual(wiki.disconnect('1', 'missing', REL.REF.EMBED), false);
        // after
        assert.strictEqual(fakeConsoleWarn.getCall(0).args[0], 'target node with id "missing" not found');
        assert.deepEqual(wiki.foreembeds('1'), [{
          id: '2',
        }]);
      });

      it('header; removes only the matching header embed', () => {
        wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'x' });
        wiki.connect('1', '2', { kind: REL.REF.EMBED, header: 'y' });
        assert.strictEqual(wiki.disconnect('1', '2', { kind: REL.REF.EMBED, header: 'x' }), true);
        assert.deepEqual(wiki.foreembeds('1'), [{ id: '2', header: 'y' }]);
      });

    });

  });

});
