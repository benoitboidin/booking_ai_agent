/**
 * test/annotation.test.js
 *
 * Unit tests for annotation undo/redo history and keyboard gating logic.
 * Run with: node test/annotation.test.js
 *
 * Uses only Node.js built-in modules – no extra dependencies required.
 */

'use strict';

var assert = require('assert');
var { AnnotationHistory, isEditableTarget } = require('../static/js/annotation.js');

// ── Minimal test harness ──────────────────────────────────────────────────

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
    passed++;
  } catch (err) {
    console.error('  ✗ ' + name);
    console.error('    ' + err.message);
    failed++;
  }
}

function suite(name, fn) {
  console.log('\n' + name);
  fn();
}

// ── AnnotationHistory tests ───────────────────────────────────────────────

suite('AnnotationHistory – basic push/undo/redo', function () {
  test('push stores a snapshot; canUndo becomes true after second push', function () {
    var h = new AnnotationHistory();
    h.push('img1', []);
    assert.strictEqual(h.canUndo('img1'), false, 'only 1 entry → cannot undo yet');
    h.push('img1', [{ x: 0, y: 0, w: 10, h: 10 }]);
    assert.strictEqual(h.canUndo('img1'), true);
  });

  test('undo returns previous state and moves current to redo stack', function () {
    var h = new AnnotationHistory();
    var s0 = [];
    var s1 = [{ x: 1 }];
    h.push('img1', s0);
    h.push('img1', s1);
    var result = h.undo('img1');
    assert.deepStrictEqual(result, s0);
    assert.strictEqual(h.canUndo('img1'), false);
    assert.strictEqual(h.canRedo('img1'), true);
  });

  test('redo restores undone state and clears redo entry', function () {
    var h = new AnnotationHistory();
    h.push('img1', []);
    h.push('img1', [{ x: 5 }]);
    h.undo('img1');
    var result = h.redo('img1');
    assert.deepStrictEqual(result, [{ x: 5 }]);
    assert.strictEqual(h.canRedo('img1'), false);
  });

  test('push after undo clears redo stack', function () {
    var h = new AnnotationHistory();
    h.push('img1', []);
    h.push('img1', [{ x: 1 }]);
    h.undo('img1');
    h.push('img1', [{ x: 99 }]);
    assert.strictEqual(h.canRedo('img1'), false, 'redo stack must be cleared by push');
  });

  test('undo returns null when nothing to undo (only initial state)', function () {
    var h = new AnnotationHistory();
    h.push('img1', []);
    var result = h.undo('img1');
    assert.strictEqual(result, null);
  });

  test('redo returns null when nothing to redo', function () {
    var h = new AnnotationHistory();
    h.push('img1', []);
    var result = h.redo('img1');
    assert.strictEqual(result, null);
  });

  test('snapshots are deep-cloned – mutating original does not affect history', function () {
    var h = new AnnotationHistory();
    var original = [{ x: 1 }];
    h.push('img1', original);
    original[0].x = 999; // mutate after push
    h.push('img1', [{ x: 2 }]);
    var prev = h.undo('img1');
    assert.strictEqual(prev[0].x, 1, 'history must not reflect post-push mutation');
  });
});

suite('AnnotationHistory – per-image isolation', function () {
  test('undo/redo stacks are independent across different imageIds', function () {
    var h = new AnnotationHistory();
    h.push('imgA', []);
    h.push('imgA', [{ x: 1 }]);
    h.push('imgB', []);
    h.push('imgB', [{ x: 2 }]);

    // Undoing imgA should not affect imgB
    h.undo('imgA');
    assert.strictEqual(h.canUndo('imgA'), false);
    assert.strictEqual(h.canUndo('imgB'), true, 'imgB undo stack must be unaffected');
  });

  test('switching "image" and back restores correct history', function () {
    var h = new AnnotationHistory();
    h.push('img1', []);
    h.push('img1', [{ x: 10 }]);
    h.push('img2', []);
    h.push('img2', [{ x: 20 }]);

    // "Switch" to img1 and undo
    var result1 = h.undo('img1');
    assert.deepStrictEqual(result1, [], 'img1 undo returns its own initial state');

    // img2 history is unchanged
    var result2 = h.undo('img2');
    assert.deepStrictEqual(result2, [], 'img2 undo returns its own initial state');
  });
});

// ── isEditableTarget tests ────────────────────────────────────────────────

suite('isEditableTarget – keyboard gating', function () {
  function makeEvent(tag, extras) {
    return { target: Object.assign({ tagName: tag, isContentEditable: false }, extras) };
  }

  test('returns true for INPUT element', function () {
    assert.strictEqual(isEditableTarget(makeEvent('INPUT')), true);
  });

  test('returns true for TEXTAREA element', function () {
    assert.strictEqual(isEditableTarget(makeEvent('TEXTAREA')), true);
  });

  test('returns true for SELECT element', function () {
    assert.strictEqual(isEditableTarget(makeEvent('SELECT')), true);
  });

  test('returns true for a contenteditable element', function () {
    assert.strictEqual(
      isEditableTarget(makeEvent('DIV', { isContentEditable: true })),
      true
    );
  });

  test('returns false for a non-editable DIV', function () {
    assert.strictEqual(isEditableTarget(makeEvent('DIV')), false);
  });

  test('returns false for CANVAS element', function () {
    assert.strictEqual(isEditableTarget(makeEvent('CANVAS')), false);
  });

  test('returns false when target is null/undefined', function () {
    assert.strictEqual(isEditableTarget({ target: null }), false);
    assert.strictEqual(isEditableTarget({ target: undefined }), false);
  });

  test('tag matching is case-insensitive (lower-case tagName)', function () {
    // Some environments report lower-case tagName
    assert.strictEqual(isEditableTarget(makeEvent('input')), true);
    assert.strictEqual(isEditableTarget(makeEvent('textarea')), true);
  });
});

// ── Summary ───────────────────────────────────────────────────────────────

console.log('\n──────────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
