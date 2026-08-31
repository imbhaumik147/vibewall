import { LAYOUT_PRESETS, DEVICE_PRESETS, STARTER_AESTHETIC_IMAGES } from './sample-data.js';
import { WallpaperGridEngine, UNICORN_POINTS } from './grid.js';

// IndexedDB Helper for Large Cross-Page Image Transfers
async function loadTransferData() {
  const IDB_NAME = 'vibewall_db';
  const IDB_STORE = 'transfer_store';
  try {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).get('init_data');
    return new Promise((res) => {
      req.onsuccess = () => {
        const val = req.result;
        try { tx.objectStore(IDB_STORE).delete('init_data'); } catch(e){}
        res(val);
      };
      req.onerror = () => res(null);
    });
  } catch (e) {
    return null;
  }
}

class WallpaperApp {
  constructor() {
    this.currentPreset = DEVICE_PRESETS[0]; // Default: iPhone 15/16 Pro Max
    this.canvasWidth = this.currentPreset.width;
    this.canvasHeight = this.currentPreset.height;
    
    this.uploadedImages = []; // Array of { id, src, isHero, shape }
    this.activeFilter = '';
    this.showDeviceFrame = true;

    this.interactionMode = 'drag'; // 'drag' | 'select'
    this.selectedSource = null; // { type: 'tray'|'canvas', imgSrc, slotIndex, el }

    this.targetSlotForReplace = null;

    this.initDOM();
    this.initEngine();
    this.initSidebarResizers();
    this.bindEvents();
    this.renderPresetCards('phone');
    this.renderPresetLayoutCards();
    this.setupWindowResize();

    this.updateUploadTray();
    this.updateHeroStatusUI();
    this.engine.render();

    this.loadSessionOrParams();

    requestAnimationFrame(() => this.fitCanvasToViewport());
    setTimeout(() => this.fitCanvasToViewport(), 100);
  }

  get rawUploadedUrls() {
    return this.uploadedImages.map(item => item.src);
  }

  get rawHeroUrls() {
    return this.uploadedImages.filter(item => item.isHero).map(item => item.src);
  }

  get heroImages() {
    return this.rawHeroUrls;
  }

  async loadSessionOrParams() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const presetParam = urlParams.get('preset');
      
      let data = await loadTransferData();
      if (!data) {
        const sessionRaw = sessionStorage.getItem('vibewall_init_data') || sessionStorage.getItem('vibepaper_init_data');
        if (sessionRaw) {
          try { data = JSON.parse(sessionRaw); } catch (e) {}
        }
      }

      if (data) {
        if (data.deviceId) {
          const foundDev = DEVICE_PRESETS.find(d => d.id === data.deviceId);
          if (foundDev) this.selectPreset(foundDev);
        }
        if (data.presetId) {
          const foundPreset = LAYOUT_PRESETS.find(p => p.id === data.presetId);
          if (foundPreset) this.applyLayoutPreset(foundPreset);
        }
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
          const heroCount = this.engine.heroCount || 3;
          this.uploadedImages = data.images.map((src, index) => ({
            id: 'img_' + Math.random().toString(36).substring(2, 9) + '_' + index + '_' + Date.now(),
            src: src,
            isHero: index < heroCount,
            shape: 'default'
          }));
        }
        try {
          sessionStorage.removeItem('vibewall_init_data');
          sessionStorage.removeItem('vibepaper_init_data');
        } catch (e) {}
      } else if (presetParam) {
        const foundPreset = LAYOUT_PRESETS.find(p => p.id === presetParam);
        if (foundPreset) this.applyLayoutPreset(foundPreset);
      }

      this.updateUploadTray();
      this.updateHeroStatusUI();
      if (this.uploadedImages.length > 0) {
        this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
      } else {
        this.engine.render();
      }
      this.fitCanvasToViewport();
    } catch (e) {
      console.warn('Session init error', e);
      this.engine.render();
      this.fitCanvasToViewport();
    }
  }

  initDOM() {
    this.dom = {
      canvasWrapper: document.getElementById('canvas-wrapper'),
      gridContainer: document.getElementById('grid-container'),
      deviceFrame: document.getElementById('device-frame'),
      dynamicIsland: document.getElementById('dynamic-island'),
      
      // Sidebar Tabs
      tabBtns: document.querySelectorAll('.tab-btn'),
      tabPanes: document.querySelectorAll('.tab-pane'),

      // Presets & Sizing
      activeResBadge: document.getElementById('active-res-badge'),
      catPills: document.querySelectorAll('.cat-pill'),
      presetCardsList: document.getElementById('preset-cards-list'),
      customDimPanel: document.getElementById('custom-dim-panel'),
      customW: document.getElementById('custom-w'),
      customH: document.getElementById('custom-h'),

      // Layout Modes & Sizing
      layoutModeBtns: document.querySelectorAll('.layout-mode-btn'),
      randomizeLayoutBtn: document.getElementById('randomize-layout-btn'),
      colsSlider: document.getElementById('cols-slider'),
      colsBadge: document.getElementById('cols-badge'),
      normalSizeBtns: document.querySelectorAll('.normal-size-btn'),

      // Wallpaper Collage Shape (Silhouette Matrix)
      shapeSilBtns: document.querySelectorAll('.shape-sil-btn'),
      activeShapeBadge: document.getElementById('active-shape-badge'),

      // Photo Tile Cutout Shape
      tileShapeBtns: document.querySelectorAll('.tile-shape-btn'),
      activeTileShapeBadge: document.getElementById('active-tile-shape-badge'),
      heroShapeBtns: document.querySelectorAll('.hero-shape-btn'),
      activeHeroShapeBadge: document.getElementById('active-hero-shape-badge'),

      // Hero Configuration (Count & Size)
      heroConfigPanel: document.getElementById('hero-config-panel'),
      activeHeroesCountBadge: document.getElementById('active-heroes-count-badge'),
      heroNumBtns: document.querySelectorAll('.hero-num-btn'),
      customHeroInput: document.getElementById('custom-hero-input'),
      heroSizeBadge: document.getElementById('hero-size-badge'),
      heroSizeBtns: document.querySelectorAll('.hero-size-btn'),
      heroAssignedCount: document.getElementById('hero-assigned-count'),

      // Tile Shape Variations (Vertical / Horizontal)
      toggleVerticalBtn: document.getElementById('toggle-vertical-btn'),
      toggleHorizontalBtn: document.getElementById('toggle-horizontal-btn'),

      // Style controls
      gapSlider: document.getElementById('gap-slider'),
      gapBadge: document.getElementById('gap-badge'),
      radiusSlider: document.getElementById('radius-slider'),
      radiusBadge: document.getElementById('radius-badge'),
      paddingSlider: document.getElementById('padding-slider'),
      paddingBadge: document.getElementById('padding-badge'),
      colorHexBadge: document.getElementById('color-hex-badge'),
      colorDots: document.querySelectorAll('.color-dot'),
      customColorPicker: document.getElementById('custom-color-picker'),
      filterChips: document.querySelectorAll('.filter-chip'),

      // Presets list
      themesGalleryList: document.getElementById('themes-gallery-list'),

      // Uploads & Right Sidebar Table
      modeDragBtn: document.getElementById('mode-drag-btn'),
      modeSelectBtn: document.getElementById('mode-select-btn'),
      fileInput: document.getElementById('file-input'),
      singleSlotFileInput: document.getElementById('single-slot-file-input'),
      dropzone: document.getElementById('dropzone'),
      uploadTableBody: document.getElementById('upload-table-body'),
      trayCountBadge: document.getElementById('tray-count-badge'),
      clearTrayBtn: document.getElementById('clear-tray-btn'),
      fillGridBtn: document.getElementById('fill-grid-btn'),
      shuffleBtn: document.getElementById('shuffle-btn'),
      clearBtn: document.getElementById('clear-btn'),

      // Header Actions
      toggleFrameBtn: document.getElementById('toggle-frame-btn'),
      exportBtn: document.getElementById('export-btn'),

      // Collapsible & Resizable Sidebars
      leftSidebar: document.getElementById('left-sidebar'),
      rightSidebar: document.getElementById('right-sidebar'),
      leftSidebarResizer: document.getElementById('left-sidebar-resizer'),
      rightSidebarResizer: document.getElementById('right-sidebar-resizer'),
      toggleLeftSidebarBtn: document.getElementById('toggle-left-sidebar-btn'),
      toggleRightSidebarBtn: document.getElementById('toggle-right-sidebar-btn'),
      collapseLeftBtn: document.getElementById('collapse-left-btn'),
      collapseRightBtn: document.getElementById('collapse-right-btn'),
      expandLeftBtn: document.getElementById('expand-left-btn'),
      expandRightBtn: document.getElementById('expand-right-btn'),

      // Export Modal
      exportModal: document.getElementById('export-modal'),
      closeExportModalBtn: document.getElementById('close-export-modal'),
      cancelExportBtn: document.getElementById('cancel-export-btn'),
      confirmExportBtn: document.getElementById('confirm-export-btn'),
      exportFormatSelect: document.getElementById('export-format'),
      exportQualitySelect: document.getElementById('export-quality'),
      exportPreviewCanvas: document.getElementById('export-preview-canvas'),
      exportResInfo: document.getElementById('export-res-info'),

      // Floating Block Inspector & Action Bar
      tileActionBar: document.getElementById('tile-action-bar'),
      tileActionIcon: document.getElementById('tile-action-icon'),
      tileActionTitle: document.getElementById('tile-action-title'),
      tileActionSubtitle: document.getElementById('tile-action-subtitle'),
      tileMoveLeftBtn: document.getElementById('tile-move-left-btn'),
      tileMoveUpBtn: document.getElementById('tile-move-up-btn'),
      tileMoveDownBtn: document.getElementById('tile-move-down-btn'),
      tileMoveRightBtn: document.getElementById('tile-move-right-btn'),
      tileSplitBtn: document.getElementById('tile-split-btn'),
      tileSplitBtnText: document.getElementById('tile-split-btn-text'),
      tileReplaceBtn: document.getElementById('tile-replace-btn'),
      tileClearBtn: document.getElementById('tile-clear-btn'),
      tileActionCloseBtn: document.getElementById('tile-action-close-btn')
    };
  }

  initEngine() {
    this.engine = new WallpaperGridEngine({
      container: this.dom.gridContainer,
      onSwap: () => {
        this.showToast('Covers swapped successfully!', 'success');
      },
      onSlotClick: (slotIndex) => {
        this.showTileActionBar(slotIndex);
        if (this.interactionMode === 'select') {
          this.handleCanvasSlotSelect(slotIndex);
        }
      }
    });

    this.updateGridDimensions();
  }

  setupWindowResize() {
    window.addEventListener('resize', () => {
      this.fitCanvasToViewport();
    });

    if (window.ResizeObserver && this.dom.canvasWrapper) {
      const ro = new ResizeObserver(() => {
        this.fitCanvasToViewport();
      });
      ro.observe(this.dom.canvasWrapper);
    }

    if (this.dom.leftSidebar) {
      this.dom.leftSidebar.addEventListener('transitionend', () => this.fitCanvasToViewport());
    }
    if (this.dom.rightSidebar) {
      this.dom.rightSidebar.addEventListener('transitionend', () => this.fitCanvasToViewport());
    }
  }

  animateCanvasFit(duration = 350) {
    const start = performance.now();
    const tick = (now) => {
      this.fitCanvasToViewport();
      if (now - start < duration) {
        requestAnimationFrame(tick);
      } else {
        this.fitCanvasToViewport();
      }
    };
    requestAnimationFrame(tick);
  }

  updateGridDimensions() {
    this.engine.setDimensions(this.canvasWidth, this.canvasHeight, parseInt(this.dom.colsSlider.value, 10));
    this.updateCanvasAspectBox();
  }

  updateCanvasAspectBox() {
    const ratio = `${this.canvasWidth} / ${this.canvasHeight}`;
    this.dom.gridContainer.style.aspectRatio = ratio;
    this.dom.deviceFrame.style.aspectRatio = ratio;
    this.dom.activeResBadge.innerText = `${this.canvasWidth} × ${this.canvasHeight}`;
    
    if (this.showDeviceFrame && this.currentPreset.category === 'phone') {
      this.dom.deviceFrame.classList.add('device-frame-phone');
      this.dom.dynamicIsland.style.display = 'block';
    } else {
      this.dom.deviceFrame.classList.remove('device-frame-phone');
      this.dom.dynamicIsland.style.display = 'none';
    }

    this.fitCanvasToViewport();
  }

  fitCanvasToViewport() {
    const wrapper = this.dom.canvasWrapper;
    const frame = this.dom.deviceFrame;
    if (!wrapper || !frame) return;

    const availW = Math.max(120, wrapper.clientWidth - 36);
    const availH = Math.max(120, wrapper.clientHeight - 36);
    const aspect = this.canvasWidth / this.canvasHeight;

    let targetW, targetH;
    if (availW / availH > aspect) {
      targetH = availH;
      targetW = targetH * aspect;
    } else {
      targetW = availW;
      targetH = targetW / aspect;
    }

    frame.style.width = `${Math.floor(targetW)}px`;
    frame.style.height = `${Math.floor(targetH)}px`;
  }

  getPresetSVG(icon) {
    if (icon === 'monitor') {
      return '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>';
    }
    if (icon === 'tablet') {
      return '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>';
    }
    if (icon === 'square') {
      return '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
    }
    return '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="3"/><circle cx="12" cy="18" r="1"/></svg>';
  }

  renderPresetCards(category) {
    this.dom.presetCardsList.innerHTML = '';
    
    if (category === 'custom') {
      this.dom.customDimPanel.classList.remove('hidden');
      return;
    } else {
      this.dom.customDimPanel.classList.add('hidden');
    }

    const filtered = DEVICE_PRESETS.filter(p => p.category === category);

    filtered.forEach(preset => {
      const isSelected = this.currentPreset.id === preset.id;
      const card = document.createElement('div');
      card.className = `p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
        isSelected 
          ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
          : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
      }`;

      card.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center ${isSelected ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}">
            ${this.getPresetSVG(preset.icon)}
          </div>
          <div>
            <div class="text-xs font-bold">${preset.name}</div>
            <div class="text-[9px] ${isSelected ? 'text-slate-300' : 'text-slate-400'} font-mono">${preset.aspectRatio}</div>
          </div>
        </div>
        <span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}">
          ${preset.badge}
        </span>
      `;

      card.addEventListener('click', () => {
        this.selectPreset(preset);
      });

      this.dom.presetCardsList.appendChild(card);
    });
  }

  selectPreset(preset) {
    this.currentPreset = preset;
    this.canvasWidth = preset.width;
    this.canvasHeight = preset.height;

    this.dom.colsSlider.value = preset.defaultCols;
    this.updateNormalCoverSize(preset.defaultCols);

    this.renderPresetCards(preset.category);
    this.updateGridDimensions();
    this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
    this.showToast(`Preset: ${preset.name}`, 'info');
  }

  // --- Interaction Mode Toggle (Drag & Drop vs Click Selection) ---
  setInteractionMode(mode) {
    this.interactionMode = mode;
    this.clearSelection();

    if (mode === 'drag') {
      document.body.classList.remove('selection-mode-active');
      if (this.dom.modeDragBtn) this.dom.modeDragBtn.className = 'interaction-mode-btn active py-1.5 rounded-lg font-bold text-center bg-white shadow-sm text-slate-900 flex items-center justify-center gap-1.5 transition-all';
      if (this.dom.modeSelectBtn) this.dom.modeSelectBtn.className = 'interaction-mode-btn py-1.5 rounded-lg font-semibold text-center text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-all';
      this.showToast('Mode: Drag & Drop to swap', 'info');
    } else {
      document.body.classList.add('selection-mode-active');
      if (this.dom.modeSelectBtn) this.dom.modeSelectBtn.className = 'interaction-mode-btn active py-1.5 rounded-lg font-bold text-center bg-white shadow-sm text-slate-900 flex items-center justify-center gap-1.5 transition-all';
      if (this.dom.modeDragBtn) this.dom.modeDragBtn.className = 'interaction-mode-btn py-1.5 rounded-lg font-semibold text-center text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-all';
      this.showToast('Mode: Click & Swap items', 'info');
    }
  }

  handleTrayCardClick(imgSrc, rowElement, itemId) {
    if (this.interactionMode !== 'select') return;

    if (this.selectedSource && this.selectedSource.type === 'tray' && this.selectedSource.id === itemId) {
      // Re-clicked the same tray item -> Deselect / Unselect!
      this.clearSelection();
      this.showToast('Photo unselected', 'info');
      return;
    }

    if (!this.selectedSource) {
      // 1. Select this table row cover as the active source
      this.selectedSource = { type: 'tray', imgSrc, id: itemId, el: rowElement };
      rowElement.classList.add('is-selected-table-row');
      this.showToast('Photo selected: Click a canvas tile to place (or click again to unselect)', 'info');
    } else if (this.selectedSource.type === 'tray') {
      // Switch selected tray card
      if (this.selectedSource.el) this.selectedSource.el.classList.remove('is-selected-table-row');
      this.selectedSource = { type: 'tray', imgSrc, id: itemId, el: rowElement };
      rowElement.classList.add('is-selected-table-row');
      this.showToast('Photo selected: Click a canvas tile to place (or click again to unselect)', 'info');
    } else if (this.selectedSource.type === 'canvas') {
      // A canvas slot was previously selected -> Place this clicked tray image into that canvas slot!
      const targetSlot = this.selectedSource.slotIndex;
      this.engine.slotImages[targetSlot] = imgSrc;
      this.engine.render();
      this.clearSelection();
      this.showToast('Photo placed into slot!', 'success');
    }
  }

  handleCanvasSlotSelect(slotIndex) {
    const tileElement = this.dom.gridContainer.querySelector(`[data-slot-index="${slotIndex}"]`);

    if (this.selectedSource && this.selectedSource.type === 'canvas' && this.selectedSource.slotIndex === slotIndex) {
      // Re-clicked the same canvas tile -> Deselect / Unselect!
      this.clearSelection();
      this.showToast('Slot unselected', 'info');
      return;
    }

    if (!this.selectedSource) {
      // 1. Select this canvas slot as the active source with prominent border
      this.selectedSource = { type: 'canvas', slotIndex, el: tileElement };
      if (tileElement) tileElement.classList.add('is-selected-source');
      this.showToast(`Slot #${slotIndex + 1} selected: Click another tile to Swap, or click a photo in table`, 'info');
    } else if (this.selectedSource.type === 'tray') {
      // A tray cover was selected -> Place it into this clicked canvas slot!
      this.engine.slotImages[slotIndex] = this.selectedSource.imgSrc;
      this.engine.render();
      this.clearSelection();
      this.showToast('Photo placed into slot!', 'success');
    } else if (this.selectedSource.type === 'canvas') {
      // Clicked 2 different canvas slots -> SWAP them!
      const prevSlot = this.selectedSource.slotIndex;
      this.engine.swapSlots(prevSlot, slotIndex);
      this.clearSelection();
      this.showToast('Tiles swapped successfully!', 'success');
    }
  }

  showTileActionBar(slotIndex) {
    if (!this.dom.tileActionBar) return;
    this.selectedSlotIndex = slotIndex;
    const slot = this.engine.slots[slotIndex];
    if (!slot) return;

    const count = slot.spanRow * slot.spanCol;
    if (slot.isHero) {
      this.dom.tileActionTitle.innerText = `Hero Block (${slot.spanCol}×${slot.spanRow})`;
      this.dom.tileActionIcon.innerHTML = `<svg class="w-3.5 h-3.5 text-amber-400 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
      if (this.dom.tileSplitBtnText) {
        this.dom.tileSplitBtnText.innerText = `Remove Hero & Fit ${count} Squares`;
      }
      if (this.dom.tileSplitBtn) {
        this.dom.tileSplitBtn.style.display = 'inline-flex';
      }
    } else if (slot.spanRow > 1 || slot.spanCol > 1) {
      this.dom.tileActionTitle.innerText = `Spanning Block (${slot.spanCol}×${slot.spanRow})`;
      this.dom.tileActionIcon.innerHTML = `<svg class="w-3.5 h-3.5 text-indigo-400 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
      if (this.dom.tileSplitBtnText) {
        this.dom.tileSplitBtnText.innerText = `Split into ${count} Square Blocks`;
      }
      if (this.dom.tileSplitBtn) {
        this.dom.tileSplitBtn.style.display = 'inline-flex';
      }
    } else {
      this.dom.tileActionTitle.innerText = `Standard Block (1×1)`;
      this.dom.tileActionIcon.innerHTML = `<svg class="w-3.5 h-3.5 text-slate-400 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>`;
      if (this.dom.tileSplitBtn) {
        this.dom.tileSplitBtn.style.display = 'none';
      }
    }

    if (this.dom.tileActionSubtitle) {
      this.dom.tileActionSubtitle.innerText = `Row ${slot.row + 1}, Col ${slot.col + 1}`;
    }

    this.dom.tileActionBar.classList.remove('hidden');

    // Highlight selected tile on canvas
    document.querySelectorAll('.grid-tile, .grid-tile-skeleton').forEach(el => el.classList.remove('is-selected-source'));
    const tileEl = this.dom.gridContainer.querySelector(`[data-slot-index="${slotIndex}"]`);
    if (tileEl) {
      tileEl.classList.add('is-selected-source');
    }
  }

  moveSelectedBlock(direction) {
    if (this.selectedSlotIndex === null || this.selectedSlotIndex === undefined) return;
    const newIndex = this.engine.moveSlot(this.selectedSlotIndex, direction);
    if (newIndex !== null && newIndex !== undefined) {
      this.selectedSlotIndex = newIndex;
      this.showTileActionBar(newIndex);
      this.showToast(`Moved block ${direction}`, 'success');
    } else {
      this.showToast(`Cannot move block ${direction} (edge reached)`, 'info');
    }
  }

  hideTileActionBar() {
    if (this.dom.tileActionBar) {
      this.dom.tileActionBar.classList.add('hidden');
    }
    this.selectedSlotIndex = null;
  }

  clearSelection() {
    if (this.selectedSource && this.selectedSource.el) {
      this.selectedSource.el.classList.remove('is-selected-source', 'is-selected-table-row');
    }
    document.querySelectorAll('.is-selected-source, .is-selected-table-row').forEach(el => {
      el.classList.remove('is-selected-source', 'is-selected-table-row');
    });
    this.selectedSource = null;
    this.hideTileActionBar();
  }

  toggleHeroImage(itemId) {
    const item = this.uploadedImages.find(i => i.id === itemId);
    if (!item) return;

    item.isHero = !item.isHero;
    const activeHeroes = this.uploadedImages.filter(i => i.isHero);

    if (item.isHero) {
      if (activeHeroes.length > this.engine.heroCount) {
        this.engine.setHeroCount(activeHeroes.length);
        if (this.dom.activeHeroesCountBadge) {
          this.dom.activeHeroesCountBadge.innerText = `${activeHeroes.length} ${activeHeroes.length === 1 ? 'Hero' : 'Heroes'}`;
        }
        if (this.dom.customHeroInput) {
          this.dom.customHeroInput.value = activeHeroes.length;
        }
        this.dom.heroNumBtns.forEach(btn => {
          const bCount = parseInt(btn.dataset.count, 10);
          btn.className = (bCount === activeHeroes.length)
            ? 'hero-num-btn active p-1.5 rounded-lg border border-slate-900 bg-slate-900 text-white text-center transition-all'
            : 'hero-num-btn p-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-900 text-slate-700 text-center transition-all';
        });
      }
      this.showToast(`Starred as Hero #${activeHeroes.length}`, 'success');
    } else {
      this.showToast('Removed from Hero images', 'info');
    }

    this.updateHeroStatusUI();
    this.updateUploadTray();
    this.engine.calculateLayout();
    this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
  }

  setHeroCountState(count) {
    this.engine.setHeroCount(count);
    if (this.dom.activeHeroesCountBadge) {
      this.dom.activeHeroesCountBadge.innerText = `${count} ${count === 1 ? 'Hero' : 'Heroes'}`;
    }
    if (this.dom.customHeroInput) {
      this.dom.customHeroInput.value = count;
    }

    this.dom.heroNumBtns.forEach(btn => {
      const bCount = parseInt(btn.dataset.count, 10);
      if (bCount === count) {
        btn.className = 'hero-num-btn active p-1.5 rounded-lg border border-slate-900 bg-slate-900 text-white text-center transition-all';
      } else {
        btn.className = 'hero-num-btn p-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-900 text-slate-700 text-center transition-all';
      }
    });

    const activeHeroes = this.uploadedImages.filter(i => i.isHero);
    if (activeHeroes.length < count && this.uploadedImages.length > 0) {
      let needed = count - activeHeroes.length;
      for (let i = 0; i < this.uploadedImages.length && needed > 0; i++) {
        if (!this.uploadedImages[i].isHero) {
          this.uploadedImages[i].isHero = true;
          needed--;
        }
      }
    } else if (activeHeroes.length > count) {
      let excess = activeHeroes.length - count;
      for (let i = this.uploadedImages.length - 1; i >= 0 && excess > 0; i--) {
        if (this.uploadedImages[i].isHero) {
          this.uploadedImages[i].isHero = false;
          excess--;
        }
      }
    }

    this.updateHeroStatusUI();
    this.updateUploadTray();
    this.engine.calculateLayout();
    this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
  }

  setHeroSize(span) {
    this.engine.setHeroSpan(span);
    const labels = { 2: '2×2 Medium', 3: '3×3 Large', 4: '4×4 X-Large', 5: '5×5 Giant' };
    this.dom.heroSizeBadge.innerText = labels[span] || `${span}×${span}`;

    this.dom.heroSizeBtns.forEach(btn => {
      const bSpan = parseInt(btn.dataset.span, 10);
      if (bSpan === span) {
        btn.className = 'hero-size-btn active p-1.5 rounded-lg border border-slate-900 bg-slate-900 text-white text-center transition-all';
      } else {
        btn.className = 'hero-size-btn p-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-900 text-slate-700 text-center transition-all';
      }
    });

    this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
  }

  updateNormalCoverSize(cols) {
    let label = 'Medium';
    if (cols >= 12) label = 'Compact';
    else if (cols >= 9) label = 'Standard';
    else if (cols >= 7) label = 'Medium';
    else if (cols >= 5) label = 'Large';
    else label = 'X-Large';

    this.dom.colsBadge.innerText = `${cols} cols (${label})`;

    this.dom.normalSizeBtns.forEach(btn => {
      const bCols = parseInt(btn.dataset.cols, 10);
      if (bCols === cols) {
        btn.className = 'normal-size-btn active p-1.5 rounded-lg border border-slate-900 bg-slate-900 text-white text-center transition-all';
      } else {
        btn.className = 'normal-size-btn p-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-900 text-slate-700 text-center transition-all';
      }
    });

    this.engine.setDimensions(this.canvasWidth, this.canvasHeight, cols);
    this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
  }

  updateHeroStatusUI() {
    this.dom.heroAssignedCount.innerText = `${this.heroImages.length} selected`;
  }

  bindEvents() {
    // Mode Switcher
    if (this.dom.modeDragBtn) {
      this.dom.modeDragBtn.addEventListener('click', () => this.setInteractionMode('drag'));
    }
    if (this.dom.modeSelectBtn) {
      this.dom.modeSelectBtn.addEventListener('click', () => this.setInteractionMode('select'));
    }

    // Escape key clears selection, Delete/Backspace deletes/splits selected block, Arrow keys move block
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      if (e.key === 'Escape') {
        this.clearSelection();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedSlotIndex !== null && this.selectedSlotIndex !== undefined) {
          const slot = this.engine.slots[this.selectedSlotIndex];
          if (slot && (slot.isHero || slot.spanRow > 1 || slot.spanCol > 1)) {
            const res = this.engine.subdivideSlot(this.selectedSlotIndex);
            if (res) {
              this.showToast(`Removed block and fitted ${res.count} normal square blocks in its place!`, 'success');
              this.hideTileActionBar();
              this.clearSelection();
              this.updateHeroStatusUI();
            }
          } else if (this.selectedSlotIndex !== null) {
            this.engine.clearSlotImage(this.selectedSlotIndex);
            this.showToast('Photo cleared from block', 'info');
            this.hideTileActionBar();
            this.clearSelection();
          }
        }
      } else if (e.key === 'ArrowUp') {
        if (this.selectedSlotIndex !== null && this.selectedSlotIndex !== undefined) {
          e.preventDefault();
          this.moveSelectedBlock('up');
        }
      } else if (e.key === 'ArrowDown') {
        if (this.selectedSlotIndex !== null && this.selectedSlotIndex !== undefined) {
          e.preventDefault();
          this.moveSelectedBlock('down');
        }
      } else if (e.key === 'ArrowLeft') {
        if (this.selectedSlotIndex !== null && this.selectedSlotIndex !== undefined) {
          e.preventDefault();
          this.moveSelectedBlock('left');
        }
      } else if (e.key === 'ArrowRight') {
        if (this.selectedSlotIndex !== null && this.selectedSlotIndex !== undefined) {
          e.preventDefault();
          this.moveSelectedBlock('right');
        }
      }
    });

    // Floating Tile Action Bar Directional Move Buttons
    if (this.dom.tileMoveLeftBtn) {
      this.dom.tileMoveLeftBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.moveSelectedBlock('left');
      });
    }
    if (this.dom.tileMoveUpBtn) {
      this.dom.tileMoveUpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.moveSelectedBlock('up');
      });
    }
    if (this.dom.tileMoveDownBtn) {
      this.dom.tileMoveDownBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.moveSelectedBlock('down');
      });
    }
    if (this.dom.tileMoveRightBtn) {
      this.dom.tileMoveRightBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.moveSelectedBlock('right');
      });
    }

    // Floating Tile Action Bar Button Events
    if (this.dom.tileSplitBtn) {
      this.dom.tileSplitBtn.addEventListener('click', () => {
        if (this.selectedSlotIndex !== null && this.selectedSlotIndex !== undefined) {
          const res = this.engine.subdivideSlot(this.selectedSlotIndex);
          if (res) {
            this.showToast(`Removed block and fitted ${res.count} normal square blocks in its place!`, 'success');
            this.hideTileActionBar();
            this.clearSelection();
            this.updateHeroStatusUI();
          }
        }
      });
    }

    if (this.dom.tileReplaceBtn) {
      this.dom.tileReplaceBtn.addEventListener('click', () => {
        if (this.selectedSlotIndex !== null && this.selectedSlotIndex !== undefined) {
          this.targetSlotForReplace = this.selectedSlotIndex;
          this.dom.singleSlotFileInput.click();
        }
      });
    }

    if (this.dom.tileClearBtn) {
      this.dom.tileClearBtn.addEventListener('click', () => {
        if (this.selectedSlotIndex !== null && this.selectedSlotIndex !== undefined) {
          this.engine.clearSlotImage(this.selectedSlotIndex);
          this.showToast('Photo cleared from block', 'info');
          this.hideTileActionBar();
          this.clearSelection();
        }
      });
    }

    if (this.dom.tileActionCloseBtn) {
      this.dom.tileActionCloseBtn.addEventListener('click', () => {
        this.hideTileActionBar();
        this.clearSelection();
      });
    }

    // Sidebar Tabs
    if (this.dom.tabBtns) {
      this.dom.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const targetTab = btn.dataset.tab;
          this.dom.tabBtns.forEach(b => {
            b.className = 'tab-btn flex-1 py-1.5 rounded-lg font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition-all';
          });
          btn.className = 'tab-btn flex-1 py-1.5 rounded-lg font-bold text-slate-900 bg-white shadow-sm border border-slate-200/60 flex items-center justify-center gap-1.5 transition-all';

          if (this.dom.tabPanes) {
            this.dom.tabPanes.forEach(pane => {
              pane.classList.toggle('hidden', pane.id !== targetTab);
            });
          }
        });
      });
    }

    // Category Pills
    if (this.dom.catPills) {
      this.dom.catPills.forEach(pill => {
        pill.addEventListener('click', () => {
          this.dom.catPills.forEach(p => {
            p.className = 'cat-pill py-1.5 rounded-lg font-semibold text-center text-slate-600 hover:text-slate-900 transition-all';
          });
          pill.className = 'cat-pill active py-1.5 rounded-lg font-bold text-center bg-white shadow-sm text-slate-900 transition-all';
          this.renderPresetCards(pill.dataset.cat);
        });
      });
    }

    // Custom dimensions
    if (this.dom.customW) {
      this.dom.customW.addEventListener('input', () => {
        const val = parseInt(this.dom.customW.value, 10);
        if (val >= 300) {
          this.canvasWidth = val;
          this.updateGridDimensions();
          this.engine.render();
        }
      });
    }

    if (this.dom.customH) {
      this.dom.customH.addEventListener('input', () => {
        const val = parseInt(this.dom.customH.value, 10);
        if (val >= 300) {
          this.canvasHeight = val;
          this.updateGridDimensions();
          this.engine.render();
        }
      });
    }

    // Layout Mode Buttons
    if (this.dom.layoutModeBtns) {
      this.dom.layoutModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.dom.layoutModeBtns.forEach(b => {
            b.className = b.classList.contains('col-span-2')
              ? 'layout-mode-btn col-span-2 p-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:border-slate-400 text-left transition-all flex items-center justify-between'
              : 'layout-mode-btn p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:border-slate-400 text-left transition-all flex items-center gap-2';
          });

          btn.className = btn.classList.contains('col-span-2')
            ? 'layout-mode-btn active col-span-2 p-2 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-left transition-all flex items-center justify-between'
            : 'layout-mode-btn active p-2.5 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-left transition-all flex items-center gap-2';

          const mode = btn.dataset.mode;
          this.engine.setLayoutMode(mode);
          this.setHeroCountState(this.engine.heroCount);
          this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
          this.showToast(`Switched to: ${mode}`, 'info');
        });
      });
    }

    // Hero Number Buttons
    if (this.dom.heroNumBtns) {
      this.dom.heroNumBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const count = parseInt(btn.dataset.count, 10);
          this.setHeroCountState(count);
          this.showToast(`Layout updated to ${count} ${count === 1 ? 'Hero' : 'Heroes'}`, 'info');
        });
      });
    }

    // Custom Hero Count Input
    if (this.dom.customHeroInput) {
      this.dom.customHeroInput.addEventListener('input', () => {
        const count = parseInt(this.dom.customHeroInput.value, 10);
        if (!isNaN(count) && count >= 0) {
          this.setHeroCountState(count);
        }
      });
    }

    // Hero Size Buttons
    if (this.dom.heroSizeBtns) {
      this.dom.heroSizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const span = parseInt(btn.dataset.span, 10);
          this.setHeroSize(span);
          this.showToast(`Hero tile size set to ${span}×${span}`, 'info');
        });
      });
    }

    // Normal Size Buttons
    if (this.dom.normalSizeBtns) {
      this.dom.normalSizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const cols = parseInt(btn.dataset.cols, 10);
          if (this.dom.colsSlider) this.dom.colsSlider.value = cols;
          this.updateNormalCoverSize(cols);
          this.showToast('Normal cover size updated', 'info');
        });
      });
    }

    // Photo Tile Cutout Shape
    if (this.dom.tileShapeBtns) {
      this.dom.tileShapeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const tileShape = btn.dataset.tileShape;
          this.dom.tileShapeBtns.forEach(b => {
            b.className = 'tile-shape-btn p-2 rounded-xl border border-slate-200 bg-white hover:border-slate-400 text-slate-700 font-semibold text-center transition-all flex flex-col items-center gap-1';
          });
          btn.className = 'tile-shape-btn active p-2 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-center transition-all flex flex-col items-center gap-1';

          if (this.dom.activeTileShapeBadge) {
            this.dom.activeTileShapeBadge.innerText = tileShape.charAt(0).toUpperCase() + tileShape.slice(1);
          }

          this.engine.setTileShape(tileShape);
          this.showToast(`Photo tiles: ${tileShape.toUpperCase()}`, 'info');
        });
      });
    }

    // Hero Photos Shape
    if (this.dom.heroShapeBtns) {
      this.dom.heroShapeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const shape = btn.dataset.heroShape;
          this.dom.heroShapeBtns.forEach(b => {
            b.className = 'hero-shape-btn p-1.5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 text-slate-700 font-semibold text-center transition-all flex flex-col items-center gap-0.5';
          });
          btn.className = 'hero-shape-btn active p-1.5 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-center transition-all flex flex-col items-center gap-0.5';

          if (this.dom.activeHeroShapeBadge) {
            this.dom.activeHeroShapeBadge.innerText = shape === 'same' ? 'Match Grid' : shape.charAt(0).toUpperCase() + shape.slice(1);
          }

          this.engine.setHeroTileShape(shape);
          this.showToast(`Hero shape: ${shape === 'same' ? 'Match Grid' : shape.toUpperCase()}`, 'info');
        });
      });
    }

    // Vertical (1x2) Shape Toggle
    if (this.dom.toggleVerticalBtn) {
      this.dom.toggleVerticalBtn.addEventListener('click', () => {
        const isAllowed = !this.engine.allowVertical;
        this.engine.setVerticalAllowed(isAllowed);

        if (isAllowed) {
          this.dom.toggleVerticalBtn.className = 'shape-toggle-btn active p-2 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-xs flex items-center justify-between transition-all';
          this.dom.toggleVerticalBtn.querySelector('.shape-status').innerText = 'ON';
          this.dom.toggleVerticalBtn.querySelector('.shape-status').className = 'shape-status text-[9px] px-1.5 py-0.5 rounded bg-white/20 text-white font-bold';
          this.showToast('Vertical (1×2) covers enabled', 'info');
        } else {
          this.dom.toggleVerticalBtn.className = 'shape-toggle-btn p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-400 font-semibold text-xs flex items-center justify-between transition-all';
          this.dom.toggleVerticalBtn.querySelector('.shape-status').innerText = 'OFF';
          this.dom.toggleVerticalBtn.querySelector('.shape-status').className = 'shape-status text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold';
          this.showToast('Vertical (1×2) covers removed', 'info');
        }

        this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
      });
    }

    // Horizontal (2x1) Shape Toggle
    if (this.dom.toggleHorizontalBtn) {
      this.dom.toggleHorizontalBtn.addEventListener('click', () => {
        const isAllowed = !this.engine.allowHorizontal;
        this.engine.setHorizontalAllowed(isAllowed);

        if (isAllowed) {
          this.dom.toggleHorizontalBtn.className = 'shape-toggle-btn active p-2 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-xs flex items-center justify-between transition-all';
          this.dom.toggleHorizontalBtn.querySelector('.shape-status').innerText = 'ON';
          this.dom.toggleHorizontalBtn.querySelector('.shape-status').className = 'shape-status text-[9px] px-1.5 py-0.5 rounded bg-white/20 text-white font-bold';
          this.showToast('Horizontal (2×1) covers enabled', 'info');
        } else {
          this.dom.toggleHorizontalBtn.className = 'shape-toggle-btn p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-400 font-semibold text-xs flex items-center justify-between transition-all';
          this.dom.toggleHorizontalBtn.querySelector('.shape-status').innerText = 'OFF';
          this.dom.toggleHorizontalBtn.querySelector('.shape-status').className = 'shape-status text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold';
          this.showToast('Horizontal (2×1) covers removed', 'info');
        }

        this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
      });
    }

    // Re-Randomize layout button
    if (this.dom.randomizeLayoutBtn) {
      this.dom.randomizeLayoutBtn.addEventListener('click', () => {
        this.engine.calculateLayout();
        this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
        this.showToast('New random layout geometry generated!', 'success');
      });
    }

    // Columns Slider
    if (this.dom.colsSlider) {
      this.dom.colsSlider.addEventListener('input', (e) => {
        const cols = parseInt(e.target.value, 10);
        this.updateNormalCoverSize(cols);
      });
    }

    // Sliders: Gap, Radius, Padding
    if (this.dom.gapSlider) {
      this.dom.gapSlider.addEventListener('input', (e) => {
        const gap = parseInt(e.target.value, 10);
        if (this.dom.gapBadge) this.dom.gapBadge.innerText = `${gap}px`;
        this.engine.gap = gap;
        this.engine.render();
      });
    }

    if (this.dom.radiusSlider) {
      this.dom.radiusSlider.addEventListener('input', (e) => {
        const r = parseInt(e.target.value, 10);
        if (this.dom.radiusBadge) this.dom.radiusBadge.innerText = `${r}px`;
        this.engine.radius = r;
        this.engine.render();
      });
    }

    if (this.dom.paddingSlider) {
      this.dom.paddingSlider.addEventListener('input', (e) => {
        const p = parseInt(e.target.value, 10);
        if (this.dom.paddingBadge) this.dom.paddingBadge.innerText = `${p}px`;
        this.engine.padding = p;
        this.engine.render();
      });
    }

    // Background Color Swatches
    if (this.dom.colorDots) {
      this.dom.colorDots.forEach(btn => {
        btn.addEventListener('click', () => {
          this.dom.colorDots.forEach(b => b.classList.remove('border-2', 'border-slate-900'));
          btn.classList.add('border-2', 'border-slate-900');
          const color = btn.dataset.color;
          if (this.dom.colorHexBadge) this.dom.colorHexBadge.innerText = color;
          this.engine.backgroundColor = color;
          this.engine.render();
        });
      });
    }

    if (this.dom.customColorPicker) {
      this.dom.customColorPicker.addEventListener('input', (e) => {
        const color = e.target.value;
        if (this.dom.colorHexBadge) this.dom.colorHexBadge.innerText = color;
        this.engine.backgroundColor = color;
        this.engine.render();
      });
    }

    // Tone Filters
    if (this.dom.filterChips) {
      this.dom.filterChips.forEach(btn => {
        btn.addEventListener('click', () => {
          this.dom.filterChips.forEach(b => {
            b.className = 'filter-chip py-1.5 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:border-slate-400 text-left transition-all flex items-center gap-1.5';
          });
          btn.className = 'filter-chip active py-1.5 px-2.5 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-left transition-all flex items-center gap-1.5';
          this.activeFilter = btn.dataset.filter;
          this.engine.filterClass = this.activeFilter;
          this.engine.render();
        });
      });
    }

    // Quick Actions
    if (this.dom.shuffleBtn) {
      this.dom.shuffleBtn.addEventListener('click', () => {
        this.engine.shuffle();
        this.showToast('Normal covers shuffled! (Heroes locked)', 'info');
      });
    }

    if (this.dom.fillGridBtn) {
      this.dom.fillGridBtn.addEventListener('click', () => {
        if (this.uploadedImages.length === 0) {
          this.showToast('Upload some photos first or pick a preset theme!', 'warning');
          return;
        }
        this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
        this.showToast('Grid filled with photos!', 'success');
      });
    }

    if (this.dom.clearBtn) {
      this.dom.clearBtn.addEventListener('click', () => {
        if (confirm('Clear all images from the wallpaper canvas?')) {
          this.engine.slotImages = [];
          this.clearSelection();
          this.engine.render();
          this.showToast('Canvas cleared to skeleton', 'info');
        }
      });
    }

    // Clear All Uploads from Right Tray
    if (this.dom.clearTrayBtn) {
      this.dom.clearTrayBtn.addEventListener('click', () => {
        if (confirm('Remove all uploaded photos from the gallery?')) {
          this.uploadedImages = [];
          this.engine.slotImages = [];
          this.clearSelection();
          this.engine.render();
          this.updateUploadTray();
          this.updateHeroStatusUI();
          this.showToast('All uploads cleared', 'info');
        }
      });
    }

    // Toggle Phone Frame Bezel
    if (this.dom.toggleFrameBtn) {
      this.dom.toggleFrameBtn.addEventListener('click', () => {
        this.showDeviceFrame = !this.showDeviceFrame;
        this.dom.toggleFrameBtn.classList.toggle('bg-slate-200', this.showDeviceFrame);
        this.updateCanvasAspectBox();
      });
    }

    // File Uploads
    if (this.dom.fileInput) {
      this.dom.fileInput.addEventListener('change', (e) => {
        this.handleFileSelection(e.target.files);
      });
    }

    // Single Slot File Replacement
    if (this.dom.singleSlotFileInput) {
      this.dom.singleSlotFileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        if (!this.isValidImage(file)) {
          this.showToast('Invalid file! Only JPG, PNG, WEBP allowed.', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          if (this.targetSlotForReplace !== null) {
            this.engine.slotImages[this.targetSlotForReplace] = dataUrl;
            this.engine.render();
            this.showToast('Slot updated!', 'success');
          }
        };
        reader.readAsDataURL(file);
        this.dom.singleSlotFileInput.value = '';
      });
    }

    // Dropzone Drag & Drop
    const dropzone = this.dom.dropzone;
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.classList.add('border-slate-900', 'bg-slate-100');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.classList.remove('border-slate-900', 'bg-slate-100');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files && dt.files.length > 0) {
          this.handleFileSelection(dt.files);
        }
      });
    }

    // Export Modal Actions
    if (this.dom.exportBtn) {
      this.dom.exportBtn.addEventListener('click', () => {
        this.openExportModal();
      });
    }

    if (this.dom.closeExportModalBtn) {
      this.dom.closeExportModalBtn.addEventListener('click', () => {
        if (this.dom.exportModal) this.dom.exportModal.classList.add('hidden');
      });
    }

    if (this.dom.cancelExportBtn) {
      this.dom.cancelExportBtn.addEventListener('click', () => {
        if (this.dom.exportModal) this.dom.exportModal.classList.add('hidden');
      });
    }

    if (this.dom.confirmExportBtn) {
      this.dom.confirmExportBtn.addEventListener('click', () => {
        this.downloadWallpaper();
      });
    }

    // Collapsible Sidebars Toggle & Expand Handlers
    if (this.dom.toggleLeftSidebarBtn) {
      this.dom.toggleLeftSidebarBtn.addEventListener('click', () => this.toggleLeftSidebar());
    }
    if (this.dom.collapseLeftBtn) {
      this.dom.collapseLeftBtn.addEventListener('click', () => this.toggleLeftSidebar(false));
    }
    if (this.dom.expandLeftBtn) {
      this.dom.expandLeftBtn.addEventListener('click', () => this.toggleLeftSidebar(true));
    }

    if (this.dom.toggleRightSidebarBtn) {
      this.dom.toggleRightSidebarBtn.addEventListener('click', () => this.toggleRightSidebar());
    }
    if (this.dom.collapseRightBtn) {
      this.dom.collapseRightBtn.addEventListener('click', () => this.toggleRightSidebar(false));
    }
    if (this.dom.expandRightBtn) {
      this.dom.expandRightBtn.addEventListener('click', () => this.toggleRightSidebar(true));
    }

    // Keyboard Shortcuts to toggle sidebars
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '[' || (e.ctrlKey && e.key === 'b')) {
        e.preventDefault();
        this.toggleLeftSidebar();
      } else if (e.key === ']') {
        e.preventDefault();
        this.toggleRightSidebar();
      }
    });

    this.renderPresetLayoutCards();
  }

  initSidebarResizers() {
    const leftResizer = this.dom.leftSidebarResizer;
    const rightResizer = this.dom.rightSidebarResizer;
    const leftSidebar = this.dom.leftSidebar;
    const rightSidebar = this.dom.rightSidebar;

    // Load persisted widths from localStorage
    try {
      const savedLeftW = localStorage.getItem('vibewall_left_sidebar_w');
      if (savedLeftW && leftSidebar) {
        const w = parseInt(savedLeftW, 10);
        if (w >= 260 && w <= 650) {
          leftSidebar.style.width = `${w}px`;
        }
      }
      const savedRightW = localStorage.getItem('vibewall_right_sidebar_w');
      if (savedRightW && rightSidebar) {
        const w = parseInt(savedRightW, 10);
        if (w >= 280 && w <= 750) {
          rightSidebar.style.width = `${w}px`;
        }
      }
    } catch (e) {}

    // Left Sidebar Drag Resizer
    if (leftResizer && leftSidebar) {
      let isDragging = false;
      let startX = 0;
      let startWidth = 0;

      const onPointerDown = (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        isDragging = true;
        startX = e.clientX;
        startWidth = leftSidebar.getBoundingClientRect().width;
        leftResizer.classList.add('is-resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        leftSidebar.style.transition = 'none';
        leftResizer.setPointerCapture(e.pointerId);
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        let newWidth = Math.max(260, Math.min(650, startWidth + deltaX));
        leftSidebar.style.width = `${newWidth}px`;
        try { localStorage.setItem('vibewall_left_sidebar_w', newWidth); } catch (err) {}
        this.fitCanvasToViewport();
      };

      const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        leftResizer.classList.remove('is-resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        leftSidebar.style.transition = '';
        try { leftResizer.releasePointerCapture(e.pointerId); } catch (err) {}
        this.fitCanvasToViewport();
      };

      leftResizer.addEventListener('pointerdown', onPointerDown);
      leftResizer.addEventListener('pointermove', onPointerMove);
      leftResizer.addEventListener('pointerup', onPointerUp);
      leftResizer.addEventListener('pointercancel', onPointerUp);
    }

    // Right Sidebar Drag Resizer
    if (rightResizer && rightSidebar) {
      let isDragging = false;
      let startX = 0;
      let startWidth = 0;

      const onPointerDown = (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        isDragging = true;
        startX = e.clientX;
        startWidth = rightSidebar.getBoundingClientRect().width;
        rightResizer.classList.add('is-resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        rightSidebar.style.transition = 'none';
        rightResizer.setPointerCapture(e.pointerId);
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const deltaX = startX - e.clientX;
        let newWidth = Math.max(280, Math.min(750, startWidth + deltaX));
        rightSidebar.style.width = `${newWidth}px`;
        try { localStorage.setItem('vibewall_right_sidebar_w', newWidth); } catch (err) {}
        this.fitCanvasToViewport();
      };

      const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        rightResizer.classList.remove('is-resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        rightSidebar.style.transition = '';
        try { rightResizer.releasePointerCapture(e.pointerId); } catch (err) {}
        this.fitCanvasToViewport();
      };

      rightResizer.addEventListener('pointerdown', onPointerDown);
      rightResizer.addEventListener('pointermove', onPointerMove);
      rightResizer.addEventListener('pointerup', onPointerUp);
      rightResizer.addEventListener('pointercancel', onPointerUp);
    }
  }

  toggleLeftSidebar(forceOpen = null) {
    if (!this.dom.leftSidebar) return;
    const isCurrentlyCollapsed = this.dom.leftSidebar.classList.contains('is-collapsed');
    const shouldCollapse = forceOpen !== null ? !forceOpen : !isCurrentlyCollapsed;
    this.dom.leftSidebar.classList.toggle('is-collapsed', shouldCollapse);
    if (this.dom.leftSidebarResizer) {
      this.dom.leftSidebarResizer.classList.toggle('hidden', shouldCollapse);
    }
    if (this.dom.expandLeftBtn) {
      this.dom.expandLeftBtn.classList.toggle('hidden', !shouldCollapse);
    }
    if (this.dom.toggleLeftSidebarBtn) {
      this.dom.toggleLeftSidebarBtn.classList.toggle('bg-white', !shouldCollapse);
      this.dom.toggleLeftSidebarBtn.classList.toggle('shadow-sm', !shouldCollapse);
    }
    this.animateCanvasFit(350);
  }

  toggleRightSidebar(forceOpen = null) {
    if (!this.dom.rightSidebar) return;
    const isCurrentlyCollapsed = this.dom.rightSidebar.classList.contains('is-collapsed');
    const shouldCollapse = forceOpen !== null ? !forceOpen : !isCurrentlyCollapsed;
    this.dom.rightSidebar.classList.toggle('is-collapsed', shouldCollapse);
    if (this.dom.rightSidebarResizer) {
      this.dom.rightSidebarResizer.classList.toggle('hidden', shouldCollapse);
    }
    if (this.dom.expandRightBtn) {
      this.dom.expandRightBtn.classList.toggle('hidden', !shouldCollapse);
    }
    if (this.dom.toggleRightSidebarBtn) {
      this.dom.toggleRightSidebarBtn.classList.toggle('bg-white', !shouldCollapse);
      this.dom.toggleRightSidebarBtn.classList.toggle('shadow-sm', !shouldCollapse);
    }
    this.animateCanvasFit(350);
  }

  isValidImage(file) {
    if (!file) return false;
    const validExt = /\.(jpe?g|png|webp|avif|gif)$/i;
    return (file.type && file.type.startsWith('image/')) || validExt.test(file.name || '');
  }

  handleFileSelection(fileList) {
    const files = Array.from(fileList);
    let validFiles = [];
    let invalidCount = 0;

    files.forEach(f => {
      if (this.isValidImage(f)) {
        validFiles.push(f);
      } else {
        invalidCount++;
      }
    });

    if (invalidCount > 0) {
      this.showToast(`${invalidCount} file(s) skipped. Only JPG, PNG, WEBP allowed!`, 'error');
    }

    if (validFiles.length === 0) return;

    this.showToast(`Loading ${validFiles.length} photo(s)...`, 'info');

    let loadedCount = 0;
    const newItems = [];

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        newItems.push({
          id: 'img_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
          src: dataUrl,
          isHero: false
        });
        loadedCount++;

        if (loadedCount === validFiles.length) {
          if (this.isUsingStarterImages) {
            this.uploadedImages = [];
            this.isUsingStarterImages = false;
          }

          const existingHeroCount = this.uploadedImages.filter(i => i.isHero).length;
          const targetHeroes = this.engine.heroCount || 3;
          let neededHeroes = Math.max(0, targetHeroes - existingHeroCount);

          for (let i = 0; i < newItems.length && neededHeroes > 0; i++) {
            newItems[i].isHero = true;
            neededHeroes--;
          }

          this.uploadedImages.push(...newItems);

          this.updateUploadTray();
          this.updateHeroStatusUI();
          this.engine.calculateLayout();
          this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
          this.showToast(`Added ${loadedCount} photo(s) to gallery!`, 'success');
        }
      };
      reader.readAsDataURL(file);
    });

    this.dom.fileInput.value = '';
  }

  deleteUploadedImage(idx) {
    const [removed] = this.uploadedImages.splice(idx, 1);
    const activeHeroes = this.uploadedImages.filter(i => i.isHero);

    if (activeHeroes.length === 0 && this.uploadedImages.length > 0 && this.engine.heroCount > 0) {
      const countToHero = Math.min(this.engine.heroCount, this.uploadedImages.length);
      for (let i = 0; i < countToHero; i++) {
        this.uploadedImages[i].isHero = true;
      }
    }

    this.clearSelection();
    this.updateUploadTray();
    this.updateHeroStatusUI();
    this.engine.calculateLayout();
    this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
    this.showToast('Photo removed from gallery', 'info');
  }

  updateUploadTray() {
    this.dom.trayCountBadge.innerText = `${this.uploadedImages.length} images`;
    this.dom.uploadTableBody.innerHTML = '';

    if (this.uploadedImages.length === 0) {
      this.dom.uploadTableBody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center py-10 px-3 text-slate-400">
            <svg class="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            <p class="text-xs font-semibold text-slate-600">No photos uploaded</p>
            <p class="text-[10px] text-slate-400 mt-1">Upload JPG/PNG images above to populate table</p>
          </td>
        </tr>
      `;
      return;
    }

    this.uploadedImages.forEach((item, idx) => {
      const isHero = item.isHero;
      const isSelected = this.selectedSource && this.selectedSource.type === 'tray' && this.selectedSource.id === item.id;

      const row = document.createElement('tr');
      row.className = `upload-table-row group border-b border-slate-100 ${isSelected ? 'is-selected-table-row' : ''}`;

      // 1. Photo cell
      const coverTd = document.createElement('td');
      coverTd.className = 'py-2 px-3';
      coverTd.innerHTML = `
        <div class="flex items-center gap-2.5">
          <div class="w-11 h-11 rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 bg-slate-100 shadow-sm relative">
            <img src="${item.src}" class="w-full h-full object-cover select-none pointer-events-none" alt="Photo ${idx + 1}" loading="lazy">
          </div>
          <div class="min-w-0">
            <div class="text-[11px] font-bold text-slate-900 truncate">Photo #${idx + 1}</div>
            <div class="text-[9px] text-slate-400 font-mono">JPG/PNG</div>
          </div>
        </div>
      `;

      // 2. Role cell
      const roleTd = document.createElement('td');
      roleTd.className = 'py-2 px-2';
      if (isHero) {
        roleTd.innerHTML = `
          <span class="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
            <svg class="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span>HERO</span>
          </span>
        `;
      } else {
        roleTd.innerHTML = `
          <span class="text-[9px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            Standard
          </span>
        `;
      }

      // 3. Actions cell
      const currentPhotoShape = item.shape || 'default';
      const actionsTd = document.createElement('td');
      actionsTd.className = 'py-2 px-3 text-right';
      actionsTd.innerHTML = `
        <div class="flex items-center justify-end gap-1.5">
          <select class="photo-shape-select text-[10px] py-1 px-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:border-slate-400 outline-none cursor-pointer" title="Custom shape for this specific photo">
            <option value="default" ${currentPhotoShape === 'default' ? 'selected' : ''}>Default (Square)</option>
            <option value="heart" ${currentPhotoShape === 'heart' ? 'selected' : ''}>Heart</option>
            <option value="unicorn" ${currentPhotoShape === 'unicorn' ? 'selected' : ''}>Unicorn</option>
            <option value="star" ${currentPhotoShape === 'star' ? 'selected' : ''}>Star</option>
            <option value="diamond" ${currentPhotoShape === 'diamond' ? 'selected' : ''}>Diamond</option>
            <option value="circle" ${currentPhotoShape === 'circle' ? 'selected' : ''}>Circle</option>
            <option value="hexagon" ${currentPhotoShape === 'hexagon' ? 'selected' : ''}>Hexagon</option>
            <option value="butterfly" ${currentPhotoShape === 'butterfly' ? 'selected' : ''}>Butterfly</option>
            <option value="rounded" ${currentPhotoShape === 'rounded' ? 'selected' : ''}>Rounded</option>
          </select>
          <button class="star-hero-btn p-1.5 rounded-lg text-xs transition-all ${isHero ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-700'}" title="${isHero ? 'Unset Hero' : 'Set as Hero'}">
            <svg class="w-3.5 h-3.5 fill-current pointer-events-none" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </button>
          <button class="delete-btn p-1.5 rounded-lg text-xs bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors" title="Delete Photo">
            <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      `;

      row.appendChild(coverTd);
      row.appendChild(roleTd);
      row.appendChild(actionsTd);

      // Drag events
      row.draggable = (this.interactionMode === 'drag');
      row.addEventListener('dragstart', (e) => {
        if (this.interactionMode !== 'drag') return;
        window.__dragState = {
          type: 'tray',
          imgSrc: item.src
        };
        row.classList.add('is-dragging');
        e.dataTransfer.setData('text/plain', `tray-src:${encodeURIComponent(item.src)}`);
        e.dataTransfer.effectAllowed = 'copy';
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging');
        setTimeout(() => {
          window.__dragState = null;
        }, 50);
      });

      // Row Click event for Selection Mode
      row.addEventListener('click', () => {
        if (this.interactionMode === 'select') {
          this.handleTrayCardClick(item.src, row, item.id);
        }
      });

      const shapeSelect = actionsTd.querySelector('.photo-shape-select');
      if (shapeSelect) {
        shapeSelect.addEventListener('change', (e) => {
          e.stopPropagation();
          const newShape = e.target.value;
          item.shape = newShape;
          this.engine.setImageShape(item.src, newShape);
          this.showToast(`Photo #${idx + 1} shape: ${newShape.toUpperCase()}`, 'success');
        });
      }

      actionsTd.querySelector('.star-hero-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleHeroImage(item.id);
      });

      actionsTd.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteUploadedImage(idx);
      });

      this.dom.uploadTableBody.appendChild(row);
    });
  }

  getLayoutPresetSVG(icon) {
    if (icon === 'single') {
      return '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="6" width="8" height="8" rx="1"/></svg>';
    }
    if (icon === 'dual') {
      return '<svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="5" width="10" height="5" rx="1"/><rect x="7" y="14" width="10" height="5" rx="1"/></svg>';
    }
    if (icon === 'quad') {
      return '<svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="5" y="5" width="6" height="6" rx="1"/><rect x="13" y="5" width="6" height="6" rx="1"/><rect x="5" y="13" width="6" height="6" rx="1"/><rect x="13" y="13" width="6" height="6" rx="1"/></svg>';
    }
    if (icon === 'grid') {
      return '<svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="10" y="3" width="5" height="5" rx="1"/><rect x="17" y="3" width="5" height="5" rx="1"/><rect x="3" y="10" width="5" height="5" rx="1"/><rect x="10" y="10" width="5" height="5" rx="1"/><rect x="17" y="10" width="5" height="5" rx="1"/><rect x="3" y="17" width="5" height="5" rx="1"/><rect x="10" y="17" width="5" height="5" rx="1"/><rect x="17" y="17" width="5" height="5" rx="1"/></svg>';
    }
    if (icon === 'heart') {
      return '<svg class="w-5 h-5 text-rose-500 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
    }
    if (icon === 'unicorn') {
      return '<svg class="w-5 h-5 text-purple-600 fill-current" viewBox="0 0 24 24"><path d="M20 2L15 6L13 4L10 7L7 11L5 15L5 22L10 22L14 20L15 17L17 15L21 13L22 10L20 8L20 2Z"/></svg>';
    }
    if (icon === 'star') {
      return '<svg class="w-5 h-5 text-amber-500 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    }
    if (icon === 'diamond') {
      return '<svg class="w-5 h-5 text-cyan-600 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2L22 12L12 22L2 12Z"/></svg>';
    }
    return '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>';
  }

  renderPresetLayoutCards() {
    this.dom.themesGalleryList.innerHTML = '';
    LAYOUT_PRESETS.forEach(preset => {
      const card = document.createElement('div');
      card.className = 'p-3 rounded-2xl border border-slate-200 bg-white hover:border-slate-900 cursor-pointer flex items-center gap-3 transition-all shadow-sm group';
      card.innerHTML = `
        <div class="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0 group-hover:scale-105 group-hover:bg-slate-100 transition-all shadow-inner">
          ${this.getLayoutPresetSVG(preset.icon)}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between mb-0.5">
            <h4 class="text-xs font-bold text-slate-900 truncate">${preset.name}</h4>
            <span class="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">${preset.tag}</span>
          </div>
          <p class="text-[9px] text-slate-500 line-clamp-1">${preset.description}</p>
        </div>
      `;

      card.addEventListener('click', () => {
        this.applyLayoutPreset(preset);
      });

      this.dom.themesGalleryList.appendChild(card);
    });
  }

  applyLayoutPreset(preset) {
    // 1. Layout Mode & Heroes
    this.engine.setLayoutMode(preset.layoutMode);
    this.setHeroCountState(preset.heroCount);
    this.setHeroSize(preset.heroSize || 3);

    // Update layout mode buttons UI
    this.dom.layoutModeBtns.forEach(btn => {
      const isMatch = btn.dataset.mode === preset.layoutMode;
      btn.className = isMatch
        ? (btn.classList.contains('col-span-2') 
            ? 'layout-mode-btn active col-span-2 p-2 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-left transition-all flex items-center justify-between'
            : 'layout-mode-btn active p-2.5 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-left transition-all flex items-center gap-2')
        : (btn.classList.contains('col-span-2')
            ? 'layout-mode-btn col-span-2 p-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:border-slate-400 text-left transition-all flex items-center justify-between'
            : 'layout-mode-btn p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:border-slate-400 text-left transition-all flex items-center gap-2');
    });

    // 2. Shape Silhouette & Tile Shape
    const shapeSil = preset.shapeSilhouette || 'rectangle';
    const tileShape = preset.tileShape || 'square';
    this.engine.shapeSilhouette = shapeSil;
    this.engine.tileShape = tileShape;

    this.dom.shapeSilBtns.forEach(btn => {
      const isMatch = btn.dataset.shape === shapeSil;
      btn.className = isMatch
        ? (btn.classList.contains('col-span-3')
            ? 'shape-sil-btn active col-span-3 p-2 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-left transition-all flex items-center justify-between'
            : 'shape-sil-btn active p-2 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-left transition-all flex items-center gap-1.5')
        : (btn.classList.contains('col-span-3')
            ? 'shape-sil-btn col-span-3 p-2 rounded-xl border border-slate-200 bg-white hover:border-slate-400 text-slate-700 font-semibold text-left transition-all flex items-center justify-between'
            : 'shape-sil-btn p-2 rounded-xl border border-slate-200 bg-white hover:border-slate-400 text-slate-700 font-semibold text-left transition-all flex items-center gap-1.5');
    });

    this.dom.tileShapeBtns.forEach(btn => {
      const isMatch = btn.dataset.tileShape === tileShape;
      btn.className = isMatch
        ? 'tile-shape-btn active p-2 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-center transition-all flex flex-col items-center gap-1'
        : 'tile-shape-btn p-2 rounded-xl border border-slate-200 bg-white hover:border-slate-400 text-slate-700 font-semibold text-center transition-all flex flex-col items-center gap-1';
    });

    if (this.dom.activeShapeBadge) {
      const names = {
        rectangle: 'Full Grid',
        heart: 'Heart Shape',
        unicorn: 'Unicorn Shape',
        star: 'Star Shape',
        diamond: 'Diamond Shape',
        circle: 'Circle Shape',
        butterfly: 'Butterfly Wings'
      };
      this.dom.activeShapeBadge.innerText = names[shapeSil] || 'Custom Shape';
    }

    if (this.dom.activeTileShapeBadge) {
      this.dom.activeTileShapeBadge.innerText = tileShape.charAt(0).toUpperCase() + tileShape.slice(1);
    }

    // 3. Normal Image Size & Columns
    this.dom.colsSlider.value = preset.cols;
    this.updateNormalCoverSize(preset.cols);

    // 4. Spacing & Geometry
    this.engine.gap = preset.gap;
    this.dom.gapSlider.value = preset.gap;
    this.dom.gapBadge.innerText = `${preset.gap}px`;

    this.engine.radius = preset.radius;
    this.dom.radiusSlider.value = preset.radius;
    this.dom.radiusBadge.innerText = `${preset.radius}px`;

    this.engine.padding = preset.padding;
    this.dom.paddingSlider.value = preset.padding;
    this.dom.paddingBadge.innerText = `${preset.padding}px`;

    // 5. Background Color
    this.engine.backgroundColor = preset.backgroundColor;
    this.dom.colorHexBadge.innerText = preset.backgroundColor;
    this.dom.colorDots.forEach(b => {
      b.classList.toggle('border-2', b.dataset.color === preset.backgroundColor);
      b.classList.toggle('border-slate-900', b.dataset.color === preset.backgroundColor);
    });

    // 6. Tone Filter
    this.activeFilter = preset.filterClass || '';
    this.engine.filterClass = this.activeFilter;
    this.dom.filterChips.forEach(btn => {
      const isFilterMatch = (btn.dataset.filter === this.activeFilter);
      btn.className = isFilterMatch
        ? 'filter-chip active py-1.5 px-2.5 rounded-xl border border-slate-900 bg-slate-900 text-white font-bold text-left transition-all flex items-center gap-1.5'
        : 'filter-chip py-1.5 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:border-slate-400 text-left transition-all flex items-center gap-1.5';
    });

    this.clearSelection();

    // 7. Rerender grid with user's uploaded images untouched!
    this.engine.calculateLayout();
    this.engine.setImages(this.rawUploadedUrls, this.rawHeroUrls);
    this.fitCanvasToViewport();
    this.showToast(`Applied layout preset: ${preset.name}`, 'success');
  }

  // --- High-Resolution Canvas Exporter & Vector Clip Paths ---
  // All polygon points exactly match the CSS clip-path polygons in style.css
  drawShapePath(ctx, shape, x, y, w, h, radius) {
    ctx.beginPath();

    // Helper to plot a % polygon point list onto the canvas tile rect
    const poly = (pts) => {
      pts.forEach(([px, py], i) => {
        const cx = x + px * w;
        const cy = y + py * h;
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
    };

    switch (shape) {
      // Circle — matches: clip-path: circle(50% at 50% 50%)
      case 'circle':
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
        break;

      // Diamond — matches: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)
      case 'diamond':
        poly([[0.50, 0], [1, 0.50], [0.50, 1], [0, 0.50]]);
        break;

      // Hexagon — matches: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)
      case 'hexagon':
        poly([[0.25, 0], [0.75, 0], [1, 0.50], [0.75, 1], [0.25, 1], [0, 0.50]]);
        break;

      // Star — matches: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)
      case 'star':
        poly([
          [0.50, 0], [0.61, 0.35], [0.98, 0.35], [0.68, 0.57], [0.79, 0.91],
          [0.50, 0.70], [0.21, 0.91], [0.32, 0.57], [0.02, 0.35], [0.39, 0.35]
        ]);
        break;

      // Unicorn — matches CSS polygon exactly from UNICORN_POINTS in grid.js
      case 'unicorn':
        poly([
          [0.85, 0.05], [0.58, 0.20], [0.48, 0.12], [0.40, 0.20], [0.28, 0.28],
          [0.20, 0.42], [0.15, 0.60], [0.12, 0.82], [0.15, 0.95], [0.38, 0.95],
          [0.55, 0.88], [0.60, 0.74], [0.68, 0.64], [0.84, 0.54], [0.88, 0.46],
          [0.85, 0.38], [0.72, 0.32], [0.65, 0.22]
        ]);
        break;

      // Heart — matches: polygon(50% 88%, 35% 72%, 20% 55%, 10% 40%, 8% 28%, 10% 16%, 18% 7%, 30% 5%, 42% 10%, 50% 22%, 58% 10%, 70% 5%, 82% 7%, 90% 16%, 92% 28%, 90% 40%, 80% 55%, 65% 72%)
      case 'heart':
        poly([
          [0.50, 0.88], [0.35, 0.72], [0.20, 0.55], [0.10, 0.40], [0.08, 0.28],
          [0.10, 0.16], [0.18, 0.07], [0.30, 0.05], [0.42, 0.10], [0.50, 0.22],
          [0.58, 0.10], [0.70, 0.05], [0.82, 0.07], [0.90, 0.16], [0.92, 0.28],
          [0.90, 0.40], [0.80, 0.55], [0.65, 0.72]
        ]);
        break;

      // Butterfly — matches: polygon(50% 25%, 38% 10%, 20% 6%, 8% 18%, 2% 35%, 10% 52%, 40% 52%, 18% 68%, 20% 90%, 35% 95%, 48% 80%, 50% 68%, 52% 80%, 65% 95%, 80% 90%, 82% 68%, 60% 52%, 90% 52%, 98% 35%, 92% 18%, 80% 6%, 62% 10%)
      case 'butterfly':
        poly([
          [0.50, 0.25], [0.38, 0.10], [0.20, 0.06], [0.08, 0.18], [0.02, 0.35],
          [0.10, 0.52], [0.40, 0.52], [0.18, 0.68], [0.20, 0.90], [0.35, 0.95],
          [0.48, 0.80], [0.50, 0.68], [0.52, 0.80], [0.65, 0.95], [0.80, 0.90],
          [0.82, 0.68], [0.60, 0.52], [0.90, 0.52], [0.98, 0.35], [0.92, 0.18],
          [0.80, 0.06], [0.62, 0.10]
        ]);
        break;

      // Rounded — full rounded rect
      case 'rounded':
        ctx.roundRect(x, y, w, h, [Math.max(16, radius || 16)]);
        break;

      // Square / default — rect with optional corner radius
      case 'square':
      default:
        if (radius && radius > 0) {
          ctx.roundRect(x, y, w, h, [radius]);
        } else {
          ctx.rect(x, y, w, h);
        }
        break;
    }
    ctx.closePath();
  }

  openExportModal() {
    const validCount = this.engine.slotImages.filter(img => img && img.trim() !== '').length;
    if (validCount === 0) {
      this.showToast('Please upload or add photos first to export!', 'warning');
      return;
    }
    this.dom.exportModal.classList.remove('hidden');
    this.dom.exportResInfo.innerText = `${this.canvasWidth} × ${this.canvasHeight} px (${this.currentPreset.aspectRatio || 'Custom'})`;
    this.renderExportCanvasPreview();
  }

  async renderExportCanvasPreview() {
    const canvas = this.dom.exportPreviewCanvas;
    const ctx = canvas.getContext('2d');

    const maxPreviewW = 280;
    const scale = maxPreviewW / this.canvasWidth;
    canvas.width = maxPreviewW;
    canvas.height = this.canvasHeight * scale;

    ctx.fillStyle = this.engine.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const slots = this.engine.slots;
    const cellW = (canvas.width - (this.engine.cols - 1) * (this.engine.gap * scale) - 2 * (this.engine.padding * scale)) / this.engine.cols;
    const cellH = (canvas.height - (this.engine.rows - 1) * (this.engine.gap * scale) - 2 * (this.engine.padding * scale)) / this.engine.rows;

    for (const slot of slots) {
      const imgSrc = this.engine.slotImages[slot.index];
      if (!imgSrc || imgSrc.trim() === '') continue;
      const x = (this.engine.padding * scale) + slot.col * (cellW + this.engine.gap * scale);
      const y = (this.engine.padding * scale) + slot.row * (cellH + this.engine.gap * scale);
      const w = slot.spanCol * cellW + (slot.spanCol - 1) * (this.engine.gap * scale);
      const h = slot.spanRow * cellH + (slot.spanRow - 1) * (this.engine.gap * scale);
      const r = this.engine.radius * scale;

      try {
        const img = await this.loadImage(imgSrc);
        const slotShape = this.engine.getTileShape(slot);
        ctx.save();
        this.drawShapePath(ctx, slotShape, x, y, w, h, r);
        ctx.clip();
        this.applyCanvasFilter(ctx);
        this.drawImageCover(ctx, img, x, y, w, h);
        ctx.restore();
      } catch (err) {}
    }
  }

  async downloadWallpaper() {
    this.showToast('Rendering high-resolution wallpaper...', 'info');
    this.dom.confirmExportBtn.disabled = true;
    this.dom.confirmExportBtn.innerText = 'Rendering...';

    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = this.canvasWidth;
    fullCanvas.height = this.canvasHeight;
    const ctx = fullCanvas.getContext('2d');

    ctx.fillStyle = this.engine.backgroundColor;
    ctx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);

    const slots = this.engine.slots;
    
    const totalGapX = (this.engine.cols - 1) * this.engine.gap;
    const totalPaddingX = this.engine.padding * 2;
    const cellW = (this.canvasWidth - totalGapX - totalPaddingX) / this.engine.cols;

    const totalGapY = (this.engine.rows - 1) * this.engine.gap;
    const totalPaddingY = this.engine.padding * 2;
    const cellH = (this.canvasHeight - totalGapY - totalPaddingY) / this.engine.rows;

    const imagePromises = slots.map(async (slot) => {
      const imgSrc = this.engine.slotImages[slot.index];
      if (!imgSrc || imgSrc.trim() === '') return;
      const x = this.engine.padding + slot.col * (cellW + this.engine.gap);
      const y = this.engine.padding + slot.row * (cellH + this.engine.gap);
      const w = slot.spanCol * cellW + (slot.spanCol - 1) * this.engine.gap;
      const h = slot.spanRow * cellH + (slot.spanRow - 1) * this.engine.gap;
      const r = this.engine.radius;

      try {
        const img = await this.loadImage(imgSrc);
        const slotShape = this.engine.getTileShape(slot);
        ctx.save();
        this.drawShapePath(ctx, slotShape, x, y, w, h, r);
        ctx.clip();
        this.applyCanvasFilter(ctx);
        this.drawImageCover(ctx, img, x, y, w, h);
        ctx.restore();
      } catch (e) {}
    });

    await Promise.all(imagePromises);

    const format = this.dom.exportFormatSelect.value;
    const quality = parseFloat(this.dom.exportQualitySelect.value);
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const filename = `vibewall_${this.canvasWidth}x${this.canvasHeight}.${format}`;

    fullCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.dom.exportModal.classList.add('hidden');
      this.dom.confirmExportBtn.disabled = false;
      this.dom.confirmExportBtn.innerText = 'Download Wallpaper';
      this.showToast('Wallpaper downloaded in full resolution!', 'success');
    }, mimeType, quality);
  }

  applyCanvasFilter(ctx) {
    switch (this.activeFilter) {
      case 'filter-vintage':
        ctx.filter = 'sepia(35%) contrast(110%) brightness(95%) saturate(120%)';
        break;
      case 'filter-bw':
        ctx.filter = 'grayscale(100%) contrast(120%) brightness(95%)';
        break;
      case 'filter-vibrant':
        ctx.filter = 'saturate(160%) contrast(115%) brightness(102%)';
        break;
      case 'filter-warm':
        ctx.filter = 'sepia(20%) hue-rotate(-15deg) saturate(130%)';
        break;
      case 'filter-cool':
        ctx.filter = 'hue-rotate(20deg) saturate(120%) contrast(105%)';
        break;
      default:
        ctx.filter = 'none';
    }
  }

  drawImageCover(ctx, img, x, y, w, h) {
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const targetRatio = w / h;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

    if (imgRatio > targetRatio) {
      sw = img.naturalHeight * targetRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / targetRatio;
      sy = (img.naturalHeight - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = src;
    });
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    let bg = 'bg-slate-900 text-white border-slate-800';
    let iconSvg = '<svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>';
    
    if (type === 'success') {
      bg = 'bg-emerald-950 text-emerald-200 border-emerald-800';
      iconSvg = '<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
    } else if (type === 'error') {
      bg = 'bg-rose-950 text-rose-200 border-rose-800';
      iconSvg = '<svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6m0-6l6 6"/></svg>';
    } else if (type === 'warning') {
      bg = 'bg-amber-950 text-amber-200 border-amber-800';
      iconSvg = '<svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
    }

    toast.className = `toast px-3.5 py-2 rounded-xl border text-xs font-semibold shadow-xl flex items-center gap-2 ${bg}`;
    toast.innerHTML = `<span class="flex-shrink-0">${iconSvg}</span><span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }
}

// Initialize immediately if DOM is ready, or on DOMContentLoaded
function initWallpaperApp() {
  if (!window.app) {
    try {
      window.app = new WallpaperApp();
    } catch (err) {
      console.error('WallpaperApp initialization error:', err);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWallpaperApp);
  window.addEventListener('DOMContentLoaded', initWallpaperApp);
} else {
  initWallpaperApp();
}
