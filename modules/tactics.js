/**
 * Tactics Module
 * Detects pins, forks, and other tactical opportunities
 */

const Tactics = (function() {
  'use strict';

  /**
   * Find all pinned pieces for a given color
   * Returns array of { row, col, pinnedBy, pinnedTo }
   */
  function findPinnedPieces(board, color) {
    const pinnedPieces = [];
    const kingPos = ChessRules.findKing(board, color);
    
    if (!kingPos) return pinnedPieces;

    const enemyColor = ChessRules.oppositeColor(color);
    
    // Directions for sliding pieces
    const directions = [
      { dr: -1, dc: 0, types: ['r', 'q'] },  // Up
      { dr: 1, dc: 0, types: ['r', 'q'] },   // Down
      { dr: 0, dc: -1, types: ['r', 'q'] },  // Left
      { dr: 0, dc: 1, types: ['r', 'q'] },   // Right
      { dr: -1, dc: -1, types: ['b', 'q'] }, // Up-Left
      { dr: -1, dc: 1, types: ['b', 'q'] },  // Up-Right
      { dr: 1, dc: -1, types: ['b', 'q'] },  // Down-Left
      { dr: 1, dc: 1, types: ['b', 'q'] }    // Down-Right
    ];

    for (const dir of directions) {
      let foundOwnPiece = null;
      let row = kingPos.row + dir.dr;
      let col = kingPos.col + dir.dc;

      while (ChessRules.isValidSquare(row, col)) {
        const piece = board[row][col];
        
        if (piece) {
          const pieceInfo = ChessRules.parsePiece(piece);
          
          if (pieceInfo.color === color) {
            // Found our own piece
            if (foundOwnPiece) {
              // Second own piece in this direction - no pin possible
              break;
            }
            foundOwnPiece = { row, col, piece };
          } else {
            // Found enemy piece
            if (foundOwnPiece && dir.types.includes(pieceInfo.type)) {
              // This enemy piece pins our piece
              pinnedPieces.push({
                row: foundOwnPiece.row,
                col: foundOwnPiece.col,
                piece: foundOwnPiece.piece,
                pinnedBy: { row, col, piece },
                pinnedTo: kingPos,
                direction: dir
              });
            }
            break;
          }
        }
        
        row += dir.dr;
        col += dir.dc;
      }
    }

    return pinnedPieces;
  }

  /**
   * Find all fork opportunities for a given color
   * A fork is when a piece can attack two or more enemy pieces
   */
  function findForkOpportunities(board, color, gameState = {}) {
    const forks = [];
    const enemyColor = ChessRules.oppositeColor(color);

    // Get all our pieces
    const ourPieces = ChessRules.getPieces(board, color);

    for (const { row, col, piece } of ourPieces) {
      // Get legal moves for this piece
      const legalMoves = ChessRules.getLegalMoves(board, row, col, gameState);

      for (const move of legalMoves) {
        // Simulate the move
        const testBoard = ChessRules.makeTestMove(board, row, col, move.row, move.col);
        
        // Get squares this piece would attack from the new position
        const attackedSquares = ChessRules.getAttackedSquares(testBoard, move.row, move.col);
        
        // Count valuable enemy pieces attacked
        const attackedEnemies = [];
        
        for (const attack of attackedSquares) {
          const targetPiece = testBoard[attack.row][attack.col];
          if (targetPiece && targetPiece[0] === enemyColor) {
            const targetType = targetPiece[1];
            // Consider valuable targets: King, Queen, Rook, or hanging pieces
            attackedEnemies.push({
              row: attack.row,
              col: attack.col,
              piece: targetPiece,
              value: getPieceValue(targetType)
            });
          }
        }

        // A fork needs to attack at least 2 pieces
        if (attackedEnemies.length >= 2) {
          // Calculate total value of fork
          const totalValue = attackedEnemies.reduce((sum, p) => sum + p.value, 0);
          
          forks.push({
            fromRow: row,
            fromCol: col,
            toRow: move.row,
            toCol: move.col,
            piece,
            attackedPieces: attackedEnemies,
            totalValue,
            isFork: true
          });
        }
      }
    }

    // Sort by total value (highest first)
    forks.sort((a, b) => b.totalValue - a.totalValue);

    return forks;
  }

  /**
   * Get relative piece value for fork prioritization
   */
  function getPieceValue(type) {
    const values = {
      'k': 1000, // King (always important in fork)
      'q': 9,
      'r': 5,
      'b': 3,
      'n': 3,
      'p': 1
    };
    return values[type] || 0;
  }

  /**
   * Find discovered attack opportunities
   */
  function findDiscoveredAttacks(board, color, gameState = {}) {
    const discoveries = [];
    const enemyColor = ChessRules.oppositeColor(color);

    // Get all our pieces
    const ourPieces = ChessRules.getPieces(board, color);

    for (const { row, col, piece } of ourPieces) {
      const pieceInfo = ChessRules.parsePiece(piece);
      
      // Skip sliding pieces (they can't create discoveries by themselves)
      if (['b', 'r', 'q'].includes(pieceInfo.type)) continue;

      // Check if moving this piece would reveal an attack
      const legalMoves = ChessRules.getLegalMoves(board, row, col, gameState);

      for (const move of legalMoves) {
        // Simulate the move
        const testBoard = ChessRules.makeTestMove(board, row, col, move.row, move.col);
        
        // Check if any of our sliding pieces now attack enemy pieces
        for (const slider of ourPieces) {
          if (slider.row === row && slider.col === col) continue;
          
          const sliderInfo = ChessRules.parsePiece(slider.piece);
          if (!['b', 'r', 'q'].includes(sliderInfo.type)) continue;

          // Check attacks before and after the move
          const attacksBefore = ChessRules.getAttackedSquares(board, slider.row, slider.col);
          const attacksAfter = ChessRules.getAttackedSquares(testBoard, slider.row, slider.col);

          // Find new attacks on enemy pieces
          for (const attack of attacksAfter) {
            const targetPiece = testBoard[attack.row][attack.col];
            if (targetPiece && targetPiece[0] === enemyColor) {
              // Was this square attacked before?
              const wasAttackedBefore = attacksBefore.some(a => 
                a.row === attack.row && a.col === attack.col
              );

              if (!wasAttackedBefore) {
                discoveries.push({
                  movingPiece: { row, col, piece },
                  moveTarget: { row: move.row, col: move.col },
                  revealingPiece: slider,
                  attackedPiece: { row: attack.row, col: attack.col, piece: targetPiece }
                });
              }
            }
          }
        }
      }
    }

    return discoveries;
  }

  /**
   * Check if a piece is hanging (undefended and can be captured)
   */
  function findHangingPieces(board, color) {
    const hanging = [];
    const enemyColor = ChessRules.oppositeColor(color);
    
    // Get all enemy pieces
    const enemyPieces = ChessRules.getPieces(board, enemyColor);

    for (const { row, col, piece } of enemyPieces) {
      // Is this piece attacked by us?
      const isAttacked = ChessRules.isSquareAttacked(board, row, col, color);
      
      if (isAttacked) {
        // Is it defended?
        const isDefended = ChessRules.isSquareAttacked(board, row, col, enemyColor);
        
        if (!isDefended) {
          hanging.push({ row, col, piece, value: getPieceValue(piece[1]) });
        }
      }
    }

    // Sort by value (highest first)
    hanging.sort((a, b) => b.value - a.value);

    return hanging;
  }

  /**
   * Get all tactical highlights for current position
   */
  function analyzePosition(board, colorToMove, gameState = {}) {
    const analysis = {
      pins: {
        white: findPinnedPieces(board, 'w'),
        black: findPinnedPieces(board, 'b')
      },
      forks: findForkOpportunities(board, colorToMove, gameState),
      hangingPieces: {
        white: findHangingPieces(board, 'b'), // Pieces white can capture
        black: findHangingPieces(board, 'w')  // Pieces black can capture
      },
      inCheck: {
        white: ChessRules.isInCheck(board, 'w'),
        black: ChessRules.isInCheck(board, 'b')
      }
    };

    return analysis;
  }

  /**
   * Get highlight data for rendering
   */
  function getTacticalHighlights(board, colorToMove, gameState = {}) {
    const highlights = [];
    const analysis = analyzePosition(board, colorToMove, gameState);

    // Add pin highlights (orange)
    for (const pin of [...analysis.pins.white, ...analysis.pins.black]) {
      highlights.push({
        type: 'pin',
        row: pin.row,
        col: pin.col,
        color: 'orange',
        data: pin
      });
    }

    // Add fork opportunities (purple) - only show top 3
    for (const fork of analysis.forks.slice(0, 3)) {
      highlights.push({
        type: 'fork',
        row: fork.toRow,
        col: fork.toCol,
        color: 'purple',
        data: fork
      });
    }

    // Add hanging pieces (red outline)
    const myHanging = colorToMove === 'w' ? 
      analysis.hangingPieces.black : 
      analysis.hangingPieces.white;
    
    for (const piece of myHanging) {
      highlights.push({
        type: 'hanging',
        row: piece.row,
        col: piece.col,
        color: 'red',
        data: piece
      });
    }

    // Add check highlight
    if (analysis.inCheck.white) {
      const kingPos = ChessRules.findKing(board, 'w');
      if (kingPos) {
        highlights.push({
          type: 'check',
          row: kingPos.row,
          col: kingPos.col,
          color: 'red',
          data: { color: 'w' }
        });
      }
    }
    if (analysis.inCheck.black) {
      const kingPos = ChessRules.findKing(board, 'b');
      if (kingPos) {
        highlights.push({
          type: 'check',
          row: kingPos.row,
          col: kingPos.col,
          color: 'red',
          data: { color: 'b' }
        });
      }
    }

    return highlights;
  }

  // Public API
  return {
    findPinnedPieces,
    findForkOpportunities,
    findDiscoveredAttacks,
    findHangingPieces,
    analyzePosition,
    getTacticalHighlights,
    getPieceValue
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.Tactics = Tactics;
}