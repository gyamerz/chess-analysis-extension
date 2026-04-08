/**
 * Board Parser Module
 * Detects and parses Chess.com board positions from the DOM
 */

const BoardParser = (function() {
  'use strict';

  // Piece class mappings for Chess.com
  const PIECE_CLASS_MAP = {
    'wp': 'wp', 'wr': 'wr', 'wn': 'wn', 'wb': 'wb', 'wq': 'wq', 'wk': 'wk',
    'bp': 'bp', 'br': 'br', 'bn': 'bn', 'bb': 'bb', 'bq': 'bq', 'bk': 'bk'
  };

  // Board container selectors to try
  const BOARD_SELECTORS = [
    'chess-board',
    'wc-chess-board',
    '.board',
    '#board-single',
    '#board-play-computer',
    '#board-vs-personalities',
    '.board-layout-main .board',
    '[class*="board-"]',
  ];

  let boardElement = null;
  let boardObserver = null;
  let onBoardUpdateCallback = null;
  let lastBoardState = null;

  /**
   * Find the chess board element in the DOM
   */
  function findBoardElement() {
    for (const selector of BOARD_SELECTORS) {
      const element = document.querySelector(selector);
      if (element && hasPieces(element)) {
        return element;
      }
    }

    const allElements = document.querySelectorAll('[class*="piece"]');
    for (const el of allElements) {
      const parent = el.closest('[class*="board"]') || el.parentElement?.parentElement;
      if (parent && hasPieces(parent)) {
        return parent;
      }
    }

    return null;
  }

  /**
   * Check if an element contains chess pieces
   */
  function hasPieces(element) {
    const pieceElements = element.querySelectorAll('[class*="piece"]');
    return pieceElements.length > 0;
  }

  /**
   * Get the board dimensions and position
   */
  function getBoardDimensions() {
    if (!boardElement) return null;

    const rect = boardElement.getBoundingClientRect();
    const squareSize = rect.width / 8;

    return {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
      squareSize
    };
  }

  /**
   * Parse the square coordinate from Chess.com's class naming
   */
  function parseSquareClass(className) {
    const match = className.match(/square-(\d)(\d)/);
    if (!match) return null;

    const col = parseInt(match[1]) - 1;
    const row = 8 - parseInt(match[2]);

    return { row, col };
  }

  /**
   * Parse piece type from Chess.com's class naming
   */
  function parsePieceClass(className) {
    for (const [key, value] of Object.entries(PIECE_CLASS_MAP)) {
      if (className.includes(key) || className.includes(` ${key}`) || className.includes(`${key} `)) {
        const classes = className.split(/\s+/);
        if (classes.includes(key)) {
          return value;
        }
      }
    }

    const classes = className.split(/\s+/);
    let color = null;
    let type = null;

    for (const cls of classes) {
      if (cls === 'w' || cls === 'white') color = 'w';
      if (cls === 'b' || cls === 'black') color = 'b';
      if (cls === 'p' || cls === 'pawn') type = 'p';
      if (cls === 'n' || cls === 'knight') type = 'n';
      if (cls === 'b' || cls === 'bishop') type = 'b';
      if (cls === 'r' || cls === 'rook') type = 'r';
      if (cls === 'q' || cls === 'queen') type = 'q';
      if (cls === 'k' || cls === 'king') type = 'k';
    }

    if (color && type) {
      return color + type;
    }

    return null;
  }

  /**
   * Parse the current board position from the DOM
   */
  function parseBoard() {
    if (!boardElement) {
      boardElement = findBoardElement();
    }

    if (!boardElement) {
      console.log("Chess Analysis: No board element found");
      return null;
    }

    const board = Array(8).fill(null).map(() => Array(8).fill(""));
    const pieceElements = boardElement.querySelectorAll('[class*="piece"]');

    for (const pieceEl of pieceElements) {
      const className = pieceEl.className;
      const square = parseSquareClass(className);
      if (!square) continue;

      const piece = parsePieceClass(className);
      if (!piece) continue;

      if (square.row >= 0 && square.row < 8 && square.col >= 0 && square.col < 8) {
        board[square.row][square.col] = piece;
      }
    }

    return board;
  }

  /**
   * Alternative parsing method using computed positions
   */
  function parseBoardByPosition() {
    if (!boardElement) {
      boardElement = findBoardElement();
    }

    if (!boardElement) return null;

    const board = Array(8).fill(null).map(() => Array(8).fill(""));
    const dimensions = getBoardDimensions();
    if (!dimensions) return null;

    const pieceElements = boardElement.querySelectorAll('[class*="piece"]');

    for (const pieceEl of pieceElements) {
      const className = pieceEl.className;
      const piece = parsePieceClass(className);
      if (!piece) continue;

      const style = window.getComputedStyle(pieceEl);
      const transform = style.transform;
      
      let x = 0, y = 0;
      
      if (transform && transform !== 'none') {
        const matrix = transform.match(/matrix\((.+)\)/);
        if (matrix) {
          const values = matrix[1].split(',').map(parseFloat);
          x = values[4] || 0;
          y = values[5] || 0;
        }
      }

      const col = Math.round(x / dimensions.squareSize);
      const row = Math.round(y / dimensions.squareSize);

      if (row >= 0 && row < 8 && col >= 0 && col < 8) {
        board[row][col] = piece;
      }
    }

    return board;
  }

  /**
   * Get the current board state
   */
  function getCurrentBoard() {
    let board = parseBoard();
    
    if (!board || board.flat().filter(p => p).length === 0) {
      board = parseBoardByPosition();
    }

    if (board) {
      const pieceCount = board.flat().filter(p => p).length;
      if (pieceCount >= 2 && pieceCount <= 32) {
        lastBoardState = board;
        return board;
      }
    }

    return lastBoardState || createEmptyBoard();
  }

  /**
   * Create an empty board
   */
  function createEmptyBoard() {
    return Array(8).fill(null).map(() => Array(8).fill(""));
  }

  /**
   * Create the starting position
   */
  function createStartingPosition() {
    return [
      ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
      ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
      ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"]
    ];
  }

  /**
   * Deep clone a board state
   */
  function cloneBoard(board) {
    return board.map(row => [...row]);
  }

  /**
   * Compare two board states
   */
  function boardsEqual(board1, board2) {
    if (!board1 || !board2) return false;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board1[row][col] !== board2[row][col]) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Start observing the board for changes
   */
  function startObserving(callback) {
    if (!boardElement) {
      boardElement = findBoardElement();
    }

    if (!boardElement) {
      console.log("Chess Analysis: Cannot start observing - no board found");
      return false;
    }

    onBoardUpdateCallback = callback;

    boardObserver = new MutationObserver((mutations) => {
      clearTimeout(boardObserver._debounceTimer);
      boardObserver._debounceTimer = setTimeout(() => {
        const newBoard = getCurrentBoard();
        if (newBoard && !boardsEqual(newBoard, lastBoardState)) {
          lastBoardState = newBoard;
          if (onBoardUpdateCallback) {
            onBoardUpdateCallback(newBoard);
          }
        }
      }, 50);
    });

    boardObserver.observe(boardElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'transform']
    });

    console.log("Chess Analysis: Board observation started");
    return true;
  }

  /**
   * Stop observing the board
   */
  function stopObserving() {
    if (boardObserver) {
      boardObserver.disconnect();
      boardObserver = null;
    }
    onBoardUpdateCallback = null;
    console.log("Chess Analysis: Board observation stopped");
  }

  /**
   * Convert array indices to chess notation
   */
  function toAlgebraic(row, col) {
    const files = 'abcdefgh';
    const ranks = '87654321';
    return files[col] + ranks[row];
  }

  /**
   * Convert chess notation to array indices
   */
  function fromAlgebraic(notation) {
    const files = 'abcdefgh';
    const ranks = '87654321';
    const col = files.indexOf(notation[0]);
    const row = ranks.indexOf(notation[1]);
    return { row, col };
  }

  /**
   * Check if board is flipped
   */
  function isBoardFlipped() {
    if (!boardElement) return false;
    
    const className = boardElement.className;
    if (className.includes('flipped')) return true;
    
    const coords = boardElement.querySelector('[class*="coord"]');
    if (coords) {
      const text = coords.textContent;
      if (text && text.includes('8') && coords.getBoundingClientRect().bottom > 
          boardElement.getBoundingClientRect().height / 2) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Refresh board element reference
   */
  function refresh() {
    boardElement = findBoardElement();
    return boardElement !== null;
  }

  /**
   * Detect whose turn it is from Chess.com's interface
   * Returns 'w' for white's turn, 'b' for black's turn
   */
  function detectTurnFromDOM() {
    // Method 1: Check the move list - count moves made
    const moveListContainer = document.querySelector('.move-list-container, .moves-container, .vertical-move-list, [class*="move-list"]');
    if (moveListContainer) {
      // Look for individual move nodes
      const moveNodes = moveListContainer.querySelectorAll('.move-text, .move, .node, [data-ply]');
      let moveCount = 0;
      
      moveNodes.forEach(node => {
        const text = node.textContent.trim();
        // Skip move numbers like "1." "2." etc
        if (text && !/^\d+\.?$/.test(text) && text.length > 0) {
          // Check if it looks like a chess move (contains letters and possibly numbers)
          if (/[a-hRNBQKO]/.test(text)) {
            moveCount++;
          }
        }
      });
      
      if (moveCount > 0) {
        // Odd number of moves = black's turn, even = white's turn
        const turn = moveCount % 2 === 0 ? 'w' : 'b';
        console.log("Chess Analysis: Detected turn from move list, moves:", moveCount, "turn:", turn);
        return turn;
      }
    }
    
    // Method 2: Check for highlighted/active clock
    const clockElements = document.querySelectorAll('[class*="clock"]');
    for (const clock of clockElements) {
      const classes = clock.className.toLowerCase();
      const isActive = classes.includes('active') || classes.includes('player-turn') || classes.includes('running');
      
      if (isActive) {
        if (classes.includes('white') || classes.includes('bottom')) {
          console.log("Chess Analysis: Detected white's turn from clock");
          return 'w';
        }
        if (classes.includes('black') || classes.includes('top')) {
          console.log("Chess Analysis: Detected black's turn from clock");
          return 'b';
        }
      }
    }
    
    // Method 3: Check for data attributes on game container
    const gameContainer = document.querySelector('[data-turn], [data-side-to-move]');
    if (gameContainer) {
      const turn = gameContainer.getAttribute('data-turn') || gameContainer.getAttribute('data-side-to-move');
      if (turn) {
        const normalizedTurn = turn.toLowerCase().startsWith('w') ? 'w' : 'b';
        console.log("Chess Analysis: Detected turn from data attribute:", normalizedTurn);
        return normalizedTurn;
      }
    }
    
    // Method 4: Check if there are any highlighted last-move squares
    const highlights = document.querySelectorAll('.highlight, [class*="highlight"], .last-move, [class*="last-move"]');
    if (highlights.length === 0) {
      // No moves made yet, must be white's turn
      console.log("Chess Analysis: No moves detected, defaulting to white");
      return 'w';
    }
    
    // Method 5: Check the move list for the last move color
    const allMoveElements = document.querySelectorAll('.white-node, .black-node, .white-move, .black-move');
    if (allMoveElements.length > 0) {
      const lastMove = allMoveElements[allMoveElements.length - 1];
      const classes = lastMove.className.toLowerCase();
      
      if (classes.includes('white')) {
        console.log("Chess Analysis: Last move was white, black's turn");
        return 'b';
      }
      if (classes.includes('black')) {
        console.log("Chess Analysis: Last move was black, white's turn");
        return 'w';
      }
    }
    
    // Method 6: Look at the move list text content
    const moveListText = document.querySelector('.move-list, .moves')?.textContent || '';
    const moves = moveListText.match(/[a-h][1-8]|[RNBQK][a-h]?[1-8]?x?[a-h][1-8]|O-O-O|O-O/g);
    if (moves && moves.length > 0) {
      const turn = moves.length % 2 === 0 ? 'w' : 'b';
      console.log("Chess Analysis: Detected turn from move text, moves:", moves.length, "turn:", turn);
      return turn;
    }
    
    // Default to white
    console.log("Chess Analysis: Could not detect turn, defaulting to white");
    return 'w';
  }

  // Public API
  return {
    findBoardElement,
    getBoardDimensions,
    parseBoard,
    parseBoardByPosition,
    getCurrentBoard,
    createEmptyBoard,
    createStartingPosition,
    cloneBoard,
    boardsEqual,
    startObserving,
    stopObserving,
    toAlgebraic,
    fromAlgebraic,
    isBoardFlipped,
    refresh,
    detectTurnFromDOM,
    get boardElement() { return boardElement; },
    get lastBoardState() { return lastBoardState; }
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.BoardParser = BoardParser;
}