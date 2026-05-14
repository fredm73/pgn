// constants.js
// ChessConstants: all static, no instantiation needed.
// No dependency on any other project file.
// changed 5/14/2026

class ChessConstants {

  // Maps piece character to SVG filename stem
  static PIECES = {
    'r': 'bR', 'n': 'bN', 'b': 'bB', 'q': 'bQ', 'k': 'bK', 'p': 'bP',
    'R': 'wR', 'N': 'wN', 'B': 'wB', 'Q': 'wQ', 'K': 'wK', 'P': 'wP'
  };

  // File letters a–h (index = board column 0–7)
  static FILES = "abcdefgh";

  // Rank chars where index 0 = rank 8 (top row), index 7 = rank 1 (bottom row).
  // Used as RANKS[boardRow] for both move notation and coordinate labels.
  static RANKS = "87654321";

  static INITIAL_BOARD = [
    "rnbqkbnr",
    "pppppppp",
    "........",
    "........",
    "........",
    "........",
    "PPPPPPPP",
    "RNBQKBNR"
  ];

  // Returns the SVG path for a piece character, or null if the square is empty.
  static pieceToSrc(ch) {
    const key = ChessConstants.PIECES[ch];
    return key ? "pieces/" + key + ".svg" : null;
  }

  // Shallow-clone a board (array of strings; strings themselves are immutable).
  static cloneBoard(b) {
    return b.slice();
  }

  // Return a new string with the character at idx replaced by chr.
  static replaceChar(str, idx, chr) {
    return str.substring(0, idx) + chr + str.substring(idx + 1);
  }
}
