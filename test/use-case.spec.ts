import assert from 'node:assert';
import sinon from 'sinon';

import nanoid from 'nanoid';

import type { Attrs, Embeds, Links } from '../src/types';
import { create, Node, NODE, EDGE } from '../src/index';


// use-case / workflow map
//
// this suite is intentionally written as a self-documenting map of the
// caudex operations a wiki-style PKM (with semtree support) is expected to
// perform for each common "file operation" a user takes in their vault.
//
// the mental model:
//   - a "file" in the vault === a 'doc' node in the caudex.
//   - references (wikilinks / caml attrs / embeds) between files are stored
//     by node *id* (pointer-like), NOT by filename. this is the single most
//     important property to keep in mind when reasoning about these flows:
//     because references point at ids, renaming a file does not break the
//     references that point at it.
//   - the semtree (hierarchical index) === the 'tree' portion (children /
//     parent / graft / prune / transplant).
//
// each 'describe' below maps a user-facing file operation to the caudex
// operation(s) that keep the index consistent.

let data: any;
let wb: any;
let fakeConsoleWarn: any;
let stubNanoid: any;

// data payload for a brand-new file (a doc that does not yet exist in the index)
const newFileData = {
  uri: 'file://data/5',
  filename: 'five',
  title: 'Five',
};

describe('use-case', () => {

  beforeEach(() => {
    console.warn = (msg) => msg + '\n';
    fakeConsoleWarn = sinon.spy(console, 'warn');
    // 'add(<string>)' generates a zombie id via nanoid; stub it for determinism
    stubNanoid = sinon.stub(nanoid, 'nanoid').returns('404');
    // a small vault of four existing files
    data = [
      {
        init: { id: '1' },
        data: { uri: 'file://data/1', filename: 'one', title: 'One' },
      },
      {
        init: { id: '2' },
        data: { uri: 'file://data/2', filename: 'two', title: 'Two' },
      },
      {
        init: { id: '3' },
        data: { uri: 'file://data/3', filename: 'three', title: 'Three' },
      },
      {
        init: { id: '4' },
        data: { uri: 'file://data/4', filename: 'four', title: 'Four' },
      },
    ];
    const opts: any = {
      uniqKeys: ['uri', 'filename'],
      zombieKey: 'filename',
    };
    wb = create(data, opts);
    // the semtree / index rooted at 'one':
    //    1
    //   / \
    //  2   3
    //  |
    //  4
    wb.setRoot('1');
    wb.graft('1', '2');
    wb.graft('1', '3');
    wb.graft('2', '4');
  });

  afterEach(() => {
    fakeConsoleWarn.restore();
    stubNanoid.restore();
  });

  // ---------------------------------------------------------------------------
  // file creation
  //
  // creating a file in the vault === adding a 'doc' node to the index.
  // ---------------------------------------------------------------------------

  describe('create a file', () => {

    it('adds a doc node to the index', () => {
      // user creates `five.md`
      const node: Node | undefined = wb.add(newFileData, { id: '5' });
      // a doc node now exists...
      if (!node) { assert.fail('expected a node to be created'); }
      assert.strictEqual(node.kind, NODE.KIND.DOC);
      assert.strictEqual(node.type, NODE.TYPE.DEFAULT);
      assert.strictEqual(wb.has('5'), true);
      // ...and is retrievable by its unique data keys
      assert.strictEqual(wb.find('filename', 'five')?.id, '5');
      assert.strictEqual(wb.find('uri', 'file://data/5')?.id, '5');
    });

    it('a newly created file starts with no relationships (an isolate)', () => {
      wb.add(newFileData, { id: '5' });
      // not yet placed in the semtree...
      assert.strictEqual(wb.parent('5'), '');
      assert.deepEqual(wb.children('5'), []);
      // ...and not yet referenced anywhere in the web
      assert.deepEqual(wb.neighbors('5'), []);
      // -> connected to nothing on either axis
      assert.strictEqual(wb.get('5').phase(), NODE.PHASE.ISOLATE);
    });

    it('rejects a duplicate file (unique key collision)', () => {
      // creating a second file with an already-used filename/uri fails validation
      const dupe: Node | undefined = wb.add({ uri: 'file://data/1', filename: 'one', title: 'Dupe' });
      assert.strictEqual(dupe, undefined);
    });

  });

  // ---------------------------------------------------------------------------
  // place a file in the semtree
  //
  // the index / semtree is a separate concern from the file existing: a doc
  // must be grafted into the tree to gain a position in the hierarchy.
  // ---------------------------------------------------------------------------

  describe('place a file in the semtree (index)', () => {

    it('grafts a new doc under a parent', () => {
      wb.add(newFileData, { id: '5' });
      // user adds `- [[five]]` under `three` in the index doc
      assert.strictEqual(wb.graft('3', '5'), true);
      assert.strictEqual(wb.parent('5'), '3');
      assert.deepEqual(wb.children('3'), ['5']);
      // ancestry now walks back to root
      assert.deepEqual(wb.ancestors('5'), ['1', '3']);
    });

    it('reorders siblings within an index via transplant', () => {
      // give 'two' a second child so there is an order to change
      wb.add(newFileData, { id: '5' });
      wb.graft('2', '5');
      assert.deepEqual(wb.children('2'), ['4', '5']);
      // user reorders the list under `two` in the index doc: 4,5 -> 5,4
      assert.strictEqual(wb.transplant('2', [{ id: '2', children: ['5', '4'] }]), true);
      assert.deepEqual(wb.children('2'), ['5', '4']);
    });

  });

  // ---------------------------------------------------------------------------
  // move a file within the semtree
  //
  // moving a node's position in the tree === prune from the old parent + graft
  // to the new parent. leaf moves and subtree moves differ only in `force`.
  // ---------------------------------------------------------------------------

  describe('move a file within the semtree', () => {

    it('moves a leaf node to a new parent (prune + graft)', () => {
      // move `four` from under `two` to under `three`
      assert.strictEqual(wb.prune('2', '4'), true);
      assert.strictEqual(wb.graft('3', '4'), true);
      assert.strictEqual(wb.parent('4'), '3');
      assert.deepEqual(wb.children('2'), []);
      assert.deepEqual(wb.children('3'), ['4']);
    });

    it('moves an entire subtree to a new parent (force prune + graft)', () => {
      // `two` has a child (`four`), so it is not a leaf -- force the prune,
      // then graft the whole subtree elsewhere. the subtree stays intact.
      assert.strictEqual(wb.prune('1', '2', true), true);
      assert.strictEqual(wb.graft('3', '2'), true);
      assert.strictEqual(wb.parent('2'), '3');
      assert.deepEqual(wb.children('2'), ['4']); // subtree preserved
      assert.deepEqual(wb.descendants('3'), ['2', '4']);
    });

    it('swaps a placeholder node for a real doc in the tree (replace)', () => {
      // `two` occupies a slot (with child `four`); the real doc `five` should
      // take that exact position and inherit its children.
      wb.add(newFileData, { id: '5' });
      assert.strictEqual(wb.replace('2', '5'), true);
      assert.strictEqual(wb.parent('5'), '1');    // took two's slot under root
      assert.deepEqual(wb.children('5'), ['4']);  // inherited two's children
      assert.strictEqual(wb.parent('2'), '');     // two is now out of the tree
    });

  });

  // ---------------------------------------------------------------------------
  // prune a file from the semtree (without deleting the file)
  //
  // removing a doc from the index === prune from its parent. the file still
  // exists (still a doc node in the caudex) -- it just loses its tree position
  // (see "the phase 2x2" below for where it lands).
  // ---------------------------------------------------------------------------

  describe('prune a file from semtree', () => {

    it('removes a leaf doc from the index; the unreferenced file becomes an isolate', () => {
      // user deletes the `- [[four]]` bullet from `two`'s index, but keeps four.md
      assert.strictEqual(wb.prune('2', '4'), true);
      // still a real doc in the caudex...
      assert.strictEqual(wb.has('4'), true);
      assert.strictEqual(wb.get('4')?.kind, NODE.KIND.DOC);
      // ...but no longer positioned in the tree
      assert.strictEqual(wb.parent('4'), '');
      assert.deepEqual(wb.children('2'), []);
      // nothing references it in the web either -> connected to nothing at all
      assert.strictEqual(wb.get('4').phase(), NODE.PHASE.ISOLATE);
    });

    it('refuses to prune a non-leaf without force (would strand its subtree)', () => {
      // `two` still has child `four`, so a plain prune is rejected...
      assert.strictEqual(wb.prune('1', '2'), false);
      assert.strictEqual(wb.parent('2'), '1'); // unchanged
      // ...force lifts the guard and detaches the whole subtree intact
      assert.strictEqual(wb.prune('1', '2', true), true);
      assert.strictEqual(wb.parent('2'), '');
      // NOTE: relational children() walks from the root, so a DETACHED subtree
      // reads as empty until it is re-grafted -- the structure isn't lost though,
      // it is retained on the node's own children array.
      assert.deepEqual(wb.children('2'), []);           // unreachable from root
      assert.deepEqual(wb.get('2')?.children, ['4']);   // ...but retained on the node
    });

  });

  // ---------------------------------------------------------------------------
  // link files together (wikirefs)
  //
  // adding a `[[wikilink]]` from one file to another === connect(..., LINK).
  // links are stored on the *source* node, keyed by the *target* node id.
  // ---------------------------------------------------------------------------

  describe('add a wikilink between files', () => {

    it('connects source -> target as a link', () => {
      // user types `[[two]]` inside `one.md`
      assert.strictEqual(wb.connect('1', '2', EDGE.KIND.LINK, 'linktype'), true);
      // forelinks live on the source
      assert.deepEqual(wb.forelinks('1'), [{ type: 'linktype', id: '2' }] as Links);
      // backlinks are resolvable from the target
      assert.deepEqual(wb.backlinks('2'), [{ type: 'linktype', id: '1' }] as Links);
      // and the two files are now neighbors in the web
      assert.deepEqual(wb.neighbors('2'), ['1']);
    });

    it('supports header-level links', () => {
      // `[[two#section]]`
      assert.strictEqual(wb.connect('1', '2', { kind: EDGE.KIND.LINK, type: 'linktype', header: 'section' }), true);
      assert.deepEqual(wb.backlinks('2'), [{ type: 'linktype', id: '1', header: 'section' }] as Links);
    });

  });

  describe('remove a wikilink between files', () => {

    it('disconnects the link', () => {
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      // user deletes the `[[two]]` text from `one.md`
      assert.strictEqual(wb.disconnect('1', '2', EDGE.KIND.LINK, 'linktype'), true);
      assert.deepEqual(wb.forelinks('1'), [] as Links);
      assert.deepEqual(wb.backlinks('2'), [] as Links);
    });

  });

  // ---------------------------------------------------------------------------
  // back-view freshness across mutations
  //
  // the back-views (backlinks / backattrs / backembeds) must reflect the CURRENT
  // forward refs after any mutation -- i.e. a back-view read, then a mutation,
  // then a re-read must show the change. (this is the property an inverse-ref
  // cache has to preserve: a mutation must never leave a stale back-view.)
  // ---------------------------------------------------------------------------

  describe('back-views stay fresh across mutations', () => {

    it('a newly connected source appears in a re-read of backlinks', () => {
      // read backlinks BEFORE the new link exists...
      assert.deepEqual(wb.backlinks('2'), [] as Links);
      // ...user adds `[[two]]` in `one.md`...
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      // ...the re-read now includes it (no stale empty result)
      assert.deepEqual(wb.backlinks('2'), [{ type: 'linktype', id: '1' }] as Links);
    });

    it('a disconnected source drops out of a re-read of backlinks', () => {
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      wb.connect('3', '2', EDGE.KIND.LINK, 'linktype');
      // read with both sources present...
      assert.deepEqual(wb.backlinks('2'), [
        { type: 'linktype', id: '1' },
        { type: 'linktype', id: '3' },
      ] as Links);
      // ...remove one...
      wb.disconnect('1', '2', EDGE.KIND.LINK, 'linktype');
      // ...only the remaining source is reported
      assert.deepEqual(wb.backlinks('2'), [{ type: 'linktype', id: '3' }] as Links);
    });

  });

  // ---------------------------------------------------------------------------
  // multiple referrers to one target
  //
  // a target commonly has many incoming refs. backlinks() reports them in index
  // order; backattrs() aggregates them per type into a single Set.
  // ---------------------------------------------------------------------------

  describe('a target referenced by several files', () => {

    it('backlinks lists every referrer, in index order', () => {
      // connect out of index order (3 before 1) to prove the result follows
      // index order, not connect order
      wb.connect('3', '2', EDGE.KIND.LINK, 'linktype');
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      assert.deepEqual(wb.backlinks('2'), [
        { type: 'linktype', id: '1' },
        { type: 'linktype', id: '3' },
      ] as Links);
    });

    it('backattrs aggregates every referrer of a type into one Set', () => {
      wb.connect('1', '2', EDGE.KIND.ATTR, 'tags');
      wb.connect('3', '2', EDGE.KIND.ATTR, 'tags');
      assert.deepEqual(wb.backattrs('2'), { tags: new Set(['1', '3']) } as Attrs);
    });

    it('backembeds lists every embedder, and clears when they are removed', () => {
      wb.connect('1', '2', EDGE.KIND.EMBED);
      wb.connect('3', '2', EDGE.KIND.EMBED);
      assert.deepEqual(wb.backembeds('2'), [
        { id: '1' },
        { id: '3' },
      ] as Embeds);
      // remove one embedder's refs (as an edit-body flush would)
      wb.flushWeb('1');
      assert.deepEqual(wb.backembeds('2'), [{ id: '3' }] as Embeds);
    });

  });

  // ---------------------------------------------------------------------------
  // neighbors spans both directions and all three ref kinds
  //
  // neighbors() is the building block for isolates(); it must union a node's
  // outgoing refs with its incoming refs across links, attrs, and embeds.
  // ---------------------------------------------------------------------------

  describe('neighbors span both directions and every ref kind', () => {

    it('unions outbound + inbound across link, attr, and embed', () => {
      wb.connect('2', '3', EDGE.KIND.LINK, 'linktype');  // 2 -> 3 (outbound link)
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');  // 1 -> 2 (inbound link)
      wb.connect('2', '4', EDGE.KIND.ATTR, 'tags');      // 2 -> 4 (outbound attr)
      wb.connect('1', '2', EDGE.KIND.EMBED);             // 1 -> 2 (inbound embed)
      // every counterpart, either direction, is a neighbor of `2`
      assert.deepEqual(new Set(wb.neighbors('2')), new Set(['1', '3', '4']));
    });

  });

  // ---------------------------------------------------------------------------
  // attributes (caml) and embeds
  //
  // caml `: key :: [[value]]` === connect(..., ATTR, key).
  // `![[embed]]` === connect(..., EMBED).
  // ---------------------------------------------------------------------------

  describe('add a caml attribute between files', () => {

    it('connects source -> target as a typed attr', () => {
      // `: tags :: [[two]]` inside `one.md`
      assert.strictEqual(wb.connect('1', '2', EDGE.KIND.ATTR, 'tags'), true);
      assert.deepEqual(wb.foreattrs('1'), { tags: new Set(['2']) } as Attrs);
      assert.deepEqual(wb.backattrs('2'), { tags: new Set(['1']) } as Attrs);
    });

  });

  describe('add an embed between files', () => {

    it('connects source -> target as an embed', () => {
      // `![[two]]` inside `one.md`
      assert.strictEqual(wb.connect('1', '2', EDGE.KIND.EMBED), true);
      assert.deepEqual(wb.foreembeds('1'), [{ id: '2' }] as Embeds);
      assert.deepEqual(wb.backembeds('2'), [{ id: '1' }] as Embeds);
    });

  });

  // ---------------------------------------------------------------------------
  // edit a file's body (re-sync its outgoing refs)
  //
  // this is the primary incremental-update path in the real apps. when a file
  // is saved, its outgoing references are not diffed one-by-one -- instead the
  // node's title/headers are re-`edit()`ed, ALL of its forward refs are cleared
  // with `flushWeb(id)`, and then the refs currently in the file are
  // re-`connect()`ed. (see tendr-app caudex.ts updateFile + vscode-tendr
  // MarkdownProvider refreshRelRefs.) removing a link is therefore usually a
  // side effect of this flush+reconnect, not a standalone `disconnect()`.
  // ---------------------------------------------------------------------------

  describe('edit a file body (flush + reconnect its refs)', () => {

    it('rebuilds a node\'s forward refs to match the saved file', () => {
      // before: `one.md` linked `[[two]]`
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      // user saves `one.md` after swapping `[[two]]` for `[[three]]` + `: tags :: [[four]]`
      wb.edit('1', 'title', 'One (edited)');
      assert.strictEqual(wb.flushWeb('1'), true);      // clear all old forward refs
      wb.connect('1', '3', EDGE.KIND.LINK, 'linktype');       // reconnect what the file now says
      wb.connect('1', '4', EDGE.KIND.ATTR, 'tags');
      // the stale link is gone...
      assert.deepEqual(wb.backlinks('2'), [] as Links);
      // ...and the new refs are live in both directions
      assert.deepEqual(wb.forelinks('1'), [{ type: 'linktype', id: '3' }] as Links);
      assert.deepEqual(wb.backlinks('3'), [{ type: 'linktype', id: '1' }] as Links);
      assert.deepEqual(wb.foreattrs('1'), { tags: new Set(['4']) } as Attrs);
    });

    it('cleans up a zombie target that loses its last referrer on flush', () => {
      // `one.md` links `[[ghost]]` (a dangling link -> zombie)
      const zombie: Node | undefined = wb.add('ghost');
      if (!zombie) { assert.fail('expected a zombie node'); }
      wb.connect('1', zombie.id, EDGE.KIND.LINK, 'linktype');
      assert.deepEqual(wb.zombies(), [zombie.id]);
      // user saves `one.md` with the `[[ghost]]` link removed -> flush drops the
      // now-unreferenced zombie so it does not linger in the index
      wb.flushWeb('1');
      assert.deepEqual(wb.zombies(), []);
      assert.strictEqual(wb.has(zombie.id), false);
    });

  });

  // ---------------------------------------------------------------------------
  // rename a file
  //
  // KEY PROPERTY: references are stored by node id, not filename. renaming a
  // file is an in-place data edit that keeps the same node id, so every
  // reference pointing at it stays valid automatically -- there is no need to
  // rewrite backrefs in the index. (rewriting the `[[wikilink]]` *text* in the
  // referencing markdown files is a separate, downstream concern.)
  // ---------------------------------------------------------------------------

  describe('rename a file', () => {

    it('edits the node data in place; the node id is stable', () => {
      // `two` is linked from `one`
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      // user renames `two.md` -> `second.md`
      assert.strictEqual(wb.edit('2', 'filename', 'second'), true);
      assert.strictEqual(wb.edit('2', 'uri', 'file://data/second'), true);
      assert.strictEqual(wb.edit('2', 'title', 'Second'), true);
      // lookups follow the new name; the old name no longer resolves
      assert.strictEqual(wb.find('filename', 'second')?.id, '2');
      assert.strictEqual(wb.find('filename', 'two'), undefined);
    });

    it('preserves backrefs across the rename (they point at the stable id)', () => {
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      assert.deepEqual(wb.backlinks('2'), [{ type: 'linktype', id: '1' }] as Links);
      // rename...
      wb.edit('2', 'filename', 'second');
      // ...backlinks are untouched because they reference id '2', not 'two'
      assert.deepEqual(wb.backlinks('2'), [{ type: 'linktype', id: '1' }] as Links);
    });

    it('preserves the semtree position across the rename', () => {
      // `four` keeps its place under `two` after being renamed
      assert.strictEqual(wb.parent('4'), '2');
      wb.edit('4', 'filename', 'fourth');
      assert.strictEqual(wb.parent('4'), '2');
    });

    it('renaming onto an already-referenced name folds in the existing zombie', () => {
      // a dangling `[[ghost]]` link already exists (from `one.md`), so a zombie
      // holds ghost's identity and its inbound backlink.
      const zombie: Node | undefined = wb.add('ghost');
      if (!zombie) { assert.fail('expected a zombie node'); }
      wb.connect('1', zombie.id, EDGE.KIND.LINK, 'linktype'); // one -> [[ghost]]
      wb.connect('2', '3', EDGE.KIND.LINK, 'mentions');       // two -> [[three]]
      // user renames `two.md` -> `ghost.md`. rather than orphan the pre-existing
      // `[[ghost]]` backlink, the real doc is folded INTO the zombie (which keeps
      // its id, and therefore its inbound refs). (see vscode-tendr handleRename.)
      wb.fill(zombie.id, { uri: 'file://data/ghost', filename: 'ghost', title: 'Ghost' });
      wb.transfer('2', zombie.id);  // move two's outgoing refs onto the (now real) ghost
      wb.replace('2', zombie.id);   // move two's tree slot + children onto ghost
      assert.strictEqual(wb.rm('2'), true); // retire the old node
      // the old node is gone; ghost is now a real doc
      assert.strictEqual(wb.has('2'), false);
      assert.strictEqual(wb.get(zombie.id)?.kind, NODE.KIND.DOC);
      // the pre-existing inbound backlink survived the rename (stable zombie id)...
      assert.deepEqual(wb.backlinks(zombie.id), [{ type: 'linktype', id: '1' }] as Links);
      // ...two's outgoing refs and tree position now belong to ghost
      assert.deepEqual(wb.forelinks(zombie.id), [{ type: 'mentions', id: '3' }] as Links);
      assert.strictEqual(wb.parent(zombie.id), '1');
      assert.deepEqual(wb.children(zombie.id), ['4']);
    });

  });

  // ---------------------------------------------------------------------------
  // rename a *reftype* (not a file)
  //
  // renaming a caml key or a attr/link type across the whole vault === retype().
  // ---------------------------------------------------------------------------

  describe('rename a reftype across the vault', () => {

    it('retypes an attr key everywhere it appears', () => {
      wb.connect('1', '2', EDGE.KIND.ATTR, 'tags');
      wb.connect('3', '2', EDGE.KIND.ATTR, 'tags');
      // user renames the caml key `tags` -> `topics` project-wide
      assert.strictEqual(wb.retype('tags', 'topics', EDGE.KIND.ATTR), true);
      assert.deepEqual(wb.foreattrs('1'), { topics: new Set(['2']) } as Attrs);
      assert.deepEqual(wb.foreattrs('3'), { topics: new Set(['2']) } as Attrs);
      assert.deepEqual([...wb.attrtypes()], ['topics']);
      // the back-view reflects the new key too (not the stale `tags`)
      assert.deepEqual(wb.backattrs('2'), { topics: new Set(['1', '3']) } as Attrs);
    });

    it('retypes a link type everywhere it appears', () => {
      wb.connect('1', '2', EDGE.KIND.LINK, 'rel');
      assert.strictEqual(wb.retype('rel', 'relates', EDGE.KIND.LINK), true);
      assert.deepEqual(wb.forelinks('1'), [{ type: 'relates', id: '2' }] as Links);
      // the back-view carries the new type
      assert.deepEqual(wb.backlinks('2'), [{ type: 'relates', id: '1' }] as Links);
    });

  });

  // ===========================================================================
  // state & phase (TERMS.md)
  //
  //   state -- whether the document EXISTS: zombie -> live. a dangling
  //     `[[link]]` is a zombie; zombies are gated out of the phase cells entirely.
  //   phase -- tree x web attachment, one EXCLUSIVE cell per live doc:
  //
  //                    in web        not in web
  //     in tree      integrated     spur
  //     not in tree    orphan         isolate
  //
  // a brand-new, unplaced, unreferenced file is an isolate; graft it and it's a
  // spur; link it instead and it's an orphan; do both and it's integrated.
  // ===========================================================================

  describe('create a dangling link (zombie)', () => {

    it('spawns a zombie node that can be referenced', () => {
      // user types `[[ghost]]` in `one.md` but `ghost.md` does not exist
      const zombie: Node | undefined = wb.add('ghost');
      if (!zombie) { assert.fail('expected a zombie node'); }
      assert.strictEqual(zombie.state(), NODE.STATE.ZOMBIE);
      wb.connect('1', zombie.id, EDGE.KIND.LINK, 'linktype');
      // the zombie is tracked and carries the backref
      assert.deepEqual(wb.zombies(), [zombie.id]);
      assert.deepEqual(wb.backlinks(zombie.id), [{ type: 'linktype', id: '1' }] as Links);
    });

  });

  describe('resolve a zombie (the file finally gets created)', () => {

    it('fills the zombie in place; the id and its backrefs are preserved', () => {
      const zombie: Node | undefined = wb.add('ghost');
      if (!zombie) { assert.fail('expected a zombie node'); }
      wb.connect('1', zombie.id, EDGE.KIND.LINK, 'linktype');
      // user creates `ghost.md`: fill the existing zombie rather than adding anew,
      // so the pre-existing backref survives (same id).
      const filled: Node | undefined = wb.fill(zombie.id, {
        uri: 'file://data/ghost',
        filename: 'ghost',
        title: 'Ghost',
      });
      if (!filled) { assert.fail('expected the zombie to be filled'); }
      assert.strictEqual(filled.kind, NODE.KIND.DOC);
      assert.deepEqual(wb.zombies(), []); // no longer a zombie
      assert.deepEqual(wb.backlinks(zombie.id), [{ type: 'linktype', id: '1' }] as Links);
    });

  });

  // ---------------------------------------------------------------------------
  // delete a file
  //
  // deleting a file === rm(). the outcome depends on whether other files still
  // reference it:
  //   - unreferenced -> the node is removed outright.
  //   - still referenced -> the node degrades to a zombie so the incoming
  //     references become dangling links rather than pointers to nothing.
  // ---------------------------------------------------------------------------

  describe('delete a file', () => {

    it('removes an unreferenced doc outright', () => {
      wb.add(newFileData, { id: '5' }); // isolated, not in tree, unreferenced
      assert.strictEqual(wb.rm('5'), true);
      assert.strictEqual(wb.has('5'), false);
      assert.strictEqual(wb.find('filename', 'five'), undefined);
    });

    it('degrades a still-referenced doc to a zombie (leaves dangling links)', () => {
      // detach `two` from the tree first so the only thing holding it is the link
      wb.prune('2', '4');       // make `two` a leaf
      wb.prune('1', '2');       // remove `two` from the index
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype'); // `one` still links to `two`
      // user deletes `two.md`
      assert.strictEqual(wb.rm('2'), true);
      // the node survives as a zombie so the backlink is not orphaned
      assert.strictEqual(wb.has('2'), true);
      assert.strictEqual(wb.get('2')?.state(), NODE.STATE.ZOMBIE);
      assert.deepEqual(wb.backlinks('2'), [{ type: 'linktype', id: '1' }] as Links);
    });

    it('cleanly deletes a doc that has a semtree position (prune then rm)', () => {
      // `four` is a leaf under `two`; prune it out of the index, then delete it
      assert.strictEqual(wb.prune('2', '4'), true);
      assert.strictEqual(wb.rm('4'), true);
      assert.strictEqual(wb.has('4'), false);
      assert.deepEqual(wb.children('2'), []);
    });

  });

  // ---------------------------------------------------------------------------
  // re-home a file's references onto another (merge / consolidate notes)
  //
  // merging file A into file B === transfer A's outgoing references onto B.
  // ---------------------------------------------------------------------------

  describe('merge one file into another', () => {

    it('transfers the source\'s outgoing refs onto the target', () => {
      // `two` links to `three` and has a `tags` attr to `four`
      wb.connect('2', '3', EDGE.KIND.LINK, 'linktype');
      wb.connect('2', '4', EDGE.KIND.ATTR, 'tags');
      // user merges `two.md` into `one.md`: move two's outgoing refs onto one
      assert.strictEqual(wb.transfer('2', '1'), true);
      // one now owns two's former references...
      assert.deepEqual(wb.forelinks('1'), [{ type: 'linktype', id: '3' }] as Links);
      assert.deepEqual(wb.foreattrs('1'), { tags: new Set(['4']) } as Attrs);
      // ...and two has been emptied of them
      assert.deepEqual(wb.forelinks('2'), [] as Links);
      assert.deepEqual(wb.foreattrs('2'), {} as Attrs);
      // ...and the MOVED targets now report the new owner as their referrer
      // (the inbound edge's source changed from two -> one)
      assert.deepEqual(wb.backlinks('3'), [{ type: 'linktype', id: '1' }] as Links);
      assert.deepEqual(wb.backattrs('4'), { tags: new Set(['1']) } as Attrs);
    });

  });

  // ---------------------------------------------------------------------------
  // inspect the garden (health checks)
  //
  // the diagnostics a PKM surfaces to the user (cf. tendr-cli `list` / `check` /
  // `status`): the phase cells (orphans / spurs / isolates /
  // integrated) and dangling links (zombies).
  // ---------------------------------------------------------------------------

  describe('inspect the garden', () => {

    it('lists orphans -- docs in the web but in no index', () => {
      // `five` is created and linked-to, but never grafted into the semtree
      wb.add(newFileData, { id: '5' });
      wb.connect('1', '5', EDGE.KIND.LINK, 'linktype');
      assert.deepEqual(wb.orphans(), ['5']);
    });

    it('lists isolates -- docs connected to nothing at all', () => {
      // drop `four` from the index; nothing references it in the web either
      wb.prune('2', '4');
      assert.deepEqual(wb.isolates(), ['4']);
    });

    it('lists spurs -- docs in the tree but unreferenced in the web', () => {
      // link `one` -> `two`; `three`/`four` stay tree-placed with no web refs
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      assert.deepEqual(wb.spurs(), ['3', '4']);
    });

    it('phases() -- the whole 2x2 at once', () => {
      wb.prune('2', '4');                               // 4: nothing at all
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');   // 1, 2: tree + web
      assert.deepEqual(wb.phases(), {
        [NODE.PHASE.ISOLATE]: ['4'],
        [NODE.PHASE.ORPHAN]: [],
        [NODE.PHASE.SPUR]: ['3'],
        [NODE.PHASE.INTEGRATED]: ['1', '2'],
      });
    });

    it('lists zombies -- dangling links to files that do not exist', () => {
      const zombie: Node | undefined = wb.add('ghost');
      if (!zombie) { assert.fail('expected a zombie node'); }
      wb.connect('1', zombie.id, EDGE.KIND.LINK, 'linktype');
      assert.deepEqual(wb.zombies(), [zombie.id]);
    });

  });

  // the cells are exclusive -- these cases pin down the 2x2 so the definitions
  // above can't silently drift back into being conflated.
  describe('the phase 2x2', () => {

    it('orphan: dropped from the index, yet still web-linked', () => {
      // prune `four` out of the index, but `one` still links to it
      wb.prune('2', '4');
      wb.connect('1', '4', EDGE.KIND.LINK, 'linktype');
      assert.strictEqual(wb.get('4').phase(), NODE.PHASE.ORPHAN);
      assert.ok((wb.orphans() as string[]).includes('4'));
      assert.ok(!(wb.isolates() as string[]).includes('4'));
    });

    it('spur: in the index, yet referenced by nothing', () => {
      // give the other nodes web refs; `four` stays a tree leaf with no refs
      wb.connect('1', '2', EDGE.KIND.LINK, 'linktype');
      wb.connect('3', '1', EDGE.KIND.LINK, 'linktype');
      assert.strictEqual(wb.get('4').phase(), NODE.PHASE.SPUR);
      assert.ok((wb.spurs() as string[]).includes('4'));
      assert.ok(!(wb.isolates() as string[]).includes('4'));
      assert.ok(!(wb.orphans() as string[]).includes('4'));
    });

    it('isolate: a brand-new, unplaced, unreferenced file (one cell, not two)', () => {
      wb.add(newFileData, { id: '5' });
      assert.strictEqual(wb.get('5').phase(), NODE.PHASE.ISOLATE);
      assert.ok((wb.isolates() as string[]).includes('5'));
      assert.ok(!(wb.orphans() as string[]).includes('5'));
    });

    it('zombie: gated out of every cell by state', () => {
      const zombie: Node | undefined = wb.add('ghost');
      if (!zombie) { assert.fail('expected a zombie node'); }
      wb.connect('1', zombie.id, EDGE.KIND.LINK, 'linktype');
      assert.deepEqual(wb.zombies(), [zombie.id]);
      // state and phase report truthfully (the referenced zombie IS web-attached)...
      assert.strictEqual(wb.get(zombie.id).state(), NODE.STATE.ZOMBIE);
      assert.strictEqual(wb.get(zombie.id).phase(), NODE.PHASE.ORPHAN);
      // ...but the bulk queries gate by state: health counts live docs only
      assert.ok(!(wb.orphans() as string[]).includes(zombie.id));
      assert.ok(!(wb.isolates() as string[]).includes(zombie.id));
    });

  });

});
