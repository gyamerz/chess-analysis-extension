/**
 * Overlay UI Module
 * Creates and manages the visual overlay system
 * 
 * FEATURES:
 * 1. Draggable control panel
 * 2. Hide/show original Chess.com pieces
 * 3. Local Alpha theme piece images
 * 4. Captured pieces display with point system
 */

const OverlayUI = (function() {
  'use strict';

  // UI Elements
  let overlayContainer = null;
  let boardOverlay = null;
  let pieceLayer = null;
  let highlightLayer = null;
  let floatingButton = null;
  let controlPanel = null;
  let statusDisplay = null;

  // State
  let isActive = false;
  let currentBoard = null;
  let squareSize = 0;
  let boardOffset = { left: 0, top: 0 };

  // Drag state for control panel
  let isDraggingPanel = false;
  let panelDragOffset = { x: 0, y: 0 };
  let panelPosition = { x: null, y: null };

  // Style element for hiding original pieces
  let hideOriginalPiecesStyle = null;

  // Base URL for Alpha theme pieces - LOCAL files from extension
  const PIECE_IMAGE_BASE_URL = browser.runtime.getURL('pieces/alpha/');

  // Piece image filename mapping
  const PIECE_IMAGES = {
    'wp': 'wp.png',
    'wn': 'wn.png',
    'wb': 'wb.png',
    'wr': 'wr.png',
    'wq': 'wq.png',
    'wk': 'wk.png',
    'bp': 'bp.png',
    'bn': 'bn.png',
    'bb': 'bb.png',
    'br': 'br.png',
    'bq': 'bq.png',
    'bk': 'bk.png'
  };

  // Point values for pieces (Chess.com standard)
  const PIECE_VALUES = {
    'p': 1,
    'n': 3,
    'b': 3,
    'r': 5,
    'q': 9,
    'k': 0
  };

  // Sort order for pieces (by value, highest first)
  const PIECE_SORT_ORDER = {
    'q': 1,
    'r': 2,
    'b': 3,
    'n': 4,
    'p': 5,
    'k': 6
  };

  /**
   * Get the image URL for a piece
   */
  function getPieceImageUrl(piece) {
    const filename = PIECE_IMAGES[piece];
    if (!filename) return null;
    return PIECE_IMAGE_BASE_URL + filename;
  }

  /**
   * Get point value for a piece
   */
  function getPieceValue(piece) {
    if (!piece || piece.length < 2) return 0;
    const type = piece[1];
    return PIECE_VALUES[type] || 0;
  }

  /**
   * Sort pieces by value (highest first)
   */
  function sortPiecesByValue(pieces) {
    return [...pieces].sort((a, b) => {
      const orderA = PIECE_SORT_ORDER[a[1]] || 99;
      const orderB = PIECE_SORT_ORDER[b[1]] || 99;
      return orderA - orderB;
    });
  }

  /**
   * Calculate total points for an array of pieces
   */
  function calculateTotalPoints(pieces) {
    return pieces.reduce((total, piece) => total + getPieceValue(piece), 0);
  }

  /**
   * Initialize the overlay system
   */
  function initialize() {
    createOverlayContainer();
    createFloatingButton();
    createControlPanel();
    createStatusDisplay();
    
    // Setup panel drag listeners
    setupPanelDragListeners();
    
    // Load saved panel position asynchronously (non-blocking)
    loadPanelPosition();
    
    // Preload piece images for smoother experience
    preloadPieceImages();
    
    console.log("Chess Analysis: Overlay UI initialized");
    console.log("Chess Analysis: Piece images URL base:", PIECE_IMAGE_BASE_URL);
  }

  /**
   * Preload all piece images for better performance
   */
  function preloadPieceImages() {
    Object.values(PIECE_IMAGES).forEach(filename => {
      const img = new Image();
      img.src = PIECE_IMAGE_BASE_URL + filename;
      img.onload = () => console.log("Chess Analysis: Loaded piece image:", filename);
      img.onerror = () => console.error("Chess Analysis: Failed to load piece image:", filename);
    });
  }

  /**
   * Load panel position from storage
   */
  async function loadPanelPosition() {
    try {
      const result = await browser.storage.local.get('panelPosition');
      if (result.panelPosition && result.panelPosition.x !== null) {
        panelPosition = result.panelPosition;
        
        if (controlPanel) {
          controlPanel.style.left = panelPosition.x + 'px';
          controlPanel.style.top = panelPosition.y + 'px';
        }
        
        console.log("Chess Analysis: Loaded panel position", panelPosition);
      }
    } catch (err) {
      console.log("Chess Analysis: Could not load panel position", err);
    }
  }

  /**
   * Save panel position to storage
   */
  async function savePanelPosition() {
    try {
      await browser.storage.local.set({ panelPosition });
      console.log("Chess Analysis: Saved panel position", panelPosition);
    } catch (err) {
      console.log("Chess Analysis: Could not save panel position", err);
    }
  }

  /**
   * Setup drag listeners for control panel
   */
  function setupPanelDragListeners() {
    document.addEventListener('mousemove', handlePanelDrag);
    document.addEventListener('mouseup', handlePanelDragEnd);
    
    document.addEventListener('touchmove', handlePanelTouchDrag, { passive: false });
    document.addEventListener('touchend', handlePanelTouchEnd);
  }

  /**
   * Handle panel drag start (mouse)
   */
  function handlePanelDragStart(e) {
    if (!e.target.closest('.control-header')) return;
    if (e.target.classList.contains('control-close')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    isDraggingPanel = true;
    
    const rect = controlPanel.getBoundingClientRect();
    panelDragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    controlPanel.classList.add('dragging-panel');
    document.body.style.userSelect = 'none';
  }

  /**
   * Handle panel drag move (mouse)
   */
  function handlePanelDrag(e) {
    if (!isDraggingPanel || !controlPanel) return;
    
    e.preventDefault();
    
    let newX = e.clientX - panelDragOffset.x;
    let newY = e.clientY - panelDragOffset.y;
    
    const panelRect = controlPanel.getBoundingClientRect();
    const maxX = window.innerWidth - panelRect.width;
    const maxY = window.innerHeight - panelRect.height;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    controlPanel.style.left = newX + 'px';
    controlPanel.style.top = newY + 'px';
    
    panelPosition = { x: newX, y: newY };
  }

  /**
   * Handle panel drag end (mouse)
   */
  function handlePanelDragEnd(e) {
    if (!isDraggingPanel) return;
    
    isDraggingPanel = false;
    
    if (controlPanel) {
      controlPanel.classList.remove('dragging-panel');
    }
    
    document.body.style.userSelect = '';
    
    savePanelPosition();
  }

  /**
   * Handle panel touch drag start
   */
  function handlePanelTouchStart(e) {
    if (!e.target.closest('.control-header')) return;
    if (e.target.classList.contains('control-close')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    isDraggingPanel = true;
    
    const touch = e.touches[0];
    const rect = controlPanel.getBoundingClientRect();
    panelDragOffset = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
    
    controlPanel.classList.add('dragging-panel');
  }

  /**
   * Handle panel touch drag move
   */
  function handlePanelTouchDrag(e) {
    if (!isDraggingPanel || !controlPanel) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    
    let newX = touch.clientX - panelDragOffset.x;
    let newY = touch.clientY - panelDragOffset.y;
    
    const panelRect = controlPanel.getBoundingClientRect();
    const maxX = window.innerWidth - panelRect.width;
    const maxY = window.innerHeight - panelRect.height;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    controlPanel.style.left = newX + 'px';
    controlPanel.style.top = newY + 'px';
    
    panelPosition = { x: newX, y: newY };
  }

  /**
   * Handle panel touch drag end
   */
  function handlePanelTouchEnd(e) {
    if (!isDraggingPanel) return;
    
    isDraggingPanel = false;
    
    if (controlPanel) {
      controlPanel.classList.remove('dragging-panel');
    }
    
    savePanelPosition();
  }

  /**
   * Create the main overlay container
   */
  function createOverlayContainer() {
    const existing = document.getElementById('chess-analysis-overlay');
    if (existing) existing.remove();

    overlayContainer = document.createElement('div');
    overlayContainer.id = 'chess-analysis-overlay';
    overlayContainer.className = 'chess-analysis-overlay-container';
    
    highlightLayer = document.createElement('div');
    highlightLayer.className = 'chess-analysis-highlight-layer';
    overlayContainer.appendChild(highlightLayer);
    
    pieceLayer = document.createElement('div');
    pieceLayer.className = 'chess-analysis-piece-layer';
    overlayContainer.appendChild(pieceLayer);
    
    document.body.appendChild(overlayContainer);
  }

  /**
   * Create the floating toggle button
   */
  function createFloatingButton() {
    const existing = document.getElementById('chess-analysis-toggle-btn');
    if (existing) existing.remove();

    floatingButton = document.createElement('button');
    floatingButton.id = 'chess-analysis-toggle-btn';
    floatingButton.className = 'chess-analysis-floating-btn';
    floatingButton.innerHTML = '♟';
    floatingButton.title = 'Toggle Chess Analysis (Alt+Shift+C)';
    
    document.body.appendChild(floatingButton);
    
    return floatingButton;
  }

  /**
   * Create the control panel with captured pieces section
   */
  function createControlPanel() {
    const existing = document.getElementById('chess-analysis-controls');
    if (existing) existing.remove();

    controlPanel = document.createElement('div');
    controlPanel.id = 'chess-analysis-controls';
    controlPanel.className = 'chess-analysis-control-panel';
    
    controlPanel.innerHTML = `
      <div class="control-header drag-handle">
        <span class="control-title">♟ Analysis Mode</span>
        <button class="control-close" title="Close">&times;</button>
      </div>
      <div class="control-body">
        <button class="control-btn" data-action="reset" title="Reset to current position (R)">
          ↺ Reset
        </button>
        <button class="control-btn" data-action="undo" title="Undo last move (Z)">
          ← Undo
        </button>
        <button class="control-btn" data-action="flip" title="Flip board view">
          ⇅ Flip
        </button>
        <div class="control-divider"></div>
        
        <!-- Captured Pieces Section -->
        <div class="captured-pieces-section">
          <div class="captured-pieces-title">Captured</div>
          <div class="captured-row black-captures" id="black-captures">
            <span class="captured-indicator">▪</span>
            <div class="captured-pieces-list" id="black-captures-list"></div>
            <span class="point-advantage" id="black-advantage"></span>
          </div>
          <div class="captured-row white-captures" id="white-captures">
            <span class="captured-indicator">▢</span>
            <div class="captured-pieces-list" id="white-captures-list"></div>
            <span class="point-advantage" id="white-advantage"></span>
          </div>
        </div>
        
        <div class="control-divider"></div>
        <label class="control-checkbox">
          <input type="checkbox" data-option="showPins" checked>
          <span>Show Pins</span>
        </label>
        <label class="control-checkbox">
          <input type="checkbox" data-option="showForks" checked>
          <span>Show Forks</span>
        </label>
        <label class="control-checkbox">
          <input type="checkbox" data-option="showLegalMoves" checked>
          <span>Show Legal Moves</span>
        </label>
      </div>
      <div class="control-footer">
        <span class="move-count">Moves: 0</span>
        <span class="turn-indicator">White to move</span>
      </div>
    `;
    
    document.body.appendChild(controlPanel);
    
    const header = controlPanel.querySelector('.control-header');
    header.addEventListener('mousedown', handlePanelDragStart);
    header.addEventListener('touchstart', handlePanelTouchStart, { passive: false });
    
    return controlPanel;
  }

  /**
   * Create a small piece image element for captured pieces display
   */
  function createSmallPieceImage(piece) {
    const container = document.createElement('div');
    container.className = 'captured-piece-icon';
    
    const imgUrl = getPieceImageUrl(piece);
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = piece;
      img.className = 'captured-piece-img';
      img.draggable = false;
      container.appendChild(img);
    }
    
    return container;
  }

  /**
   * Update the captured pieces display
   * @param {Array} whiteCaptured - Pieces captured by white (black pieces)
   * @param {Array} blackCaptured - Pieces captured by black (white pieces)
   */
  function updateCapturedPieces(whiteCaptured, blackCaptured) {
    const whiteList = document.getElementById('white-captures-list');
    const blackList = document.getElementById('black-captures-list');
    const whiteAdvantage = document.getElementById('white-advantage');
    const blackAdvantage = document.getElementById('black-advantage');
    
    if (!whiteList || !blackList) return;
    
    // Clear existing pieces
    whiteList.innerHTML = '';
    blackList.innerHTML = '';
    
    // Sort pieces by value (highest first)
    const sortedWhiteCaptured = sortPiecesByValue(whiteCaptured);
    const sortedBlackCaptured = sortPiecesByValue(blackCaptured);
    
    // Add white's captured pieces (black pieces that white captured)
    sortedWhiteCaptured.forEach(piece => {
      const pieceIcon = createSmallPieceImage(piece);
      whiteList.appendChild(pieceIcon);
    });
    
    // Add black's captured pieces (white pieces that black captured)
    sortedBlackCaptured.forEach(piece => {
      const pieceIcon = createSmallPieceImage(piece);
      blackList.appendChild(pieceIcon);
    });
    
    // Calculate points
    const whitePoints = calculateTotalPoints(whiteCaptured);
    const blackPoints = calculateTotalPoints(blackCaptured);
    const pointDifference = whitePoints - blackPoints;
    
    // Clear advantage indicators
    whiteAdvantage.textContent = '';
    blackAdvantage.textContent = '';
    whiteAdvantage.className = 'point-advantage';
    blackAdvantage.className = 'point-advantage';
    
    // Show point advantage
    if (pointDifference > 0) {
      // White has more material captured (white is ahead)
      whiteAdvantage.textContent = `+${pointDifference}`;
      whiteAdvantage.classList.add('has-advantage');
    } else if (pointDifference < 0) {
      // Black has more material captured (black is ahead)
      blackAdvantage.textContent = `+${Math.abs(pointDifference)}`;
      blackAdvantage.classList.add('has-advantage');
    }
    // If equal (pointDifference === 0), show nothing
  }

  /**
   * Clear captured pieces display
   */
  function clearCapturedPieces() {
    updateCapturedPieces([], []);
  }

  /**
   * Create the status display
   */
  function createStatusDisplay() {
    const existing = document.getElementById('chess-analysis-status');
    if (existing) existing.remove();

    statusDisplay = document.createElement('div');
    statusDisplay.id = 'chess-analysis-status';
    statusDisplay.className = 'chess-analysis-status';
    
    document.body.appendChild(statusDisplay);
  }

  /**
   * Position the overlay to match the board
   */
  function positionOverlay() {
    const dimensions = BoardParser.getBoardDimensions();
    if (!dimensions) {
      console.log("Chess Analysis: Cannot position overlay - no board dimensions");
      return false;
    }

    squareSize = dimensions.squareSize;
    boardOffset = { left: dimensions.left, top: dimensions.top };

    overlayContainer.style.left = dimensions.left + 'px';
    overlayContainer.style.top = dimensions.top + 'px';
    overlayContainer.style.width = dimensions.width + 'px';
    overlayContainer.style.height = dimensions.height + 'px';

    if (floatingButton) {
      floatingButton.style.left = (dimensions.left + dimensions.width + 10) + 'px';
      floatingButton.style.top = dimensions.top + 'px';
    }

    if (controlPanel && panelPosition.x === null) {
      controlPanel.style.left = (dimensions.left + dimensions.width + 10) + 'px';
      controlPanel.style.top = (dimensions.top + 50) + 'px';
    }

    return true;
  }

  /**
   * Hide original Chess.com pieces using CSS injection
   */
  function hideOriginalPieces() {
    showOriginalPieces();
    
    hideOriginalPiecesStyle = document.createElement('style');
    hideOriginalPiecesStyle.id = 'chess-analysis-hide-pieces';
    hideOriginalPiecesStyle.textContent = `
      /* Hide original Chess.com pieces when extension is active */
      chess-board .piece,
      wc-chess-board .piece,
      .board .piece:not(.chess-analysis-piece),
      [class*="board"] .piece:not(.chess-analysis-piece),
      .pieces-layer .piece,
      .piece-container .piece,
      .board-layout-main .piece:not(.chess-analysis-piece),
      #board-single .piece:not(.chess-analysis-piece),
      #board-play-computer .piece:not(.chess-analysis-piece),
      #board-vs-personalities .piece:not(.chess-analysis-piece) {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      .chess-analysis-piece {
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      .chess-analysis-piece.ghost {
        opacity: 0.3 !important;
      }
      
      .chess-analysis-piece.captured {
        opacity: 0 !important;
      }
    `;
    
    document.head.appendChild(hideOriginalPiecesStyle);
    console.log("Chess Analysis: Original pieces hidden");
  }

  /**
   * Show original Chess.com pieces by removing injected CSS
   */
  function showOriginalPieces() {
    if (hideOriginalPiecesStyle) {
      hideOriginalPiecesStyle.remove();
      hideOriginalPiecesStyle = null;
      console.log("Chess Analysis: Original pieces restored");
    }
    
    const existingStyle = document.getElementById('chess-analysis-hide-pieces');
    if (existingStyle) {
      existingStyle.remove();
    }
  }

  /**
   * Activate the overlay
   */
  function activate() {
    if (!BoardParser.refresh()) {
      showStatus("No chess board found on this page", "error");
      return false;
    }

    if (!positionOverlay()) {
      showStatus("Could not position overlay", "error");
      return false;
    }

    isActive = true;
    overlayContainer.classList.add('active');
    floatingButton.classList.add('active');
    controlPanel.classList.add('active');
    
    hideOriginalPieces();
    
    // Clear captured pieces on activation
    clearCapturedPieces();
    
    showStatus("Analysis mode activated", "success");
    
    return true;
  }

  /**
   * Deactivate the overlay
   */
  function deactivate() {
    isActive = false;
    overlayContainer.classList.remove('active');
    floatingButton.classList.remove('active');
    controlPanel.classList.remove('active');
    
    clearHighlights();
    clearPieces();
    
    showOriginalPieces();
    
    showStatus("Analysis mode deactivated", "info");
  }

  /**
   * Check if overlay is active
   */
  function getIsActive() {
    return isActive;
  }

  /**
   * Render pieces on the overlay
   */
  function renderPieces(board) {
    if (!pieceLayer) return;
    
    currentBoard = board;
    pieceLayer.innerHTML = '';

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const pieceEl = createPieceElement(piece, row, col);
          pieceLayer.appendChild(pieceEl);
        }
      }
    }
  }

  /**
   * Create a piece element using Alpha theme images
   */
  function createPieceElement(piece, row, col) {
    const pieceEl = document.createElement('div');
    pieceEl.className = `chess-analysis-piece ${piece}`;
    pieceEl.dataset.piece = piece;
    pieceEl.dataset.row = row;
    pieceEl.dataset.col = col;
    
    const imgUrl = getPieceImageUrl(piece);
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = piece;
      img.className = 'chess-analysis-piece-img';
      img.draggable = false;
      
      img.onerror = () => {
        console.error("Chess Analysis: Failed to load piece image:", imgUrl);
        pieceEl.innerHTML = getFallbackPieceSymbol(piece);
      };
      
      pieceEl.appendChild(img);
    } else {
      pieceEl.innerHTML = getFallbackPieceSymbol(piece);
    }
    
    pieceEl.style.left = (col * squareSize) + 'px';
    pieceEl.style.top = (row * squareSize) + 'px';
    pieceEl.style.width = squareSize + 'px';
    pieceEl.style.height = squareSize + 'px';
    
    return pieceEl;
  }

  /**
   * Get fallback Unicode symbol for a piece
   */
  function getFallbackPieceSymbol(piece) {
    const symbols = {
      'wk': '♔', 'wq': '♕', 'wr': '♖', 'wb': '♗', 'wn': '♘', 'wp': '♙',
      'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
    };
    return symbols[piece] || '?';
  }

  /**
   * Clear all pieces from overlay
   */
  function clearPieces() {
    if (pieceLayer) {
      pieceLayer.innerHTML = '';
    }
  }

  /**
   * Highlight legal move squares
   */
  function highlightLegalMoves(moves, fromRow, fromCol) {
    clearMoveHighlights();

    addHighlight(fromRow, fromCol, 'selected');

    for (const move of moves) {
      const type = move.isCapture ? 'capture' : 'legal';
      addHighlight(move.row, move.col, type);
    }
  }

  /**
   * Clear move highlights (but keep tactical highlights)
   */
  function clearMoveHighlights() {
    if (!highlightLayer) return;
    
    const moveHighlights = highlightLayer.querySelectorAll(
      '.highlight-selected, .highlight-legal, .highlight-capture'
    );
    moveHighlights.forEach(el => el.remove());
  }

  /**
   * Add a highlight to a square
   */
  function addHighlight(row, col, type, data = null) {
    if (!highlightLayer) return;

    const highlight = document.createElement('div');
    highlight.className = `chess-analysis-highlight highlight-${type}`;
    highlight.dataset.row = row;
    highlight.dataset.col = col;
    highlight.dataset.type = type;
    
    if (data) {
      highlight.dataset.info = JSON.stringify(data);
    }
    
    highlight.style.left = (col * squareSize) + 'px';
    highlight.style.top = (row * squareSize) + 'px';
    highlight.style.width = squareSize + 'px';
    highlight.style.height = squareSize + 'px';
    
    highlightLayer.appendChild(highlight);
    
    return highlight;
  }

  /**
   * Clear all highlights
   */
  function clearHighlights() {
    if (highlightLayer) {
      highlightLayer.innerHTML = '';
    }
  }

  /**
   * Render tactical highlights
   */
  function renderTacticalHighlights(highlights) {
    const existing = highlightLayer.querySelectorAll(
      '.highlight-pin, .highlight-fork, .highlight-hanging, .highlight-check'
    );
    existing.forEach(el => el.remove());

    for (const h of highlights) {
      addHighlight(h.row, h.col, h.type, h.data);
    }
  }

  /**
   * Highlight last move
   */
  function highlightLastMove(fromRow, fromCol, toRow, toCol) {
    const existing = highlightLayer.querySelectorAll('.highlight-lastmove');
    existing.forEach(el => el.remove());

    addHighlight(fromRow, fromCol, 'lastmove');
    addHighlight(toRow, toCol, 'lastmove');
  }

  /**
   * Update the status display
   */
  function showStatus(message, type = 'info') {
    if (!statusDisplay) return;

    statusDisplay.textContent = message;
    statusDisplay.className = `chess-analysis-status ${type}`;
    statusDisplay.classList.add('visible');

    clearTimeout(statusDisplay._hideTimer);
    statusDisplay._hideTimer = setTimeout(() => {
      statusDisplay.classList.remove('visible');
    }, 3000);
  }

  /**
   * Update the control panel info
   */
  function updateControlPanel(moveCount, colorToMove) {
    if (!controlPanel) return;

    const moveCountEl = controlPanel.querySelector('.move-count');
    const turnEl = controlPanel.querySelector('.turn-indicator');

    if (moveCountEl) {
      moveCountEl.textContent = `Moves: ${moveCount}`;
    }

    if (turnEl) {
      turnEl.textContent = colorToMove === 'w' ? 'White to move' : 'Black to move';
      turnEl.className = `turn-indicator ${colorToMove}`;
    }
  }

  /**
   * Get piece element at position
   */
  function getPieceElementAt(row, col) {
    if (!pieceLayer) return null;
    return pieceLayer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  }

  /**
   * Move a piece element visually
   */
  function movePieceElement(pieceEl, toRow, toCol, animate = true) {
    if (!pieceEl) return;

    if (animate) {
      pieceEl.classList.add('moving');
    }

    pieceEl.style.left = (toCol * squareSize) + 'px';
    pieceEl.style.top = (toRow * squareSize) + 'px';
    pieceEl.dataset.row = toRow;
    pieceEl.dataset.col = toCol;

    if (animate) {
      setTimeout(() => {
        pieceEl.classList.remove('moving');
      }, 200);
    }
  }

  /**
   * Remove a piece element
   */
  function removePieceElement(row, col) {
    const pieceEl = getPieceElementAt(row, col);
    if (pieceEl) {
      pieceEl.classList.add('captured');
      setTimeout(() => pieceEl.remove(), 200);
    }
  }

  /**
   * Convert screen coordinates to board square
   */
  function screenToSquare(clientX, clientY) {
    const dimensions = BoardParser.getBoardDimensions();
    if (!dimensions) return null;

    const x = clientX - dimensions.left;
    const y = clientY - dimensions.top;

    if (x < 0 || x >= dimensions.width || y < 0 || y >= dimensions.height) {
      return null;
    }

    const col = Math.floor(x / dimensions.squareSize);
    const row = Math.floor(y / dimensions.squareSize);

    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
      return { row, col };
    }

    return null;
  }

  /**
   * Get the center position of a square in screen coordinates
   */
  function squareToScreen(row, col) {
    return {
      x: boardOffset.left + (col * squareSize) + (squareSize / 2),
      y: boardOffset.top + (row * squareSize) + (squareSize / 2)
    };
  }

  /**
   * Get current square size
   */
  function getSquareSize() {
    return squareSize;
  }

  /**
   * Get UI element references
   */
  function getElements() {
    return {
      overlayContainer,
      pieceLayer,
      highlightLayer,
      floatingButton,
      controlPanel,
      statusDisplay
    };
  }

  /**
   * Check if currently dragging the control panel
   */
  function isDraggingControlPanel() {
    return isDraggingPanel;
  }

  /**
   * Cleanup and remove all UI elements
   */
  function cleanup() {
    showOriginalPieces();
    
    document.removeEventListener('mousemove', handlePanelDrag);
    document.removeEventListener('mouseup', handlePanelDragEnd);
    document.removeEventListener('touchmove', handlePanelTouchDrag);
    document.removeEventListener('touchend', handlePanelTouchEnd);
    
    if (overlayContainer) overlayContainer.remove();
    if (floatingButton) floatingButton.remove();
    if (controlPanel) controlPanel.remove();
    if (statusDisplay) statusDisplay.remove();
    
    overlayContainer = null;
    pieceLayer = null;
    highlightLayer = null;
    floatingButton = null;
    controlPanel = null;
    statusDisplay = null;
    isActive = false;
  }

  // Public API
  return {
    initialize,
    positionOverlay,
    activate,
    deactivate,
    get isActive() { return isActive; },
    renderPieces,
    clearPieces,
    highlightLegalMoves,
    clearMoveHighlights,
    addHighlight,
    clearHighlights,
    renderTacticalHighlights,
    highlightLastMove,
    showStatus,
    updateControlPanel,
    getPieceElementAt,
    movePieceElement,
    removePieceElement,
    screenToSquare,
    squareToScreen,
    getSquareSize,
    getElements,
    cleanup,
    createPieceElement,
    hideOriginalPieces,
    showOriginalPieces,
    isDraggingControlPanel,
    savePanelPosition,
    loadPanelPosition,
    // Captured pieces functions
    updateCapturedPieces,
    clearCapturedPieces,
    getPieceValue,
    calculateTotalPoints
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.OverlayUI = OverlayUI;
}