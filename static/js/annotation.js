/**
 * annotation.js – Context-sensitive undo/redo for the annotation canvas.
 *
 * Public API (also exposed on window for optional programmatic access):
 *   window._annotationCanvas  – AnnotationCanvas instance
 *   window._annotationHistory – AnnotationHistory instance
 *
 * Exports (for Node.js tests):
 *   module.exports = { AnnotationHistory, isEditableTarget }
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // AnnotationHistory – per-image undo / redo stacks
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Manages independent undo/redo stacks keyed by imageId so that switching
   * between images preserves each image's history for the duration of the
   * browser session.
   */
  function AnnotationHistory() {
    /** @type {Object.<string, {undo: Array, redo: Array}>} */
    this._stacks = {};
  }

  AnnotationHistory.prototype._ensure = function (imageId) {
    if (!this._stacks[imageId]) {
      this._stacks[imageId] = { undo: [], redo: [] };
    }
    return this._stacks[imageId];
  };

  /**
   * Push a new state snapshot for imageId.
   * Deep-clones the snapshot and clears the redo stack.
   * @param {string} imageId
   * @param {Array}  snapshot – current annotations array
   */
  AnnotationHistory.prototype.push = function (imageId, snapshot) {
    var s = this._ensure(imageId);
    s.undo.push(JSON.parse(JSON.stringify(snapshot)));
    s.redo = [];
  };

  /**
   * Undo the latest change for imageId.
   * @param {string} imageId
   * @returns {Array|null} previous state, or null if nothing to undo
   */
  AnnotationHistory.prototype.undo = function (imageId) {
    var s = this._ensure(imageId);
    if (s.undo.length <= 1) return null; // always keep the initial state
    var current = s.undo.pop();
    s.redo.push(current);
    return JSON.parse(JSON.stringify(s.undo[s.undo.length - 1]));
  };

  /**
   * Redo the most recently undone change for imageId.
   * @param {string} imageId
   * @returns {Array|null} next state, or null if nothing to redo
   */
  AnnotationHistory.prototype.redo = function (imageId) {
    var s = this._ensure(imageId);
    if (s.redo.length === 0) return null;
    var state = s.redo.pop();
    s.undo.push(state);
    return JSON.parse(JSON.stringify(state));
  };

  /** @returns {boolean} true when undo is available for imageId */
  AnnotationHistory.prototype.canUndo = function (imageId) {
    return this._ensure(imageId).undo.length > 1;
  };

  /** @returns {boolean} true when redo is available for imageId */
  AnnotationHistory.prototype.canRedo = function (imageId) {
    return this._ensure(imageId).redo.length > 0;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // AnnotationCanvas – canvas rendering, drawing, focus management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {AnnotationHistory} history
   */
  function AnnotationCanvas(canvas, history) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.history = history;
    this.currentImageId = null;
    this._bgImage = null;
    /** @type {Array<{type:string, x:number, y:number, w:number, h:number, label:string, visible:boolean}>} */
    this.annotations = [];
    /** Whether the canvas panel has been armed by a user click (click-to-arm). */
    this.focused = false;
    this._drawing = false;
    this._startX = 0;
    this._startY = 0;
    this._draft = null;

    this._bindEvents();
  }

  /**
   * Load an image onto the canvas and restore its annotation history.
   * @param {string} imageId – stable identifier for per-image history
   * @param {string} src     – image URL or data-URI; pass empty string for a blank canvas
   */
  AnnotationCanvas.prototype.loadImage = function (imageId, src) {
    this.currentImageId = imageId;
    var self = this;

    var init = function () {
      var s = self.history._ensure(imageId);
      if (s.undo.length === 0) {
        self.annotations = [];
        self.history.push(imageId, []);
      } else {
        self.annotations = JSON.parse(JSON.stringify(s.undo[s.undo.length - 1]));
      }
      self._render();
    };

    if (!src) {
      // Blank canvas slot – no background image
      self._bgImage = null;
      self.canvas.width = 800;
      self.canvas.height = 500;
      init();
      return;
    }

    var img = new Image();
    img.onload = function () {
      self._bgImage = img;
      self.canvas.width = img.naturalWidth || 800;
      self.canvas.height = img.naturalHeight || 500;
      init();
    };
    img.src = src;
  };

  /** Add an annotation object and record history. */
  AnnotationCanvas.prototype.addAnnotation = function (ann) {
    this.annotations.push(Object.assign({}, ann));
    this._commit();
    this._render();
  };

  /** Delete the annotation at the given index and record history. */
  AnnotationCanvas.prototype.deleteAnnotation = function (index) {
    if (index >= 0 && index < this.annotations.length) {
      this.annotations.splice(index, 1);
      this._commit();
      this._render();
    }
  };

  /** Apply a partial patch to the annotation at index and record history. */
  AnnotationCanvas.prototype.updateAnnotation = function (index, patch) {
    if (index >= 0 && index < this.annotations.length) {
      Object.assign(this.annotations[index], patch);
      this._commit();
      this._render();
    }
  };

  /**
   * Undo the most recent annotation operation.
   * No-op when the canvas is not focused or there is nothing to undo.
   * @returns {boolean} true when an undo was performed
   */
  AnnotationCanvas.prototype.undo = function () {
    if (!this.focused || !this.currentImageId) return false;
    var state = this.history.undo(this.currentImageId);
    if (state === null) return false;
    this.annotations = state;
    this._render();
    return true;
  };

  /**
   * Redo the most recently undone annotation operation.
   * No-op when the canvas is not focused or there is nothing to redo.
   * @returns {boolean} true when a redo was performed
   */
  AnnotationCanvas.prototype.redo = function () {
    if (!this.focused || !this.currentImageId) return false;
    var state = this.history.redo(this.currentImageId);
    if (state === null) return false;
    this.annotations = state;
    this._render();
    return true;
  };

  AnnotationCanvas.prototype._commit = function () {
    if (this.currentImageId) {
      this.history.push(this.currentImageId, this.annotations);
    }
  };

  AnnotationCanvas.prototype._coords = function (clientX, clientY) {
    var r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (this.canvas.width / r.width),
      y: (clientY - r.top) * (this.canvas.height / r.height),
    };
  };

  AnnotationCanvas.prototype._render = function () {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this._bgImage) {
      ctx.drawImage(this._bgImage, 0, 0);
    } else {
      // Placeholder background when no image is loaded
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#aaa';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Draw rectangles here', this.canvas.width / 2, this.canvas.height / 2);
      ctx.textAlign = 'start';
    }

    for (var i = 0; i < this.annotations.length; i++) {
      var ann = this.annotations[i];
      if (ann.visible === false) continue;
      this._drawRect(ctx, ann, '#2196F3', ann.label || '');
    }

    if (this._draft) {
      this._drawRect(ctx, this._draft, '#FF9800', '');
    }

    if (this.focused) {
      ctx.save();
      ctx.strokeStyle = '#2196F3';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
      ctx.setLineDash([]);
      ctx.restore();
    }
  };

  AnnotationCanvas.prototype._drawRect = function (ctx, r, color, label) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (label) {
      ctx.fillStyle = color;
      ctx.font = '13px sans-serif';
      ctx.fillText(label, r.x + 3, r.y > 16 ? r.y - 4 : r.y + 14);
    }
    ctx.restore();
  };

  AnnotationCanvas.prototype._armFocus = function () {
    if (!this.focused) {
      this.focused = true;
      this.canvas.classList.add('annotation-canvas--focused');
      this._render();
    }
  };

  AnnotationCanvas.prototype._disarmFocus = function () {
    if (this.focused) {
      this.focused = false;
      this.canvas.classList.remove('annotation-canvas--focused');
      this._render();
    }
  };

  AnnotationCanvas.prototype._bindEvents = function () {
    var self = this;
    var c = this.canvas;

    c.addEventListener('mousedown', function (e) {
      self._armFocus();
      var p = self._coords(e.clientX, e.clientY);
      self._startX = p.x;
      self._startY = p.y;
      self._drawing = true;
      self._draft = { type: 'rect', x: p.x, y: p.y, w: 0, h: 0, label: '', visible: true };
    });

    c.addEventListener('mousemove', function (e) {
      if (!self._drawing) return;
      var p = self._coords(e.clientX, e.clientY);
      self._draft.w = p.x - self._startX;
      self._draft.h = p.y - self._startY;
      self._render();
    });

    c.addEventListener('mouseup', function () {
      if (!self._drawing) return;
      self._drawing = false;
      if (self._draft && (Math.abs(self._draft.w) > 5 || Math.abs(self._draft.h) > 5)) {
        self.addAnnotation(Object.assign({}, self._draft));
      }
      self._draft = null;
      self._render();
    });

    c.addEventListener('mouseleave', function () {
      if (self._drawing) {
        self._drawing = false;
        self._draft = null;
        self._render();
      }
    });

    // Disarm when the user clicks outside the canvas (capture phase so it fires first)
    document.addEventListener('mousedown', function (e) {
      if (e.target !== c && !c.contains(e.target)) {
        self._disarmFocus();
      }
    }, true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard gating helper
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns true when the keyboard event originates from an element where the
   * browser should handle Ctrl+Z natively (text fields, selects, contenteditable).
   * In those cases the annotation shortcut handler must not interfere.
   *
   * @param {KeyboardEvent} e
   * @returns {boolean}
   */
  function isEditableTarget(e) {
    var el = e.target;
    if (!el) return false;
    var tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Global keyboard shortcut installation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Installs a document-level keydown handler that routes Ctrl/Cmd+Z,
   * Ctrl/Cmd+Shift+Z, and Ctrl+Y to the annotation canvas only when:
   *   1. The event does NOT originate from an editable element.
   *   2. The annotation canvas is currently focused (click-to-arm).
   *
   * When the shortcut is handled, both preventDefault and stopPropagation
   * are called so the browser's native undo never fires.
   *
   * @param {AnnotationCanvas} annotationCanvas
   */
  function installKeyboardShortcuts(annotationCanvas) {
    document.addEventListener('keydown', function (e) {
      // Gate 1: never steal Ctrl+Z from text inputs / selects / contenteditable
      if (isEditableTarget(e)) return;

      // Gate 2: only active when the annotation canvas has explicit focus
      if (!annotationCanvas.focused) return;

      var ctrl = e.ctrlKey || e.metaKey; // Ctrl on Windows/Linux, Cmd on Mac
      if (!ctrl) return;

      var isUndo = !e.shiftKey && e.key === 'z';
      var isRedo = (e.shiftKey && e.key === 'z') ||
                   (e.ctrlKey && !e.shiftKey && e.key === 'y'); // Ctrl+Y (Windows/Linux only)

      if (isUndo) {
        e.preventDefault();
        e.stopPropagation();
        annotationCanvas.undo();
      } else if (isRedo) {
        e.preventDefault();
        e.stopPropagation();
        annotationCanvas.redo();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOMContentLoaded initialisation
  // ─────────────────────────────────────────────────────────────────────────

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      var canvas = document.getElementById('annotation-canvas');
      if (!canvas) return; // annotation panel not present on this page

      var history = new AnnotationHistory();
      var ac = new AnnotationCanvas(canvas, history);
      installKeyboardShortcuts(ac);

      // Image selector (optional)
      var sel = document.getElementById('annotation-image-selector');
      if (sel) {
        var loadSelected = function () {
          var opt = sel.options[sel.selectedIndex];
          if (opt && opt.value) {
            ac.loadImage(opt.value, opt.dataset.src || '');
          }
        };
        sel.addEventListener('change', loadSelected);
        if (sel.options.length > 0) loadSelected();
      } else {
        // No image selector: initialise with a blank canvas slot
        ac.loadImage('default', '');
      }

      // Delete-last button (optional)
      var delBtn = document.getElementById('annotation-delete-last');
      if (delBtn) {
        delBtn.addEventListener('click', function () {
          if (ac.annotations.length > 0) {
            ac.deleteAnnotation(ac.annotations.length - 1);
          }
        });
      }

      // Annotation count display (optional)
      var countEl = document.getElementById('annotation-count');
      if (countEl) {
        var origCommit = ac._commit.bind(ac);
        ac._commit = function () {
          origCommit();
          countEl.textContent =
            ac.annotations.length + ' annotation' +
            (ac.annotations.length !== 1 ? 's' : '');
        };
      }

      // Tab switching
      var tabs = document.querySelectorAll('.annotation-tab-btn');
      tabs.forEach(function (btn) {
        btn.addEventListener('click', function () {
          tabs.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          var target = btn.dataset.tab;
          document.querySelectorAll('.tab-content').forEach(function (pane) {
            pane.classList.toggle('active', pane.id === 'tab-' + target);
          });
        });
      });

      window._annotationCanvas = ac;
      window._annotationHistory = history;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CommonJS export (for Node.js unit tests)
  // ─────────────────────────────────────────────────────────────────────────
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnnotationHistory: AnnotationHistory, isEditableTarget: isEditableTarget };
  }
}());
