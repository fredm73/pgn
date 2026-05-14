// state.js
// ChessState: owns every piece of mutable application data.
// Depends on: constants.js (ChessConstants)
// changed 5/14/2026...

class ChessState {

  constructor() {
    // Completed games survive a "New Game" call; everything else resets.
    this.games = [];        // array of archived PGN strings
    this.flipped = false;   // board orientation survives new games too

    this._initGame();
  }

  // ── Private helper called by constructor and resetForNewGame ────────────

  _initGame() {
    this.board      = ChessConstants.cloneBoard(ChessConstants.INITIAL_BOARD);
    this.turn       = "white";   // "white" | "black"
    this.moveList   = [];        // e.g. ["1. e2-e4 e7-e5", "2. d2-d4"]
    this.moveNumber = 1;

    // Selection / preview — all null when no square is active
    this.selectedSource      = null; // { r, c, piece }
    this.selectedDestination = null; // { r, c }
    this.lastPreview         = null; // snapshot taken before a previewed move
                                     // { board, moveList, moveNumber, turn,
                                     //   source, capturedPiece }
    this.result              = "*";  // "*" | "1-0" | "0-1" | "1/2-1/2"
  }

  // ── Public API ───────────────────────────────────────────────────────────

  // Archive the current game's PGN (if non-empty) then reinitialise game
  // data.  Board orientation (flipped) and the games archive are preserved.
  resetForNewGame(currentPGN) {
    if (currentPGN && currentPGN.trim().length > 0 && this.moveList.length > 0) {
      this.games.push(currentPGN.trim());
    }
    this._initGame();
  }

  clearSelection() {
    this.selectedSource      = null;
    this.selectedDestination = null;
    this.lastPreview         = null;
  }
}
