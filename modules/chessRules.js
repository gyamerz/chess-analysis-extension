/**
 * Chess Rules Module
 * Pure rule-based chess legality system without any engine evaluation
 */

const ChessRules = (function() {
  'use strict';

  // Piece type constants
  const PIECE_TYPES = {
    PAWN: 'p',
    KNIGHT: 'n',
    BISHOP: 'b',
    ROOK: 'r',
    QUEEN: 'q',
    KING: 'k'
  };

  // Color constants
  const COLORS = {
    WHITE: 'w',
    BLACK: 'b'
  };

  /**
   * Parse piece notation (e.g., "wp" -> { color: 'w', type: 'p' })
   */
  function parsePiece(piece) {
    if (!piece || piece.length !== 2) return null;
    return {
      color: piece[0],
      type: piece[1]
    };
  }

  /**
   * Create piece notation from color and type
   */
  function createPiece(color, type) {
    return color + type;
  }

  /**
   * Check if position is within board bounds
   */
  function isValidSquare(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  /**
   * Get the opposite color
   */
  function oppositeColor(color) {
    return color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  }

  /**
   * Check if a square is occupied by enemy piece
   */
  function isEnemyPiece(board, row, col, myColor) {
    if (!isValidSquare(row, col)) return false;
    const piece = board[row][col];
    if (!piece) return false;
    return piece[0] !== myColor;
  }

  /**
   * Check if a square is empty
   */
  function isEmpty(board, row, col) {
    if (!isValidSquare(row, col)) return false;
    return !board[row][col];
  }

  /**
   * Check if a square is empty or has enemy piece
   */
  function canMoveTo(board, row, col, myColor) {
    if (!isValidSquare(row, col)) return false;
    const piece = board[row][col];
    return !piece || piece[0] !== myColor;
  }

  /**
   * Get all squares attacked by a piece (ignoring pins)
   */
  function getAttackedSquares(board, fromRow, fromCol) {
    const piece = parsePiece(board[fromRow][fromCol]);
    if (!piece) return [];

    const attacks = [];
    const { color, type } = piece;

    switch (type) {
      case PIECE_TYPES.PAWN:
        // Pawns attack diagonally
        const pawnDir = color === COLORS.WHITE ? -1 : 1;
        if (isValidSquare(fromRow + pawnDir, fromCol - 1)) {
          attacks.push({ row: fromRow + pawnDir, col: fromCol - 1 });
        }
        if (isValidSquare(fromRow + pawnDir, fromCol + 1)) {
          attacks.push({ row: fromRow + pawnDir, col: fromCol + 1 });
        }
        break;

      case PIECE_TYPES.KNIGHT:
        const knightMoves = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of knightMoves) {
          const newRow = fromRow + dr;
          const newCol = fromCol + dc;
          if (isValidSquare(newRow, newCol)) {
            attacks.push({ row: newRow, col: newCol });
          }
        }
        break;

      case PIECE_TYPES.BISHOP:
        addSlidingAttacks(board, fromRow, fromCol, [[-1, -1], [-1, 1], [1, -1], [1, 1]], attacks);
        break;

      case PIECE_TYPES.ROOK:
        addSlidingAttacks(board, fromRow, fromCol, [[-1, 0], [1, 0], [0, -1], [0, 1]], attacks);
        break;

      case PIECE_TYPES.QUEEN:
        addSlidingAttacks(board, fromRow, fromCol, [
          [-1, -1], [-1, 1], [1, -1], [1, 1],
          [-1, 0], [1, 0], [0, -1], [0, 1]
        ], attacks);
        break;

      case PIECE_TYPES.KING:
        const kingMoves = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1], [0, 1],
          [1, -1], [1, 0], [1, 1]
        ];
        for (const [dr, dc] of kingMoves) {
          const newRow = fromRow + dr;
          const newCol = fromCol + dc;
          if (isValidSquare(newRow, newCol)) {
            attacks.push({ row: newRow, col: newCol });
          }
        }
        break;
    }

    return attacks;
  }

  /**
   * Add sliding piece attacks (bishop, rook, queen)
   */
  function addSlidingAttacks(board, fromRow, fromCol, directions, attacks) {
    for (const [dr, dc] of directions) {
      let row = fromRow + dr;
      let col = fromCol + dc;
      
      while (isValidSquare(row, col)) {
        attacks.push({ row, col });
        
        // Stop if we hit any piece
        if (board[row][col]) break;
        
        row += dr;
        col += dc;
      }
    }
  }

  /**
   * Find the king position for a given color
   */
  function findKing(board, color) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece === color + PIECE_TYPES.KING) {
          return { row, col };
        }
      }
    }
    return null;
  }

  /**
   * Check if a square is attacked by any piece of given color
   */
  function isSquareAttacked(board, row, col, byColor) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece[0] === byColor) {
          const attacks = getAttackedSquares(board, r, c);
          if (attacks.some(a => a.row === row && a.col === col)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Check if the king of given color is in check
   */
  function isInCheck(board, color) {
    const king = findKing(board, color);
    if (!king) return false;
    return isSquareAttacked(board, king.row, king.col, oppositeColor(color));
  }

  /**
   * Make a move on a copy of the board and return the new board
   */
  function makeTestMove(board, fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    const newBoard = board.map(row => [...row]);
    const piece = newBoard[fromRow][fromCol];
    
    // Handle promotion
    if (promotionPiece && piece && piece[1] === PIECE_TYPES.PAWN) {
      const color = piece[0];
      if ((color === COLORS.WHITE && toRow === 0) || (color === COLORS.BLACK && toRow === 7)) {
        newBoard[toRow][toCol] = color + promotionPiece;
        newBoard[fromRow][fromCol] = "";
        return newBoard;
      }
    }
    
    newBoard[toRow][toCol] = piece;
    newBoard[fromRow][fromCol] = "";
    
    return newBoard;
  }

  /**
   * Get pseudo-legal moves for a piece (not checking for king safety)
   */
  function getPseudoLegalMoves(board, fromRow, fromCol, gameState = {}) {
    const piece = parsePiece(board[fromRow][fromCol]);
    if (!piece) return [];

    const moves = [];
    const { color, type } = piece;

    switch (type) {
      case PIECE_TYPES.PAWN:
        addPawnMoves(board, fromRow, fromCol, color, moves, gameState);
        break;

      case PIECE_TYPES.KNIGHT:
        addKnightMoves(board, fromRow, fromCol, color, moves);
        break;

      case PIECE_TYPES.BISHOP:
        addSlidingMoves(board, fromRow, fromCol, color, [[-1, -1], [-1, 1], [1, -1], [1, 1]], moves);
        break;

      case PIECE_TYPES.ROOK:
        addSlidingMoves(board, fromRow, fromCol, color, [[-1, 0], [1, 0], [0, -1], [0, 1]], moves);
        break;

      case PIECE_TYPES.QUEEN:
        addSlidingMoves(board, fromRow, fromCol, color, [
          [-1, -1], [-1, 1], [1, -1], [1, 1],
          [-1, 0], [1, 0], [0, -1], [0, 1]
        ], moves);
        break;

      case PIECE_TYPES.KING:
        addKingMoves(board, fromRow, fromCol, color, moves, gameState);
        break;
    }

    return moves;
  }

  /**
   * Add pawn moves
   */
  function addPawnMoves(board, fromRow, fromCol, color, moves, gameState) {
    const direction = color === COLORS.WHITE ? -1 : 1;
    const startRow = color === COLORS.WHITE ? 6 : 1;
    const promotionRow = color === COLORS.WHITE ? 0 : 7;

    // Single push
    const oneStep = fromRow + direction;
    if (isValidSquare(oneStep, fromCol) && isEmpty(board, oneStep, fromCol)) {
      if (oneStep === promotionRow) {
        // Promotion moves
        ['q', 'r', 'b', 'n'].forEach(promoteTo => {
          moves.push({ row: oneStep, col: fromCol, promotion: promoteTo });
        });
      } else {
        moves.push({ row: oneStep, col: fromCol });
      }

      // Double push from starting position
      if (fromRow === startRow) {
        const twoStep = fromRow + 2 * direction;
        if (isEmpty(board, twoStep, fromCol)) {
          moves.push({ row: twoStep, col: fromCol, isDoublePush: true });
        }
      }
    }

    // Captures
    for (const dc of [-1, 1]) {
      const captureCol = fromCol + dc;
      if (isValidSquare(oneStep, captureCol)) {
        // Regular capture
        if (isEnemyPiece(board, oneStep, captureCol, color)) {
          if (oneStep === promotionRow) {
            ['q', 'r', 'b', 'n'].forEach(promoteTo => {
              moves.push({ row: oneStep, col: captureCol, isCapture: true, promotion: promoteTo });
            });
          } else {
            moves.push({ row: oneStep, col: captureCol, isCapture: true });
          }
        }
        
        // En passant
        if (gameState.enPassantSquare && 
            gameState.enPassantSquare.row === oneStep && 
            gameState.enPassantSquare.col === captureCol) {
          moves.push({ 
            row: oneStep, 
            col: captureCol, 
            isCapture: true, 
            isEnPassant: true 
          });
        }
      }
    }
  }

  /**
   * Add knight moves
   */
  function addKnightMoves(board, fromRow, fromCol, color, moves) {
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];

    for (const [dr, dc] of knightOffsets) {
      const newRow = fromRow + dr;
      const newCol = fromCol + dc;
      if (canMoveTo(board, newRow, newCol, color)) {
        moves.push({ 
          row: newRow, 
          col: newCol, 
          isCapture: isEnemyPiece(board, newRow, newCol, color) 
        });
      }
    }
  }

  /**
   * Add sliding piece moves (bishop, rook, queen)
   */
  function addSlidingMoves(board, fromRow, fromCol, color, directions, moves) {
    for (const [dr, dc] of directions) {
      let row = fromRow + dr;
      let col = fromCol + dc;
      
      while (isValidSquare(row, col)) {
        if (isEmpty(board, row, col)) {
          moves.push({ row, col });
        } else if (isEnemyPiece(board, row, col, color)) {
          moves.push({ row, col, isCapture: true });
          break;
        } else {
          // Own piece, can't move further
          break;
        }
        
        row += dr;
        col += dc;
      }
    }
  }

  /**
   * Add king moves including castling
   */
  function addKingMoves(board, fromRow, fromCol, color, moves, gameState) {
    const kingOffsets = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1]
    ];

    // Regular king moves
    for (const [dr, dc] of kingOffsets) {
      const newRow = fromRow + dr;
      const newCol = fromCol + dc;
      if (canMoveTo(board, newRow, newCol, color)) {
        moves.push({ 
          row: newRow, 
          col: newCol, 
          isCapture: isEnemyPiece(board, newRow, newCol, color) 
        });
      }
    }

    // Castling
    if (gameState.castlingRights) {
      const rights = gameState.castlingRights[color];
      const row = color === COLORS.WHITE ? 7 : 0;
      const enemyColor = oppositeColor(color);
      
      // Can't castle while in check
      if (!isSquareAttacked(board, row, 4, enemyColor)) {
        // Kingside castling
        if (rights && rights.kingside) {
          if (isEmpty(board, row, 5) && isEmpty(board, row, 6)) {
            // Check if squares king passes through are not attacked
            if (!isSquareAttacked(board, row, 5, enemyColor) &&
                !isSquareAttacked(board, row, 6, enemyColor)) {
              moves.push({ row, col: 6, isCastling: 'kingside' });
            }
          }
        }
        
        // Queenside castling
        if (rights && rights.queenside) {
          if (isEmpty(board, row, 1) && isEmpty(board, row, 2) && isEmpty(board, row, 3)) {
            // Check if squares king passes through are not attacked
            if (!isSquareAttacked(board, row, 2, enemyColor) &&
                !isSquareAttacked(board, row, 3, enemyColor)) {
              moves.push({ row, col: 2, isCastling: 'queenside' });
            }
          }
        }
      }
    }
  }

  /**
   * Get all legal moves for a piece (checking king safety)
   */
  function getLegalMoves(board, fromRow, fromCol, gameState = {}) {
    const piece = parsePiece(board[fromRow][fromCol]);
    if (!piece) return [];

    const pseudoLegalMoves = getPseudoLegalMoves(board, fromRow, fromCol, gameState);
    const legalMoves = [];

    for (const move of pseudoLegalMoves) {
      // Make the move on a test board
      let testBoard = makeTestMove(board, fromRow, fromCol, move.row, move.col, move.promotion);
      
      // Handle en passant capture
      if (move.isEnPassant) {
        const capturedPawnRow = fromRow;
        testBoard[capturedPawnRow][move.col] = "";
      }
      
      // Handle castling - move the rook too
      if (move.isCastling) {
        const row = move.row;
        if (move.isCastling === 'kingside') {
          testBoard[row][5] = testBoard[row][7];
          testBoard[row][7] = "";
        } else {
          testBoard[row][3] = testBoard[row][0];
          testBoard[row][0] = "";
        }
      }

      // Check if king is in check after the move
      if (!isInCheck(testBoard, piece.color)) {
        legalMoves.push(move);
      }
    }

    return legalMoves;
  }

  /**
   * Check if a specific move is legal
   */
  function isMoveLegal(board, fromRow, fromCol, toRow, toCol, gameState = {}) {
    const legalMoves = getLegalMoves(board, fromRow, fromCol, gameState);
    return legalMoves.some(move => move.row === toRow && move.col === toCol);
  }

  /**
   * Check if a piece is pinned (moving it would expose king to check)
   */
  function isPiecePinned(board, row, col) {
    const piece = parsePiece(board[row][col]);
    if (!piece) return false;
    if (piece.type === PIECE_TYPES.KING) return false;

    const color = piece.color;
    
    // Temporarily remove the piece and check if king would be in check
    const testBoard = board.map(r => [...r]);
    testBoard[row][col] = "";
    
    return isInCheck(testBoard, color);
  }

  /**
   * Get all pieces of a given color
   */
  function getPieces(board, color) {
    const pieces = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece[0] === color) {
          pieces.push({ row, col, piece });
        }
      }
    }
    return pieces;
  }

  /**
   * Check if the game is in checkmate
   */
  function isCheckmate(board, color, gameState = {}) {
    if (!isInCheck(board, color)) return false;
    
    const pieces = getPieces(board, color);
    for (const { row, col } of pieces) {
      const moves = getLegalMoves(board, row, col, gameState);
      if (moves.length > 0) return false;
    }
    
    return true;
  }

  /**
   * Check if the game is in stalemate
   */
  function isStalemate(board, color, gameState = {}) {
    if (isInCheck(board, color)) return false;
    
    const pieces = getPieces(board, color);
    for (const { row, col } of pieces) {
      const moves = getLegalMoves(board, row, col, gameState);
      if (moves.length > 0) return false;
    }
    
    return true;
  }

  // Public API
  return {
    PIECE_TYPES,
    COLORS,
    parsePiece,
    createPiece,
    isValidSquare,
    oppositeColor,
    isEnemyPiece,
    isEmpty,
    canMoveTo,
    getAttackedSquares,
    findKing,
    isSquareAttacked,
    isInCheck,
    makeTestMove,
    getPseudoLegalMoves,
    getLegalMoves,
    isMoveLegal,
    isPiecePinned,
    getPieces,
    isCheckmate,
    isStalemate
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ChessRules = ChessRules;
}