/**
 * Drag System Module
 * Handles piece dragging and move execution
 * 
 * UPDATED: Added checks to prevent drag conflicts with control panel
 */

const DragSystem = (function() {
  'use strict';

  // Drag state
  let isDragging = false;
  let draggedPiece = null;
  let draggedElement = null;
  let dragStartPos = null;
  let dragOffset = { x: 0, y: 0 };
  let legalMoves = [];
  let ghostElement = null;

  // Callbacks
  let onMoveCallback = null;

  /**
   * Initialize the drag system
   */
  function initialize(moveCallback) {
    onMoveCallback = moveCallback;
    setupEventListeners();
    console.log("Chess Analysis: Drag system initialized");
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    
    // Touch support
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
  }

  /**
   * Handle mouse down event
   * MODIFIED: Added checks to prevent conflicts with control panel dragging
   */
  function handleMouseDown(e) {
    if (!OverlayUI.isActive) return;
    
    // NEW: Don't start piece drag if panel is being dragged
    if (OverlayUI.isDraggingControlPanel && OverlayUI.isDraggingControlPanel()) {
      return;
    }
    
    // NEW: Don't start piece drag if clicking on control panel
    if (e.target.closest('.chess-analysis-control-panel')) {
      return;
    }
    
    // NEW: Don't start piece drag if clicking on floating button
    if (e.target.closest('.chess-analysis-floating-btn')) {
      return;
    }
    
    // NEW: Don't start piece drag if clicking on status display
    if (e.target.closest('.chess-analysis-status')) {
      return;
    }

    const pieceEl = e.target.closest('.chess-analysis-piece');
    if (!pieceEl) return;

    e.preventDefault();
    e.stopPropagation();

    startDrag(pieceEl, e.clientX, e.clientY);
  }

  /**
   * Handle mouse move event
   */
  function handleMouseMove(e) {
    if (!isDragging || !OverlayUI.isActive) return;

    e.preventDefault();
    updateDrag(e.clientX, e.clientY);
  }

  /**
   * Handle mouse up event
   */
  function handleMouseUp(e) {
    if (!isDragging || !OverlayUI.isActive) return;

    e.preventDefault();
    endDrag(e.clientX, e.clientY);
  }

  /**
   * Handle touch start
   * MODIFIED: Added checks to prevent conflicts with control panel dragging
   */
  function handleTouchStart(e) {
    if (!OverlayUI.isActive) return;
    
    // NEW: Don't start piece drag if panel is being dragged
    if (OverlayUI.isDraggingControlPanel && OverlayUI.isDraggingControlPanel()) {
      return;
    }

    const touch = e.touches[0];
    const elementAtTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    
    // NEW: Don't start piece drag if touching control panel
    if (elementAtTouch && elementAtTouch.closest('.chess-analysis-control-panel')) {
      return;
    }
    
    // NEW: Don't start piece drag if touching floating button
    if (elementAtTouch && elementAtTouch.closest('.chess-analysis-floating-btn')) {
      return;
    }
    
    // NEW: Don't start piece drag if touching status display
    if (elementAtTouch && elementAtTouch.closest('.chess-analysis-status')) {
      return;
    }
    
    // Check if we're touching a piece element
    const pieceEl = elementAtTouch && elementAtTouch.closest('.chess-analysis-piece');
    
    if (pieceEl) {
      e.preventDefault();
      startDrag(pieceEl, touch.clientX, touch.clientY);
    }
  }

  /**
   * Handle touch move
   */
  function handleTouchMove(e) {
    if (!isDragging || !OverlayUI.isActive) return;

    e.preventDefault();
    const touch = e.touches[0];
    updateDrag(touch.clientX, touch.clientY);
  }

  /**
   * Handle touch end
   */
  function handleTouchEnd(e) {
    if (!isDragging || !OverlayUI.isActive) return;

    e.preventDefault();
    const touch = e.changedTouches[0];
    endDrag(touch.clientX, touch.clientY);
  }

  /**
   * Start dragging a piece
   */
  function startDrag(pieceEl, clientX, clientY) {
    const row = parseInt(pieceEl.dataset.row);
    const col = parseInt(pieceEl.dataset.col);
    const piece = pieceEl.dataset.piece;

    if (isNaN(row) || isNaN(col) || !piece) return;

    // Get current game state
    const gameState = window.ChessAnalysisExtension?.getGameState() || {};
    const board = window.ChessAnalysisExtension?.getShadowBoard();
    
    if (!board) return;

    // Check if it's this piece's turn
    const colorToMove = gameState.colorToMove || 'w';
    const pieceColor = piece[0];
    
    if (pieceColor !== colorToMove) {
      OverlayUI.showStatus("Not your turn", "warning");
      return;
    }

    // Get legal moves for this piece
    legalMoves = ChessRules.getLegalMoves(board, row, col, gameState);

    if (legalMoves.length === 0) {
      OverlayUI.showStatus("No legal moves", "warning");
      return;
    }

    isDragging = true;
    draggedElement = pieceEl;
    draggedPiece = { row, col, piece };
    
    const rect = pieceEl.getBoundingClientRect();
    dragOffset = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
    dragStartPos = { row, col };

    // Style the dragged piece
    pieceEl.classList.add('dragging');

    // Create ghost piece at original position
    createGhost(piece, row, col);

    // Highlight legal moves
    OverlayUI.highlightLegalMoves(legalMoves, row, col);

    // Move piece to cursor
    updateDragPosition(clientX, clientY);
  }

  /**
   * Update drag position
   */
  function updateDrag(clientX, clientY) {
    if (!isDragging || !draggedElement) return;

    updateDragPosition(clientX, clientY);

    // Highlight hovered square
    const square = OverlayUI.screenToSquare(clientX, clientY);
    updateHoverHighlight(square);
  }

  /**
   * Update the position of the dragged piece
   */
  function updateDragPosition(clientX, clientY) {
    if (!draggedElement) return;

    const dimensions = BoardParser.getBoardDimensions();
    if (!dimensions) return;

    const x = clientX - dimensions.left - dragOffset.x;
    const y = clientY - dimensions.top - dragOffset.y;

    draggedElement.style.left = x + 'px';
    draggedElement.style.top = y + 'px';
    draggedElement.style.zIndex = '10000';
  }

  /**
   * Update hover highlight
   */
  function updateHoverHighlight(square) {
    // Remove previous hover highlight
    const existing = document.querySelector('.highlight-hover');
    if (existing) existing.remove();

    if (square) {
      const isLegal = legalMoves.some(m => m.row === square.row && m.col === square.col);
      if (isLegal) {
        OverlayUI.addHighlight(square.row, square.col, 'hover');
      }
    }
  }

  /**
   * End drag operation
   */
  function endDrag(clientX, clientY) {
    if (!isDragging || !draggedElement || !dragStartPos) {
      resetDrag();
      return;
    }

    const targetSquare = OverlayUI.screenToSquare(clientX, clientY);
    let moveExecuted = false;

    if (targetSquare) {
      // Check if this is a legal move
      const move = legalMoves.find(m => m.row === targetSquare.row && m.col === targetSquare.col);
      
      if (move) {
        // Execute the move
        if (onMoveCallback) {
          moveExecuted = onMoveCallback(
            dragStartPos.row, 
            dragStartPos.col, 
            targetSquare.row, 
            targetSquare.col,
            move
          );
        }
      }
    }

    if (!moveExecuted) {
      // Snap back to original position
      snapBack();
    }

    resetDrag();
  }

  /**
   * Snap piece back to original position
   */
  function snapBack() {
    if (!draggedElement || !dragStartPos) return;

    const squareSize = OverlayUI.getSquareSize();
    
    draggedElement.classList.add('snapping');
    draggedElement.style.left = (dragStartPos.col * squareSize) + 'px';
    draggedElement.style.top = (dragStartPos.row * squareSize) + 'px';
    draggedElement.style.zIndex = '';

    setTimeout(() => {
      if (draggedElement) {
        draggedElement.classList.remove('snapping');
      }
    }, 200);
  }

  /**
   * Create ghost piece at original position
   */
  function createGhost(piece, row, col) {
    removeGhost();

    const squareSize = OverlayUI.getSquareSize();
    
    ghostElement = document.createElement('div');
    ghostElement.className = 'chess-analysis-piece ghost';
    ghostElement.innerHTML = draggedElement.innerHTML;
    ghostElement.style.left = (col * squareSize) + 'px';
    ghostElement.style.top = (row * squareSize) + 'px';
    ghostElement.style.width = squareSize + 'px';
    ghostElement.style.height = squareSize + 'px';
    ghostElement.style.fontSize = (squareSize * 0.8) + 'px';
    ghostElement.style.lineHeight = squareSize + 'px';

    const pieceLayer = OverlayUI.getElements().pieceLayer;
    if (pieceLayer) {
      pieceLayer.appendChild(ghostElement);
    }
  }

  /**
   * Remove ghost piece
   */
  function removeGhost() {
    if (ghostElement) {
      ghostElement.remove();
      ghostElement = null;
    }
  }

  /**
   * Reset drag state
   */
  function resetDrag() {
    if (draggedElement) {
      draggedElement.classList.remove('dragging');
      draggedElement.style.zIndex = '';
    }

    removeGhost();
    
    isDragging = false;
    draggedPiece = null;
    draggedElement = null;
    dragStartPos = null;
    legalMoves = [];

    // Clear move highlights
    OverlayUI.clearMoveHighlights();
    
    // Remove hover highlight
    const hoverEl = document.querySelector('.highlight-hover');
    if (hoverEl) hoverEl.remove();
  }

  /**
   * Check if currently dragging
   */
  function getIsDragging() {
    return isDragging;
  }

  /**
   * Get the currently dragged piece info
   */
  function getDraggedPiece() {
    return draggedPiece;
  }

  /**
   * Cleanup event listeners
   */
  function cleanup() {
    document.removeEventListener('mousedown', handleMouseDown, true);
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('mouseup', handleMouseUp, true);
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    
    resetDrag();
    onMoveCallback = null;
    
    console.log("Chess Analysis: Drag system cleaned up");
  }

  // Public API
  return {
    initialize,
    cleanup,
    resetDrag,
    get isDragging() { return isDragging; },
    get draggedPiece() { return draggedPiece; },
    getIsDragging,
    getDraggedPiece
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.DragSystem = DragSystem;
}