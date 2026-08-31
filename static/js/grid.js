/**
 * Grid Layout Engine with Configurable Hero Count, Custom Hero Span Size & Image Mapping
 */

export const UNICORN_POINTS = [
  [0.85, 0.05], // horn tip
  [0.58, 0.20], // horn base back
  [0.48, 0.12], // ear tip
  [0.40, 0.20], // ear base
  [0.28, 0.28], // mane top
  [0.20, 0.42], // mane middle
  [0.15, 0.60], // mane lower
  [0.12, 0.82], // mane bottom
  [0.15, 0.95], // back of neck
  [0.38, 0.95], // neck bottom
  [0.55, 0.88], // chest
  [0.60, 0.74], // throat
  [0.68, 0.64], // jaw
  [0.84, 0.54], // lower lip
  [0.88, 0.46], // muzzle / mouth
  [0.85, 0.38], // nose / nostrils
  [0.72, 0.32], // forehead front
  [0.65, 0.22], // horn base front
  [0.85, 0.05]  // close horn tip
];

export function isPointInPolygon(u, v, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const intersect = ((yi > v) !== (yj > v)) &&
      (u < (xj - xi) * (v - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInShape(u, v, shape) {
  if (!shape || shape === 'square' || shape === 'rectangle' || shape === 'none') {
    return true;
  }

  if (shape === 'heart') {
    const x = (u - 0.5) * 2.5;
    const y = -(v - 0.52) * 2.5;
    const a = x * x + y * y - 1;
    return (a * a * a - x * x * y * y * y) <= 0;
  }

  if (shape === 'unicorn') {
    return isPointInPolygon(u, v, UNICORN_POINTS);
  }

  if (shape === 'star') {
    const dx = u - 0.5, dy = v - 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.48) return false;
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    const slice = (2 * Math.PI) / 5;
    const mod = angle % slice;
    const relAngle = Math.abs(mod - slice / 2);
    const maxR = 0.22 / (Math.cos(relAngle) + (0.22 / 0.48) * Math.sin(relAngle) * Math.tan(Math.PI / 5));
    return dist <= Math.min(0.48, maxR * 1.3);
  }

  if (shape === 'diamond') {
    return (Math.abs(u - 0.5) / 0.48 + Math.abs(v - 0.5) / 0.48) <= 1;
  }

  if (shape === 'circle') {
    const dx = u - 0.5, dy = v - 0.5;
    return (dx * dx + dy * dy) <= 0.22;
  }

  if (shape === 'butterfly') {
    const x = Math.abs(u - 0.5) * 2;
    const y = (v - 0.5) * 2;
    if (x > 0.95 || Math.abs(y) > 0.95) return false;
    const upper = (Math.pow(x - 0.45, 2) / 0.22 + Math.pow(y + 0.32, 2) / 0.25) <= 1;
    const lower = (Math.pow(x - 0.35, 2) / 0.16 + Math.pow(y - 0.38, 2) / 0.22) <= 1;
    const body = x <= 0.12 && Math.abs(y) <= 0.85;
    return upper || lower || body;
  }

  return true;
}

export class WallpaperGridEngine {
  constructor(options = {}) {
    this.container = options.container;
    this.onSwap = options.onSwap || (() => {});
    this.onSlotClick = options.onSlotClick || (() => {});
    
    // Grid Configuration
    this.cols = 8;
    this.rows = 14;
    this.layoutMode = 'pinterest'; // 'pinterest', 'custom-hero', 'single-hero', 'dual-hero', 'standard'
    this.shapeSilhouette = 'rectangle'; // 'rectangle', 'square', 'heart', 'unicorn', 'star', 'diamond', 'circle', 'butterfly'
    this.tileShape = 'square'; // Global default shape for grid tiles: 'square', 'rounded', 'circle', 'heart', 'unicorn', 'star', 'diamond', 'hexagon', 'butterfly'
    this.heroTileShape = null; // Specific shape for Hero images (e.g. 'heart', 'unicorn', 'star', etc.)
    this.imageShapes = {}; // Map of specific imgSrc -> shape
    this.slotShapes = {}; // Map of specific slotIndex -> shape
    this.heroCount = 3; // Customizable hero count (0, 1, 2, 3, 4, 5...)
    this.heroSpan = 3; // Customizable hero size/span (2 = Medium, 3 = Large, 4 = Extra Large, 5 = Giant)
    this.allowVertical = true; // Option to keep/remove vertical (1x2) tiles
    this.allowHorizontal = true; // Option to keep/remove horizontal (2x1) tiles
    
    this.gap = 4;
    this.radius = 6;
    this.padding = 6;
    this.backgroundColor = '#0f172a';
    this.filterClass = '';
    
    // Explicit array of slot descriptors & slot image URLs
    this.slots = [];
    this.slotImages = [];
    this.selectedHeroImages = [];
    this.regularImages = [];
    
    this.touchDragElement = null;
    this.touchCurrentTarget = null;
  }

  setDimensions(width, height, cols = null) {
    if (cols) {
      this.cols = cols;
    }
    const tileAspect = width / this.cols;
    this.rows = Math.max(4, Math.round(height / tileAspect));
    this.calculateLayout();
  }

  setShapeSilhouette(shape) {
    this.shapeSilhouette = shape || 'rectangle';
    this.calculateLayout();
  }

  setTileShape(shape) {
    this.tileShape = shape || 'square';
    this.render();
  }

  setHeroTileShape(shape) {
    this.heroTileShape = shape && shape !== 'same' ? shape : null;
    this.render();
  }

  setImageShape(imgSrc, shape) {
    if (!imgSrc) return;
    if (shape && shape !== 'default') {
      this.imageShapes[imgSrc] = shape;
    } else {
      delete this.imageShapes[imgSrc];
    }
    this.render();
  }

  setSlotShape(slotIndex, shape) {
    if (shape && shape !== 'default') {
      this.slotShapes[slotIndex] = shape;
    } else {
      delete this.slotShapes[slotIndex];
    }
    this.render();
  }

  getTileShape(slot) {
    const imgSrc = this.slotImages[slot.index];
    if (imgSrc && this.imageShapes[imgSrc]) {
      return this.imageShapes[imgSrc];
    }
    if (this.slotShapes[slot.index]) {
      return this.slotShapes[slot.index];
    }
    if (slot.isHero && this.heroTileShape) {
      return this.heroTileShape;
    }
    return this.tileShape || 'square';
  }

  setLayoutMode(mode) {
    this.layoutMode = mode;
    if (mode === 'single-hero') this.heroCount = 1;
    else if (mode === 'dual-hero') this.heroCount = 2;
    else if (mode === 'standard') this.heroCount = 0;
    this.calculateLayout();
  }

  setHeroCount(count) {
    this.heroCount = Math.max(0, parseInt(count, 10) || 0);
    if (this.heroCount > 2 && (this.layoutMode === 'single-hero' || this.layoutMode === 'dual-hero')) {
      this.layoutMode = 'pinterest';
    } else if (this.heroCount === 1 && this.layoutMode === 'standard') {
      this.layoutMode = 'single-hero';
    } else if (this.heroCount === 2 && (this.layoutMode === 'standard' || this.layoutMode === 'single-hero')) {
      this.layoutMode = 'dual-hero';
    } else if (this.heroCount === 0 && this.layoutMode !== 'standard') {
      this.layoutMode = 'standard';
    }
    this.calculateLayout();
  }

  setHeroSpan(span) {
    this.heroSpan = Math.max(2, Math.min(this.cols - 1, parseInt(span, 10) || 3));
    this.calculateLayout();
  }

  setVerticalAllowed(allowed) {
    this.allowVertical = !!allowed;
    this.calculateLayout();
  }

  setHorizontalAllowed(allowed) {
    this.allowHorizontal = !!allowed;
    this.calculateLayout();
  }

  // Calculate layout geometry based on chosen layoutMode and heroCount
  calculateLayout() {
    const occupied = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));

    // Pre-mark cells outside shape silhouette as occupied so tiles form the chosen shape
    if (this.shapeSilhouette && this.shapeSilhouette !== 'rectangle' && this.shapeSilhouette !== 'square' && this.shapeSilhouette !== 'none') {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const u = (c + 0.5) / this.cols;
          const v = (r + 0.5) / this.rows;
          if (!isPointInShape(u, v, this.shapeSilhouette)) {
            occupied[r][c] = true;
          }
        }
      }
    }

    const newSlots = [];
    let slotIdx = 0;
    let placedHeroes = 0;

    if (this.layoutMode === 'pinterest' || this.layoutMode === 'custom-hero' || (this.heroCount > 2)) {
      // 1. First strategically place the exact requested number of hero slots
      const targetHeroes = this.heroCount;

      if (targetHeroes > 0) {
        const heroPositions = this.distributeHeroPositions(targetHeroes);
        
        heroPositions.forEach((pos) => {
          const span = Math.min(pos.span, this.cols, this.rows);
          let startR = Math.max(0, Math.min(this.rows - span, pos.r));
          let startC = Math.max(0, Math.min(this.cols - span, pos.c));

          let actualSpanW = span;
          let actualSpanH = span;
          let fits = this.checkRectFit(occupied, startR, startC, span, span);

          if (!fits) {
            const found = this.findNearestOpenPosition(occupied, span, span, 2);
            if (found) {
              startR = found.r;
              startC = found.c;
              actualSpanW = found.spanW;
              actualSpanH = found.spanH;
              fits = true;
            }
          }

          if (fits) {
            for (let r = startR; r < startR + actualSpanH; r++) {
              for (let c = startC; c < startC + actualSpanW; c++) {
                occupied[r][c] = true;
              }
            }

            newSlots.push({
              index: slotIdx,
              isHero: true,
              heroIndex: placedHeroes,
              row: startR,
              col: startC,
              spanRow: actualSpanH,
              spanCol: actualSpanW
            });
            slotIdx++;
            placedHeroes++;
          }
        });
      }

      // 2. Fill the rest of the canvas with randomized Pinterest-style spans
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (occupied[r][c]) continue;

          const maxW = this.getMaxSpanX(occupied, r, c);
          const maxH = this.getMaxSpanY(occupied, r, c);
          const candidates = [];

          // 2x1 wide (Horizontal)
          if (this.allowHorizontal && maxW >= 2 && maxH >= 1 && this.checkRectFit(occupied, r, c, 2, 1)) {
            candidates.push({ spanW: 2, spanH: 1, weight: 2.0 });
          }
          // 1x2 tall (Vertical)
          if (this.allowVertical && maxW >= 1 && maxH >= 2 && this.checkRectFit(occupied, r, c, 1, 2)) {
            candidates.push({ spanW: 1, spanH: 2, weight: 2.0 });
          }
          // 1x1 standard square
          candidates.push({ spanW: 1, spanH: 1, weight: 4.0 });

          const chosen = this.pickWeightedCandidate(candidates);

          for (let rowOffset = 0; rowOffset < chosen.spanH; rowOffset++) {
            for (let colOffset = 0; colOffset < chosen.spanW; colOffset++) {
              occupied[r + rowOffset][c + colOffset] = true;
            }
          }

          newSlots.push({
            index: slotIdx,
            isHero: false,
            heroIndex: -1,
            row: r,
            col: c,
            spanRow: chosen.spanH,
            spanCol: chosen.spanW
          });
          slotIdx++;
        }
      }

    } else if (this.layoutMode === 'single-hero' || this.heroCount === 1) {
      const span = Math.min(this.heroSpan || 3, this.cols - 1, this.rows - 1);
      let rStart = Math.max(0, Math.floor((this.rows - span) * 0.25));
      let cStart = Math.max(0, Math.floor((this.cols - span) / 2));
      let actualSpanW = span;
      let actualSpanH = span;

      let fits = this.checkRectFit(occupied, rStart, cStart, span, span);
      if (!fits) {
        const found = this.findNearestOpenPosition(occupied, span, span, 2);
        if (found) {
          rStart = found.r;
          cStart = found.c;
          actualSpanW = found.spanW;
          actualSpanH = found.spanH;
          fits = true;
        }
      }

      if (fits) {
        for (let r = rStart; r < rStart + actualSpanH; r++) {
          for (let c = cStart; c < cStart + actualSpanW; c++) {
            occupied[r][c] = true;
          }
        }
      }

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (fits && r === rStart && c === cStart) {
            newSlots.push({
              index: slotIdx,
              isHero: true,
              heroIndex: 0,
              row: r,
              col: c,
              spanRow: actualSpanH,
              spanCol: actualSpanW
            });
            slotIdx++;
          } else if (!occupied[r][c]) {
            newSlots.push({
              index: slotIdx,
              isHero: false,
              heroIndex: -1,
              row: r,
              col: c,
              spanRow: 1,
              spanCol: 1
            });
            slotIdx++;
          }
        }
      }

    } else if (this.layoutMode === 'dual-hero' || this.heroCount === 2) {
      const span = Math.min(this.heroSpan || 2, this.cols - 1, Math.floor(this.rows / 2) - 1);
      const positions = this.distributeHeroPositions(2);

      positions.forEach((pos) => {
        let s = Math.min(pos.span, this.cols, this.rows);
        let sR = Math.max(0, Math.min(this.rows - s, pos.r));
        let sC = Math.max(0, Math.min(this.cols - s, pos.c));
        let aW = s, aH = s;
        let fits = this.checkRectFit(occupied, sR, sC, s, s);
        if (!fits) {
          const found = this.findNearestOpenPosition(occupied, s, s, 2);
          if (found) { sR = found.r; sC = found.c; aW = found.spanW; aH = found.spanH; fits = true; }
        }
        if (fits) {
          for (let r = sR; r < sR + aH; r++) for (let c = sC; c < sC + aW; c++) occupied[r][c] = true;
          newSlots.push({ index: slotIdx, isHero: true, heroIndex: placedHeroes, row: sR, col: sC, spanRow: aH, spanCol: aW });
          slotIdx++;
          placedHeroes++;
        }
      });

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (!occupied[r][c]) {
            newSlots.push({ index: slotIdx, isHero: false, heroIndex: -1, row: r, col: c, spanRow: 1, spanCol: 1 });
            slotIdx++;
          }
        }
      }

    } else {
      // Standard Equal Grid
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (!occupied[r][c]) {
            newSlots.push({ index: slotIdx, isHero: false, heroIndex: -1, row: r, col: c, spanRow: 1, spanCol: 1 });
            slotIdx++;
          }
        }
      }
    }

    this.slots = newSlots;
    this.refreshSlotImages();
  }

  distributeHeroPositions(count) {
    const positions = [];
    if (count <= 0) return positions;
    const span = Math.min(this.heroSpan || 3, this.cols - 1, this.rows - 1);

    if (count === 1) {
      positions.push({ r: Math.max(0, Math.floor((this.rows - span) * 0.25)), c: Math.max(0, Math.floor((this.cols - span) / 2)), span });
    } else if (count === 2) {
      positions.push({ r: 1, c: Math.max(0, Math.floor((this.cols - span) / 2)), span });
      positions.push({ r: Math.max(span + 2, Math.floor((this.rows - span) * 0.72)), c: Math.max(0, Math.floor((this.cols - span) / 2)), span });
    } else if (count === 3) {
      positions.push({ r: 1, c: 0, span });
      positions.push({ r: Math.max(span + 1, Math.floor((this.rows - span) * 0.45)), c: Math.max(0, this.cols - span), span });
      positions.push({ r: Math.max(span * 2 + 1, Math.floor((this.rows - span) * 0.8)), c: 0, span });
    } else if (count === 4) {
      positions.push({ r: 1, c: 0, span });
      positions.push({ r: 1, c: Math.max(0, this.cols - span), span });
      positions.push({ r: Math.max(span + 2, Math.floor((this.rows - span) * 0.72)), c: 0, span });
      positions.push({ r: Math.max(span + 2, Math.floor((this.rows - span) * 0.72)), c: Math.max(0, this.cols - span), span });
    } else {
      // General distribution across rows
      for (let i = 0; i < count; i++) {
        const rowFrac = i / Math.max(1, count - 1);
        const r = Math.floor((this.rows - span) * rowFrac);
        const c = (i % 2 === 0) ? 0 : Math.max(0, this.cols - span);
        positions.push({ r: Math.max(0, r), c, span });
      }
    }
    return positions;
  }

  findNearestOpenPosition(occupied, maxSpanW, maxSpanH, minSpan = 2) {
    for (let sW = maxSpanW, sH = maxSpanH; sW >= minSpan && sH >= minSpan; sW--, sH--) {
      for (let r = 0; r <= this.rows - sH; r++) {
        for (let c = 0; c <= this.cols - sW; c++) {
          if (this.checkRectFit(occupied, r, c, sW, sH)) {
            return { r, c, spanW: sW, spanH: sH };
          }
        }
      }
    }
    return null;
  }

  checkRectFit(occupied, startR, startC, spanW, spanH) {
    if (startR + spanH > this.rows || startC + spanW > this.cols) return false;
    for (let r = startR; r < startR + spanH; r++) {
      for (let c = startC; c < startC + spanW; c++) {
        if (occupied[r][c]) return false;
      }
    }
    return true;
  }

  getMaxSpanX(occupied, r, c) {
    let span = 0;
    while (c + span < this.cols && !occupied[r][c + span]) {
      span++;
    }
    return span;
  }

  getMaxSpanY(occupied, r, c) {
    let span = 0;
    while (r + span < this.rows && !occupied[r + span][c]) {
      span++;
    }
    return span;
  }

  pickWeightedCandidate(candidates) {
    const totalWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const item of candidates) {
      if (rand < item.weight) {
        return item;
      }
      rand -= item.weight;
    }
    return candidates[candidates.length - 1];
  }

  setImages(allImages, heroImages = []) {
    const extractUrl = (img) => {
      if (!img) return null;
      if (typeof img === 'string') return img.trim() !== '' ? img : null;
      if (typeof img === 'object' && img.src && typeof img.src === 'string') return img.src.trim() !== '' ? img.src : null;
      return null;
    };

    const validAll = (allImages || []).map(extractUrl).filter(Boolean);
    const validHeroes = (heroImages || []).map(extractUrl).filter(Boolean);

    this.regularImages = validAll;
    this.selectedHeroImages = validHeroes;

    this.refreshSlotImages();
    this.render();
  }

  refreshSlotImages() {
    if (this.slots.length === 0) return;

    let effectiveHeroes = this.selectedHeroImages.filter(img => img && typeof img === 'string' && img.trim() !== '');
    if (effectiveHeroes.length === 0 && this.regularImages.length > 0) {
      effectiveHeroes = this.regularImages.slice(0, Math.max(1, this.heroCount));
    }
    const regulars = this.regularImages.length > 0 ? this.regularImages : effectiveHeroes;

    if (regulars.length === 0 && effectiveHeroes.length === 0) {
      this.slotImages = [];
      return;
    }

    let heroCounter = 0;
    let regCounter = 0;

    this.slotImages = this.slots.map((slot) => {
      if (slot.isHero) {
        if (effectiveHeroes.length > 0) {
          const img = effectiveHeroes[heroCounter % effectiveHeroes.length];
          heroCounter++;
          return img;
        }
        return '';
      } else {
        if (regulars.length > 0) {
          const img = regulars[regCounter % regulars.length];
          regCounter++;
          return img;
        }
        return '';
      }
    });
  }

  removeImage(imgSrc) {
    if (!imgSrc) return;
    this.regularImages = this.regularImages.filter(img => img !== imgSrc);
    this.selectedHeroImages = this.selectedHeroImages.filter(img => img !== imgSrc);
    this.refreshSlotImages();
    this.render();
  }

  subdivideSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= this.slots.length) return null;
    const slot = this.slots[slotIndex];
    if (!slot) return null;

    const { row, col, spanRow, spanCol, isHero } = slot;
    const count = spanRow * spanCol;

    if (spanRow <= 1 && spanCol <= 1 && !isHero) {
      // Already 1x1 standard block - clear image
      this.slotImages[slotIndex] = '';
      this.render();
      return { count: 1, type: 'clear' };
    }

    // Create 1x1 standard replacement slots
    const replacementSlots = [];
    for (let r = row; r < row + spanRow; r++) {
      for (let c = col; c < col + spanCol; c++) {
        replacementSlots.push({
          isHero: false,
          heroIndex: -1,
          row: r,
          col: c,
          spanRow: 1,
          spanCol: 1
        });
      }
    }

    // Replace multi-span slot with 1x1 replacement slots
    this.slots.splice(slotIndex, 1, ...replacementSlots);

    // Re-index all slots
    this.slots.forEach((s, idx) => {
      s.index = idx;
    });

    // If hero count needs adjustment
    if (isHero && this.heroCount > 0) {
      this.heroCount = Math.max(0, this.heroCount - 1);
    }

    this.refreshSlotImages();
    this.render();

    return { count, row, col, spanRow, spanCol, type: 'subdivide' };
  }

  clearSlotImage(slotIndex) {
    if (slotIndex < 0 || slotIndex >= this.slots.length) return;
    this.slotImages[slotIndex] = '';
    this.render();
  }

  setSlotImage(slotIndex, imgSrc) {
    if (slotIndex < 0 || slotIndex >= this.slots.length) return;
    this.slotImages[slotIndex] = imgSrc;
    this.render();
  }

  moveSlot(slotIndex, direction) {
    slotIndex = parseInt(slotIndex, 10);
    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= this.slots.length) return null;
    const slot = this.slots[slotIndex];
    if (!slot) return null;

    let dr = 0;
    let dc = 0;
    if (direction === 'up') dr = -1;
    else if (direction === 'down') dr = 1;
    else if (direction === 'left') dc = -1;
    else if (direction === 'right') dc = 1;
    else return null;

    const newRow = slot.row + dr;
    const newCol = slot.col + dc;

    // Check canvas boundaries
    if (newRow < 0 || newRow + slot.spanRow > this.rows) return null;
    if (newCol < 0 || newCol + slot.spanCol > this.cols) return null;

    // Build a 2D matrix map of slot object per cell (rows x cols)
    const gridMap = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.slots.forEach((s) => {
      for (let r = s.row; r < s.row + s.spanRow; r++) {
        for (let c = s.col; c < s.col + s.spanCol; c++) {
          if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
            gridMap[r][c] = s;
          }
        }
      }
    });

    // 1. STANDARD 1x1 BLOCK MOVEMENT
    if (slot.spanRow === 1 && slot.spanCol === 1 && !slot.isHero) {
      const neighborSlot = gridMap[newRow][newCol];
      if (!neighborSlot || neighborSlot.index === slot.index) return null;

      if (neighborSlot.spanRow === 1 && neighborSlot.spanCol === 1 && !neighborSlot.isHero) {
        // Direct swap of images and shapes between two 1x1 slots
        const tempImg = this.slotImages[slot.index];
        this.slotImages[slot.index] = this.slotImages[neighborSlot.index];
        this.slotImages[neighborSlot.index] = tempImg;

        const tempShape = this.slotShapes[slot.index];
        this.slotShapes[slot.index] = this.slotShapes[neighborSlot.index];
        this.slotShapes[neighborSlot.index] = tempShape;

        this.render();
        this.onSwap({ type: 'slot-swap', sourceIndex: slot.index, targetIndex: neighborSlot.index });
        return neighborSlot.index;
      } else {
        // Neighbor is a Hero / multi-span block: shift the Hero in the opposite direction
        const oppDir = direction === 'up' ? 'down' : direction === 'down' ? 'up' : direction === 'left' ? 'right' : 'left';
        this.moveSlot(neighborSlot.index, oppDir);
        // Find our slot at new position
        const ourMovedSlot = this.slots.find(s => s.row === newRow && s.col === newCol);
        return ourMovedSlot ? ourMovedSlot.index : slot.index;
      }
    }

    // 2. HERO / MULTI-SPAN BLOCK MOVEMENT (2x2, 3x3, 1x2, 2x1, etc.)
    const targetCells = [];
    for (let r = newRow; r < newRow + slot.spanRow; r++) {
      for (let c = newCol; c < newCol + slot.spanCol; c++) {
        targetCells.push({ r, c });
      }
    }

    // Cells that the hero will enter (not in current hero area)
    const enteringCells = targetCells.filter(cell => 
      cell.r < slot.row || cell.r >= slot.row + slot.spanRow ||
      cell.c < slot.col || cell.c >= slot.col + slot.spanCol
    );

    // Cells that the hero will leave (vacated)
    const leavingCells = [];
    for (let r = slot.row; r < slot.row + slot.spanRow; r++) {
      for (let c = slot.col; c < slot.col + slot.spanCol; c++) {
        if (r < newRow || r >= newRow + slot.spanRow || c < newCol || c >= newCol + slot.spanCol) {
          leavingCells.push({ r, c });
        }
      }
    }

    if (enteringCells.length === 0 || leavingCells.length === 0) return null;

    // Identify all other slots currently occupying entering cells
    const displacedSlots = [];
    enteringCells.forEach(cell => {
      const occupant = gridMap[cell.r][cell.c];
      if (occupant && occupant.index !== slot.index && !displacedSlots.includes(occupant)) {
        displacedSlots.push(occupant);
      }
    });

    // If any displaced slot is multi-span, subdivide it to 1x1s so they can neatly fill the vacated cells
    displacedSlots.forEach(ds => {
      if (ds.spanRow > 1 || ds.spanCol > 1) {
        const sIdx = this.slots.indexOf(ds);
        if (sIdx !== -1) {
          const dsImage = this.slotImages[ds.index];
          const repl = [];
          const replImages = [];
          for (let r = ds.row; r < ds.row + ds.spanRow; r++) {
            for (let c = ds.col; c < ds.col + ds.spanCol; c++) {
              repl.push({
                isHero: false,
                heroIndex: -1,
                row: r,
                col: c,
                spanRow: 1,
                spanCol: 1
              });
              replImages.push(dsImage || '');
            }
          }
          this.slots.splice(sIdx, 1, ...repl);
          this.slotImages.splice(sIdx, 1, ...replImages);
        }
      }
    });

    // Re-index all slots to keep 1:1 sync with slotImages
    this.slots.forEach((s, idx) => s.index = idx);

    // Re-build gridMap
    const updatedMap = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.slots.forEach(s => {
      for (let r = s.row; r < s.row + s.spanRow; r++) {
        for (let c = s.col; c < s.col + s.spanCol; c++) {
          if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
            updatedMap[r][c] = s;
          }
        }
      }
    });

    // Move each 1x1 slot in enteringCells to one of leavingCells
    let leaveIdx = 0;
    enteringCells.forEach(cell => {
      const cellSlot = updatedMap[cell.r][cell.c];
      if (cellSlot && cellSlot.index !== slot.index && leaveIdx < leavingCells.length) {
        cellSlot.row = leavingCells[leaveIdx].r;
        cellSlot.col = leavingCells[leaveIdx].c;
        leaveIdx++;
      }
    });

    // Update the hero/spanning slot coordinates
    slot.row = newRow;
    slot.col = newCol;

    this.render();
    return slot.index;
  }

  isColorDark(hex) {
    if (!hex || !hex.startsWith('#')) return true;
    const c = hex.substring(1);
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma < 140;
  }

  render() {
    if (!this.container) return;

    if (this.slots.length === 0) {
      this.calculateLayout();
    }

    this.container.style.display = 'grid';
    this.container.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    this.container.style.gridTemplateRows = `repeat(${this.rows}, 1fr)`;
    this.container.style.gap = `${this.gap}px`;
    this.container.style.padding = `${this.padding}px`;
    this.container.style.backgroundColor = this.backgroundColor;
    this.container.style.borderRadius = `${Math.max(8, this.radius * 2)}px`;

    this.container.innerHTML = '';

    const isDark = this.isColorDark(this.backgroundColor);

    this.slots.forEach(slot => {
      const tile = document.createElement('div');
      tile.dataset.slotIndex = slot.index;
      tile.style.gridColumn = `${slot.col + 1} / span ${slot.spanCol}`;
      tile.style.gridRow = `${slot.row + 1} / span ${slot.spanRow}`;

      const imgSrc = this.slotImages[slot.index];
      const currentShape = this.getTileShape(slot);

      if (currentShape === 'rounded') {
        tile.style.borderRadius = `${Math.max(16, this.radius * 2)}px`;
      } else if (currentShape === 'square') {
        tile.style.borderRadius = `${this.radius}px`;
      } else {
        tile.style.borderRadius = '0px';
      }

      if (imgSrc && imgSrc.trim() !== '') {
        tile.className = `grid-tile tile-shape-${currentShape} group ${this.filterClass}`;
        tile.draggable = true;

        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = 'Cover';
        img.loading = 'lazy';
        img.draggable = false;
        tile.appendChild(img);

        // Hover replace overlay with SVG icon
        const overlay = document.createElement('div');
        overlay.className = 'tile-hover-overlay';
        overlay.innerHTML = `
          <button class="replace-btn bg-slate-900/90 hover:bg-slate-900 text-white p-1.5 rounded-lg text-xs shadow transition-transform hover:scale-110" title="Replace Cover">
            <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
          </button>
        `;
        tile.appendChild(overlay);

        overlay.querySelector('.replace-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.onSlotClick(slot.index);
        });

        // Attach direct click event to all tiles (Heroes, 1x2 Vertical, 2x1 Horizontal, 1x1 Standard)
        tile.addEventListener('click', () => {
          this.onSlotClick(slot.index);
        });

        this.attachDragEvents(tile, slot.index);
        this.attachTouchEvents(tile, slot.index);
      } else {
        // Clean skeleton wireframe tile
        tile.className = `grid-tile-skeleton tile-shape-${currentShape} ${isDark ? 'skeleton-dark' : 'skeleton-light'}`;
        tile.innerHTML = `
          <div class="pointer-events-none opacity-40 hover:opacity-80 transition-opacity">
            <svg class="w-3.5 h-3.5 ${isDark ? 'text-white' : 'text-slate-700'}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          </div>
        `;

        tile.addEventListener('click', () => {
          this.onSlotClick(slot.index);
        });

        this.attachDropOnlyEvents(tile, slot.index);
      }

      // Preserve active selection outline if this slot is currently selected
      if (window.app && window.app.selectedSource && window.app.selectedSource.type === 'canvas' && window.app.selectedSource.slotIndex === slot.index) {
        tile.classList.add('is-selected-source');
        window.app.selectedSource.el = tile;
      }

      this.container.appendChild(tile);
    });
  }

  attachDragEvents(tileElement, slotIndex) {
    tileElement.addEventListener('dragstart', (e) => {
      window.__dragState = {
        type: 'slot',
        slotIndex: slotIndex
      };

      tileElement.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `slot:${slotIndex}`);

      const dragImg = tileElement.querySelector('img');
      if (dragImg) {
        e.dataTransfer.setDragImage(dragImg, dragImg.clientWidth / 2, dragImg.clientHeight / 2);
      }
    });

    tileElement.addEventListener('dragend', () => {
      tileElement.classList.remove('is-dragging');
      document.querySelectorAll('.drag-over-target').forEach(el => el.classList.remove('drag-over-target'));
      setTimeout(() => {
        window.__dragState = null;
      }, 50);
    });

    this.attachDropOnlyEvents(tileElement, slotIndex);
  }

  attachDropOnlyEvents(tileElement, slotIndex) {
    tileElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      tileElement.classList.add('drag-over-target');
    });

    tileElement.addEventListener('dragleave', (e) => {
      if (!tileElement.contains(e.relatedTarget)) {
        tileElement.classList.remove('drag-over-target');
      }
    });

    tileElement.addEventListener('drop', (e) => {
      e.preventDefault();
      tileElement.classList.remove('drag-over-target');

      let dragData = window.__dragState;
      if (!dragData) {
        const text = e.dataTransfer.getData('text/plain');
        if (text.startsWith('tray-src:')) {
          dragData = { type: 'tray', imgSrc: decodeURIComponent(text.replace('tray-src:', '')) };
        } else if (text.startsWith('slot:')) {
          dragData = { type: 'slot', slotIndex: parseInt(text.replace('slot:', ''), 10) };
        }
      }

      if (dragData) {
        this.processDrop(dragData, slotIndex, tileElement);
      }
    });
  }

  attachTouchEvents(tileElement, slotIndex) {
    tileElement.addEventListener('touchstart', () => {
      this.touchDragElement = tileElement;
      window.__dragState = { type: 'slot', slotIndex: slotIndex };
    }, { passive: true });

    tileElement.addEventListener('touchmove', (e) => {
      if (!this.touchDragElement) return;
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.grid-tile, .grid-tile-skeleton');

      if (this.touchCurrentTarget && this.touchCurrentTarget !== target) {
        this.touchCurrentTarget.classList.remove('drag-over-target');
      }

      if (target && target !== tileElement) {
        this.touchCurrentTarget = target;
        target.classList.add('drag-over-target');
      }
    }, { passive: true });

    tileElement.addEventListener('touchend', () => {
      if (this.touchCurrentTarget) {
        this.touchCurrentTarget.classList.remove('drag-over-target');
        const targetIndex = parseInt(this.touchCurrentTarget.dataset.slotIndex, 10);
        if (!isNaN(targetIndex) && window.__dragState && window.__dragState.slotIndex !== targetIndex) {
          this.swapSlots(window.__dragState.slotIndex, targetIndex);
        }
      }
      this.touchDragElement = null;
      this.touchCurrentTarget = null;
      window.__dragState = null;
    });
  }

  processDrop(dragData, targetIndex, targetElement) {
    if (dragData.type === 'tray') {
      this.slotImages[targetIndex] = dragData.imgSrc;
      this.render();
      if (targetElement) {
        targetElement.classList.add('tile-just-swapped');
        setTimeout(() => targetElement.classList.remove('tile-just-swapped'), 400);
      }
      this.onSwap({ type: 'tray-drop', targetIndex });
    } else if (dragData.type === 'slot') {
      if (dragData.slotIndex !== targetIndex && dragData.slotIndex !== undefined && !isNaN(dragData.slotIndex)) {
        this.swapSlots(dragData.slotIndex, targetIndex);
      }
    }
  }

  swapSlots(sourceIndex, targetIndex) {
    const temp = this.slotImages[sourceIndex];
    this.slotImages[sourceIndex] = this.slotImages[targetIndex];
    this.slotImages[targetIndex] = temp;

    this.render();

    setTimeout(() => {
      const elA = this.container.querySelector(`[data-slot-index="${sourceIndex}"]`);
      const elB = this.container.querySelector(`[data-slot-index="${targetIndex}"]`);
      if (elA) elA.classList.add('tile-just-swapped');
      if (elB) elB.classList.add('tile-just-swapped');
      setTimeout(() => {
        if (elA) elA.classList.remove('tile-just-swapped');
        if (elB) elB.classList.remove('tile-just-swapped');
      }, 400);
    }, 50);

    this.onSwap({ type: 'slot-swap', sourceIndex, targetIndex });
  }

  shuffle() {
    // 1. Identify all non-hero slot indices and their images
    const normalSlotIndices = [];
    const normalImages = [];

    this.slots.forEach((slot) => {
      if (!slot.isHero) {
        normalSlotIndices.push(slot.index);
        const img = this.slotImages[slot.index];
        if (img && typeof img === 'string' && img.trim() !== '') {
          normalImages.push(img);
        }
      }
    });

    if (normalSlotIndices.length === 0) return;

    // Use available normal images or fallback to the regular uploaded images pool
    let pool = normalImages.length >= 2 ? [...normalImages] : [...this.regularImages];
    if (pool.length < 2) return;

    // 2. Fisher-Yates shuffle only the normal covers array
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // 3. Reassign shuffled covers strictly into non-hero slots (Heroes stay 100% locked)
    let poolIdx = 0;
    normalSlotIndices.forEach((slotIdx) => {
      this.slotImages[slotIdx] = pool[poolIdx % pool.length];
      poolIdx++;
    });

    this.render();
  }
}
