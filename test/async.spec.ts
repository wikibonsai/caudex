import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import { NODE, REL } from '../src/const';
import { Base } from '../src/base';
import { Node } from '../src/node';
import { Tree } from '../src/tree';
import { Web } from '../src/web';


const Bonsai = Tree(Base);
const Wiki = Web(Base);
let locky: Base;
let lockyBonsai: any;
let lockyWiki: any;

let data: any;
let fakeConsoleWarn: any;
let stubNanoid: any;

describe('async mutex locking', () => {

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
      const opts: any = {
        thread: {
          safe: true,
        },
        uniqKeys: ['uri', 'filename'],
        zombieKey: 'filename',
      };
      locky = new Base(data, opts);
    });
  
    afterEach(() => {
      fakeConsoleWarn.restore();
      stubNanoid.restore();
    });

    it('base', async () => {
      /* eslint-disable indent */
      const res: boolean | undefined = await locky.lock.acquire()
                                                        .then((release) => {
                                                          const hasNode: boolean = locky.has('1');
                                                          release();
                                                          return hasNode;
                                                        });
      /* eslint-enable indent */
      assert.strictEqual(res, true);
    });

    it('error; did not lock', async () => {
      assert.throws(
        () => locky.has('1'),
        Error('please lock the index to access it'),
      );
    });

    it('wait', async () => {
      // setup
      // add new node
      async function addNode(): Promise<boolean | void> {
        /* eslint-disable indent */
        return locky.lock.acquire()
                          .then(async (release) => {
                            await new Promise((resolve) => setTimeout(resolve, 1000));
                            const addedNode: Node | undefined = locky.add({
                              uri: 'file://data/3',
                              filename: 'three',
                              title: 'Three',
                            }, {
                              id: '3',
                            });
                            release();
                            return (addedNode !== undefined);
                          });
        /* eslint-enable indent */
      }
      // get that new node
      async function getNode(): Promise<Node | undefined> {
        /* eslint-disable indent */
        return locky.lock.acquire()
                          .then((release) => {
                            const node: Node | undefined = locky.get('3');
                            release();
                            return node;
                          });
        /* eslint-enable indent */
      }
      // go
      await Promise.all([addNode(), getNode()]).then((values) => {
        // assert
        assert.strictEqual(values[0], true);
        assert.deepEqual({ ...values[1] }, {
          id: '3',
          kind: NODE.KIND.DOC,
          type: NODE.TYPE.DEFAULT,
          data : {
            uri: 'file://data/3',
            filename: 'three',
            title: 'Three',
          },
          attrs: {},
          children: [],
          links: [],
          embeds: [],
        });
      });
    });

  });

  describe('tree', () => {

    beforeEach(async () => {
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
            id: '4'
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
      const opts = {
        thread: {
          safe: true,
        },
        uniqKeys: ['uri', 'filename'],
        zombieKey: 'filename',
      };
      lockyBonsai = new Bonsai(data, opts);
      // tree-specific setup
      /*     1
        *    |
        *    2 
        *   / \
        *  3   4
        */
      /* eslint-disable indent */
     await lockyBonsai.lock.acquire()
                            .then((release: any) => {
                              lockyBonsai.setRoot('1');
                              lockyBonsai.graft('2', ['one'], 'filename');
                              lockyBonsai.graft('3', ['one', 'two'], 'filename');
                              lockyBonsai.graft('4', ['one', 'two'], 'filename');
                              release();
                            });
      /* eslint-enable indent */
    });
  
    afterEach(() => {
      fakeConsoleWarn.restore();
      stubNanoid.restore();
    });
  
    it('base', async () => {
      /* eslint-disable indent */
      const res: boolean | undefined = await lockyBonsai.lock.acquire()
                                                              .then((release: any) => {
                                                                const nodes: Node[] | undefined = lockyBonsai.lineage('1');
                                                                release();
                                                                return (nodes !== undefined);
                                                              });
      /* eslint-enable indent */
      assert.strictEqual(res, true);
    });
  
    it('error; did not lock', async () => {
      assert.throws(
        () => lockyBonsai.lineage('1'),
        Error('please lock the index to access it'),
      );
    });
  
    it('wait', async () => {
      // setup
      // add new node
      async function graftNode(): Promise<boolean | void> {
        /* eslint-disable indent */
        return lockyBonsai.lock.acquire()
                                .then(async (release: any) => {
                                  await new Promise((resolve) => setTimeout(resolve, 1000));
                                  const graftedNode: Node | undefined = lockyBonsai.graft({
                                    id: '5',
                                    uri: 'file://data/5',
                                    filename: 'five',
                                    title: 'Five',
                                  }, ['one', 'two', 'three', 'four'], 'filename');
                                  release();
                                  return (graftedNode !== undefined);
                                });
        /* eslint-enable indent */
      }
      // get that new node
      async function getNode(): Promise<Node | undefined> {
        /* eslint-disable indent */
        return lockyBonsai.lock.acquire()
                                .then((release: any) => {
                                  const node: Node | undefined = lockyBonsai.get('5');
                                  release();
                                  return node;
                                });
        /* eslint-enable indent */
      }
      // go
      await Promise.all([graftNode(), getNode()]).then((values) => {
        // assert
        assert.strictEqual(values[0], true);
        assert.deepEqual({ ...values[1] }, {
          id: '5',
          kind: NODE.KIND.DOC,
          type: NODE.TYPE.DEFAULT,
          data : {
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
    });
  
  });

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
        }
      ];
      const opts =  {
        thread: {
          safe: true,
        },
        uniqKeys: ['uri', 'filename'],
        zombieKey: 'filename',
      };
      lockyWiki = new Wiki(data, opts);
    });
  
    afterEach(() => {
      fakeConsoleWarn.restore();
      stubNanoid.restore();
    });
  
    it('base', async () => {
      /* eslint-disable indent */
      const res: boolean | undefined = await lockyWiki.lock.acquire()
                                                            .then((release: any) => {
                                                              const nodes: Node[] | undefined = lockyWiki.backlinks('1');
                                                              release();
                                                              return (nodes !== undefined);
                                                            });
      /* eslint-enable indent */
      assert.strictEqual(res, true);
    });
  
    it('error; did not lock', async () => {
      assert.throws(
        () => lockyWiki.backlinks('1'),
        Error('please lock the index to access it'),
      );
    });

    it('wait', async () => {
      // setup
      // connect nodes
      async function connectNode(): Promise<boolean | void> {
        /* eslint-disable indent */
        return lockyWiki.lock.acquire()
                          .then(async (release: any) => {
                            await new Promise((resolve) => setTimeout(resolve, 1000));
                            const connectedNode: Node | undefined = lockyWiki.connect(REL.REF.ATTR, '1', '2', 'attrtype');
                            release();
                            return (connectedNode !== undefined);
                          });
        /* eslint-enable indent */
      }
      // get connected node
      async function getNode(): Promise<Node | undefined> {
        /* eslint-disable indent */
        return lockyWiki.lock.acquire()
                              .then((release: any) => {
                                const node: Node | undefined = lockyWiki.get('1');
                                release();
                                return node;
                              });
        /* eslint-enable indent */
      }
      // go
      const expdNode: Node = new Node('1',
        NODE.KIND.DOC,
        NODE.TYPE.DEFAULT, {
          uri: 'file://data/1',
          filename: 'one',
          title: 'One',
        }
      );
      expdNode.attrs = {
        ['attrtype']: new Set(['2']) // <-- 👍
      };
      await Promise.all([connectNode(), getNode()]).then((values) => {
        // assert
        assert.strictEqual(values[0], true);
        assert.deepEqual(values[1], expdNode);
        // {
        //   id: '1',
        //   kind: NODE.KIND.DOC,
        //   type: NODETYPE.DEFAULT,
        //   data : {
        //     uri: 'file://data/1',
        //     filename: 'one',
        //     title: 'One',
        //   },
        //   attrs: {
        //     'attrtype': new Set(['2']) // <-- 👍
        //   },
        //   children: [],
        //   links: [],
        //   embeds: [],
        // }
        // );
      });
    });
  
  });

});
