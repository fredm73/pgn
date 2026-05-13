// state.js
// ChessState: owns every piece of mutable application data.
// Depends on: constants.js (ChessConstants)

class ChessState {

  constructor() {
    // Completed games survive a "New Game" call; everything else resets.
    this.games   = [];      // array of archived PGN strings
    this.flipped = false;   // board orientation survives new games too

    this._initGame();
  }

  // ── Private helper called by constructor and resetForNewGame ─────────────

  _initGame() {
    this.board      = ChessConstants.cloneBoard(ChessConstants.INITIAL_BOARD);
    this.turn       = "white";   // "white" | "black"
    this.moveList   = [];        // e.g. ["1. e2-e4 e7-e5", "2. d2-d4"]
    this.moveNumber = 1;

    // Castling availability — four independent flags.
    // Set to false the moment the relevant king or rook first moves.
    this.castling = { wK: true, wQ: true, bK: true, bQ: true };

    // Square behind a pawn that just made a double push, or null.
    // Stored as { r, c } in board coordinates.
    this.enPassantTarget = null;

    // Selection / preview — all null when no square is active
    this.selectedSource      = null; // { r, c, piece }
    this.selectedDestination = null; // { r, c }
    this.lastPreview         = null; // full snapshot before a previewed move

    // Extra squares to highlight after a castling preview:
    // { rookFrom:{r,c}, rookTo:{r,c} } or null
    this.castlingHighlights = null;

    // Flag: promotion is pending (dialog shown, waiting for user choice)
    this.promotionPending = false;
  }

  // ── Public API ────────────────────────────────────────────────────────────

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
    this.castlingHighlights  = null;
    this.promotionPending    = false;
  }
}
