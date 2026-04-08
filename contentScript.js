/**
 * Chess Analysis Extension - Content Script
 * Main entry point that initializes and coordinates all modules
 */

(function() {
  'use strict';

  // Extension state
  const state = {
    isEnabled: false,
    shadowBoard: null,
    originalBoard: null,
    moveHistory: [],
    colorToMove: 'w',
    gameState: {
      castlingRights: {
        w: { kingside: true, queenside: true },
        b: { kingside: true, queenside: true }
      },
      enPassantSquare: null,
      colorToMove: 'w'
    },
    options: {
      showPins: true,
      showForks: true,
      showLegalMoves: true
    },
    // Captured pieces tracking
    capturedByWhite: [], // Black pieces captured by white
    capturedByBlack: []  // White pieces captured by black
  };

  /**
   * Initialize the extension
   */
  function initialize() {
    console.log("Chess Analysis Extension: Initializing...");

    waitForBoard().then(() => {
      OverlayUI.initialize();
      DragSystem.initialize(handleMove);
      setupEventListeners();
      setupKeyboardShortcuts();
      browser.runtime.onMessage.addListener(handleMessage);

      console.log("Chess Analysis Extension: Ready");
    }).catch(err => {
      console.log("Chess Analysis Extension: No chess board found");
    });
  }

  /**
   * Wait for board to be available
   */
  function waitForBoard(maxAttempts = 20) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      function check() {
        if (BoardParser.findBoardElement()) {
          resolve();
          return;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error("Board not found"));
          return;
        }
        
        setTimeout(check, 500);
      }
      
      check();
    });
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    const elements = OverlayUI.getElements();

    if (elements.floatingButton) {
      elements.floatingButton.addEventListener('click', toggleExtension);
    }

    if (elements.controlPanel) {
      elements.controlPanel.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action) {
          handleControlAction(action);
        }
        
        if (e.target.classList.contains('control-close')) {
          toggleExtension();
        }
      });

      elements.controlPanel.addEventListener('change', (e) => {
        const option = e.target.dataset.option;
        if (option) {
          state.options[option] = e.target.checked;
          updateDisplay();
        }
      });
    }

    window.addEventListener('resize', debounce(() => {
      if (state.isEnabled) {
        OverlayUI.positionOverlay();
        updateDisplay();
      }
    }, 250));

    BoardParser.startObserving((newBoard) => {
      if (state.isEnabled) {
        OverlayUI.showStatus("Real board changed. Press R to reset.", "info");
      }
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!state.isEnabled) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'r':
          resetBoard();
          e.preventDefault();
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            undoMove();
            e.preventDefault();
          }
          break;
        case 'escape':
          toggleExtension();
          e.preventDefault();
          break;
      }
    });
  }

  /**
   * Handle messages from background script
   */
  function handleMessage(message, sender, sendResponse) {
    if (message.action === 'toggle') {
      toggleExtension();
      sendResponse({ success: true });
    }
    return true;
  }

  /**
   * Toggle extension on/off
   */
  function toggleExtension() {
    if (state.isEnabled) {
      deactivate();
    } else {
      activate();
    }
  }

  /**
   * Activate the extension
   */
  function activate() {
    const board = BoardParser.getCurrentBoard();
    if (!board) {
      OverlayUI.showStatus("Could not read board position", "error");
      return;
    }

    state.originalBoard = BoardParser.cloneBoard(board);
    state.shadowBoard = BoardParser.cloneBoard(board);
    state.moveHistory = [];
    
    // Reset captured pieces
    state.capturedByWhite = [];
    state.capturedByBlack = [];
    
    state.colorToMove = detectColorToMove(board);
    
    state.gameState = {
      castlingRights: detectCastlingRights(board),
      enPassantSquare: null,
      colorToMove: state.colorToMove
    };

    if (!OverlayUI.activate()) {
      return;
    }

    state.isEnabled = true;

    updateDisplay();
    
    // Update captured pieces display (empty on start)
    OverlayUI.updateCapturedPieces(state.capturedByWhite, state.capturedByBlack);

    const turnText = state.colorToMove === 'w' ? "White" : "Black";
    OverlayUI.showStatus(`Analysis mode ON - ${turnText} to move`, "success");
  }

  /**
   * Deactivate the extension
   */
  function deactivate() {
    state.isEnabled = false;
    OverlayUI.deactivate();
    DragSystem.resetDrag();
    OverlayUI.showStatus("Analysis mode OFF", "info");
  }

  /**
   * Handle a move
   */
  function handleMove(fromRow, fromCol, toRow, toCol, moveInfo) {
    if (!state.shadowBoard) return false;

    const piece = state.shadowBoard[fromRow][fromCol];
    if (!piece) return false;

    const pieceInfo = ChessRules.parsePiece(piece);
    
    // Verify it's this piece's turn
    if (pieceInfo.color !== state.colorToMove) {
      OverlayUI.showStatus(`It's ${state.colorToMove === 'w' ? "White" : "Black"}'s turn`, "warning");
      return false;
    }
    
    const capturedPiece = state.shadowBoard[toRow][toCol];
    
    // Handle en passant capture
    let enPassantCapturedPiece = null;
    if (moveInfo.isEnPassant) {
      enPassantCapturedPiece = state.shadowBoard[fromRow][toCol];
    }

    // Store move in history
    state.moveHistory.push({
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece,
      captured: capturedPiece,
      enPassantCaptured: enPassantCapturedPiece,
      moveInfo,
      previousGameState: JSON.parse(JSON.stringify(state.gameState)),
      previousColorToMove: state.colorToMove
    });

    // Execute move on shadow board
    state.shadowBoard[toRow][toCol] = piece;
    state.shadowBoard[fromRow][fromCol] = "";

    // Handle special moves
    handleSpecialMoves(fromRow, fromCol, toRow, toCol, piece, moveInfo);

    // Track captured pieces
    if (capturedPiece) {
      if (pieceInfo.color === 'w') {
        // White captured a black piece
        state.capturedByWhite.push(capturedPiece);
      } else {
        // Black captured a white piece
        state.capturedByBlack.push(capturedPiece);
      }
    }
    
    // Track en passant captures
    if (enPassantCapturedPiece) {
      if (pieceInfo.color === 'w') {
        state.capturedByWhite.push(enPassantCapturedPiece);
      } else {
        state.capturedByBlack.push(enPassantCapturedPiece);
      }
    }

    // Update game state
    updateGameState(fromRow, fromCol, toRow, toCol, piece, moveInfo);

    // Switch turn
    state.colorToMove = ChessRules.oppositeColor(state.colorToMove);
    state.gameState.colorToMove = state.colorToMove;

    // Update display
    updateDisplay();
    
    // Update captured pieces display
    OverlayUI.updateCapturedPieces(state.capturedByWhite, state.capturedByBlack);

    // Highlight last move
    OverlayUI.highlightLastMove(fromRow, fromCol, toRow, toCol);

    // Show whose turn it is
    const turnText = state.colorToMove === 'w' ? "White" : "Black";
    OverlayUI.showStatus(`${turnText}'s turn`, "info");

    // Check for checkmate/stalemate
    checkGameEnd();

    return true;
  }

  /**
   * Handle special moves (castling, en passant, promotion)
   */
  function handleSpecialMoves(fromRow, fromCol, toRow, toCol, piece, moveInfo) {
    const pieceInfo = ChessRules.parsePiece(piece);

    // Castling
    if (moveInfo.isCastling) {
      const row = toRow;
      if (moveInfo.isCastling === 'kingside') {
        state.shadowBoard[row][5] = state.shadowBoard[row][7];
        state.shadowBoard[row][7] = "";
      } else {
        state.shadowBoard[row][3] = state.shadowBoard[row][0];
        state.shadowBoard[row][0] = "";
      }
    }

    // En passant
    if (moveInfo.isEnPassant) {
      state.shadowBoard[fromRow][toCol] = "";
    }

    // Promotion
    if (moveInfo.promotion) {
      state.shadowBoard[toRow][toCol] = pieceInfo.color + moveInfo.promotion;
    }
  }

  /**
   * Update game state after a move
   */
  function updateGameState(fromRow, fromCol, toRow, toCol, piece, moveInfo) {
    const pieceInfo = ChessRules.parsePiece(piece);
    const color = pieceInfo.color;

    // Update castling rights
    if (pieceInfo.type === 'k') {
      state.gameState.castlingRights[color] = { kingside: false, queenside: false };
    }
    if (pieceInfo.type === 'r') {
      if (fromCol === 0) {
        state.gameState.castlingRights[color].queenside = false;
      } else if (fromCol === 7) {
        state.gameState.castlingRights[color].kingside = false;
      }
    }

    // Update en passant square
    state.gameState.enPassantSquare = null;
    if (moveInfo.isDoublePush) {
      const epRow = (fromRow + toRow) / 2;
      state.gameState.enPassantSquare = { row: epRow, col: toCol };
    }
  }

  /**
   * Check for checkmate or stalemate
   */
  function checkGameEnd() {
    if (ChessRules.isCheckmate(state.shadowBoard, state.colorToMove, state.gameState)) {
      const winner = ChessRules.oppositeColor(state.colorToMove);
      OverlayUI.showStatus(`Checkmate! ${winner === 'w' ? 'White' : 'Black'} wins!`, "success");
    } else if (ChessRules.isStalemate(state.shadowBoard, state.colorToMove, state.gameState)) {
      OverlayUI.showStatus("Stalemate! Draw.", "info");
    } else if (ChessRules.isInCheck(state.shadowBoard, state.colorToMove)) {
      const turnText = state.colorToMove === 'w' ? "White" : "Black";
      OverlayUI.showStatus(`${turnText} is in Check!`, "warning");
    }
  }

  /**
   * Undo the last move
   */
  function undoMove() {
    if (state.moveHistory.length === 0) {
      OverlayUI.showStatus("No moves to undo", "warning");
      return;
    }

    const lastMove = state.moveHistory.pop();

    // Restore piece positions
    state.shadowBoard[lastMove.from.row][lastMove.from.col] = lastMove.piece;
    state.shadowBoard[lastMove.to.row][lastMove.to.col] = lastMove.captured || "";

    // Restore game state
    state.gameState = lastMove.previousGameState;
    state.colorToMove = lastMove.previousColorToMove;
    state.gameState.colorToMove = state.colorToMove;

    // Handle special move undo
    if (lastMove.moveInfo.isCastling) {
      const row = lastMove.to.row;
      if (lastMove.moveInfo.isCastling === 'kingside') {
        state.shadowBoard[row][7] = state.shadowBoard[row][5];
        state.shadowBoard[row][5] = "";
      } else {
        state.shadowBoard[row][0] = state.shadowBoard[row][3];
        state.shadowBoard[row][3] = "";
      }
    }

    if (lastMove.moveInfo.isEnPassant) {
      // Restore captured pawn
      const capturedRow = lastMove.from.row;
      const capturedCol = lastMove.to.col;
      const capturedColor = ChessRules.oppositeColor(lastMove.piece[0]);
      state.shadowBoard[capturedRow][capturedCol] = capturedColor + 'p';
    }

    // Restore captured pieces
    if (lastMove.captured) {
      // Remove the captured piece from the appropriate list
      if (lastMove.piece[0] === 'w') {
        // White made the capture, remove from white's captures
        const index = state.capturedByWhite.lastIndexOf(lastMove.captured);
        if (index !== -1) {
          state.capturedByWhite.splice(index, 1);
        }
      } else {
        // Black made the capture, remove from black's captures
        const index = state.capturedByBlack.lastIndexOf(lastMove.captured);
        if (index !== -1) {
          state.capturedByBlack.splice(index, 1);
        }
      }
    }
    
    // Restore en passant captured piece
    if (lastMove.enPassantCaptured) {
      if (lastMove.piece[0] === 'w') {
        const index = state.capturedByWhite.lastIndexOf(lastMove.enPassantCaptured);
        if (index !== -1) {
          state.capturedByWhite.splice(index, 1);
        }
      } else {
        const index = state.capturedByBlack.lastIndexOf(lastMove.enPassantCaptured);
        if (index !== -1) {
          state.capturedByBlack.splice(index, 1);
        }
      }
    }

    // Update display
    updateDisplay();
    
    // Update captured pieces display
    OverlayUI.updateCapturedPieces(state.capturedByWhite, state.capturedByBlack);

    const turnText = state.colorToMove === 'w' ? "White" : "Black";
    OverlayUI.showStatus(`Move undone - ${turnText}'s turn`, "info");
  }

  /**
   * Reset board to original position
   */
  function resetBoard() {
    const board = BoardParser.getCurrentBoard();
    if (board) {
      state.originalBoard = BoardParser.cloneBoard(board);
    }

    state.shadowBoard = BoardParser.cloneBoard(state.originalBoard);
    state.moveHistory = [];
    
    // Reset captured pieces
    state.capturedByWhite = [];
    state.capturedByBlack = [];
    
    state.colorToMove = detectColorToMove(state.shadowBoard);
    
    state.gameState = {
      castlingRights: detectCastlingRights(state.shadowBoard),
      enPassantSquare: null,
      colorToMove: state.colorToMove
    };

    updateDisplay();
    
    // Clear captured pieces display
    OverlayUI.updateCapturedPieces([], []);

    const turnText = state.colorToMove === 'w' ? "White" : "Black";
    OverlayUI.showStatus(`Board reset - ${turnText}'s turn`, "success");
  }

  /**
   * Update the display
   */
  function updateDisplay() {
    if (!state.isEnabled || !state.shadowBoard) return;

    OverlayUI.renderPieces(state.shadowBoard);
    OverlayUI.updateControlPanel(state.moveHistory.length, state.colorToMove);

    if (state.options.showPins || state.options.showForks) {
      const highlights = Tactics.getTacticalHighlights(
        state.shadowBoard, 
        state.colorToMove, 
        state.gameState
      );

      const filteredHighlights = highlights.filter(h => {
        if (h.type === 'pin' && !state.options.showPins) return false;
        if (h.type === 'fork' && !state.options.showForks) return false;
        return true;
      });

      OverlayUI.renderTacticalHighlights(filteredHighlights);
    }
  }

  /**
   * Handle control panel actions
   */
  function handleControlAction(action) {
    switch (action) {
      case 'reset':
        resetBoard();
        break;
      case 'undo':
        undoMove();
        break;
      case 'flip':
        OverlayUI.showStatus("Flip not implemented yet", "info");
        break;
    }
  }

  /**
   * Detect which color should move
   */
  function detectColorToMove(board) {
    const detectedTurn = BoardParser.detectTurnFromDOM();
    console.log("Chess Analysis: Detected turn from DOM:", detectedTurn);
    return detectedTurn;
  }

  /**
   * Detect castling rights from board position
   */
  function detectCastlingRights(board) {
    const rights = {
      w: { kingside: false, queenside: false },
      b: { kingside: false, queenside: false }
    };

    if (board[7][4] === 'wk') {
      if (board[7][7] === 'wr') rights.w.kingside = true;
      if (board[7][0] === 'wr') rights.w.queenside = true;
    }

    if (board[0][4] === 'bk') {
      if (board[0][7] === 'br') rights.b.kingside = true;
      if (board[0][0] === 'br') rights.b.queenside = true;
    }

    return rights;
  }

  /**
   * Debounce utility
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Expose API for other modules
  window.ChessAnalysisExtension = {
    getState: () => state,
    getGameState: () => state.gameState,
    getShadowBoard: () => state.shadowBoard,
    getColorToMove: () => state.colorToMove,
    getCapturedPieces: () => ({
      byWhite: state.capturedByWhite,
      byBlack: state.capturedByBlack
    }),
    isEnabled: () => state.isEnabled,
    toggle: toggleExtension,
    reset: resetBoard,
    undo: undoMove
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();