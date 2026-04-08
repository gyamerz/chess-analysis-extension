# Chess Analysis Overlay - Firefox Extension

A powerful Firefox extension for Chess.com that provides manual move analysis, variation testing, and tactical insights without using any chess engine.

Version: 1.0.0 | Firefox Manifest V3 | MIT License

## Features

### Core Functionality
- Manual Analysis Mode - Test variations without affecting the real game
- Legal Move Validation - Only legal chess moves are allowed
- Turn-Based System - Automatically detects whose turn it is from Chess.com
- Move History - Full undo/redo support with move tracking
- Visual Overlay - Non-intrusive overlay that doesn't modify Chess.com's DOM

### Tactical Analysis
- Pin Detection - Highlights pieces that are pinned to the king
- Fork Opportunities - Shows squares where you can fork multiple pieces
- Hanging Pieces - Identifies undefended pieces
- Check Detection - Visual indicators when king is in check

### Visual Features
- Alpha Theme Pieces - Beautiful piece images from Chess.com's Alpha set
- Material Counter - Displays captured pieces with point advantage (Chess.com style)
- Draggable Control Panel - Position the controls anywhere on screen
- Smart Highlighting - Color-coded legal moves, captures, and tactical themes

### User Experience
- Keyboard Shortcuts - Quick access to common functions
- Intuitive Drag and Drop - Natural piece movement
- Position Memory - Control panel position persists across sessions
- Real-time Updates - Instant visual feedback on all actions

---

## Installation

### Manual Installation (Developer Mode)

1. Download the Extension
   - Clone or download this repository to your computer

2. Download Piece Images
   - Get the Alpha theme pieces from GiorgioMegrelli's chess.com-boards-and-pieces repository
   - Place them in the pieces/alpha/ folder
   - Required files: wP.png, wN.png, wB.png, wR.png, wQ.png, wK.png, bP.png, bN.png, bB.png, bR.png, bQ.png, bK.png

3. Load in Firefox
   - Open Firefox
   - Navigate to about:debugging
   - Click "This Firefox"
   - Click "Load Temporary Add-on..."
   - Select the manifest.json file from the extension folder

4. Start Analyzing
   - Go to Chess.com
   - Click the floating pawn button or press Alt+Shift+C

---

## Usage

### Activation
- Floating Button: Click the pawn icon that appears near the chess board
- Keyboard Shortcut: Press Alt+Shift+C

### Playing Moves
1. Click and drag any piece to move it
2. Legal moves are highlighted in green
3. Captures are shown with red circles
4. Only moves for the current turn are allowed

### Keyboard Shortcuts

| Key           | Action                          |
|---------------|--------------------------------|
| Alt+Shift+C   | Toggle extension on/off        |
| R             | Reset to current board position|
| Ctrl+Z        | Undo last move                 |
| Escape        | Close extension                |

### Control Panel
- Reset Button - Restore the original position from Chess.com
- Undo Button - Take back the last move
- Flip Button - (Coming soon) Flip board view
- Checkboxes - Toggle tactical highlights (Pins, Forks)

### Material Counter
- Shows captured pieces for both sides
- Displays point advantage (Chess.com standard)
- Point values: Pawn=1, Knight/Bishop=3, Rook=5, Queen=9
- Green badge shows which side is ahead

---

## Technical Details

### Architecture
