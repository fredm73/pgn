// moves.js
// MoveHandler: click handling, move preview / undo, and move recording.
// Depends on: constants.js (ChessConstants),
//             state.js     (ChessState),
//             board.js     (BoardRenderer),
//             pgn.js       (PGNManager)

class MoveHandler {

  constructor(state, renderer, pgn) {
    this.state    = state;
    this.renderer = renderer;
    this.pgn      = pgn;
  }

  // ── Public API (wired to BoardRenderer.onSquareClick by ChessApp) ─────────

  handleClick(r, c) {
    const s = this.state;

    // ── Case 1: Nothing selected yet — pick a piece ──────────────────────
    if (!s.selectedSource) {
      this._trySelectSource(r, c);
      return;
    }

    // ── Case 2: Source chosen — pick a destination ───────────────────────
    if (!s.selectedDestination) {
      this._trySelectDestination(r, c);
      return;
    }

    // ── Case 3: Preview active — either undo or commit and re-click ──────
    this._handlePreviewClick(r, c);
  }

  // ── Private: case handlers ────────────────────────────────────────────────

  _trySelectSource(r, c) {
    const s     = this.state;
    const piece = s.board[r][c];

    if (piece === ".") return;
    if (s.turn === "white" && piece !== piece.toUpperCase()) return;
    if (s.turn === "black" && piece !== piece.toLowerCase()) return;

    s.selectedSource      = { r, c, piece };
    s.selectedDestination = null;
    s.lastPreview         = null;
    this.renderer.draw();
  }

  _trySelectDestination(r, c) {
    const s           = this.state;
    const targetPiece = s.board[r][c];

    // Reject landing on a same-colour piece
    if (targetPiece !== ".") {
      const movingIsWhite = s.selectedSource.piece === s.selectedSource.piece.toUpperCase();
      const targetIsWhite = targetPiece === targetPiece.toUpperCase();
      if (movingIsWhite === targetIsWhite) {
        this.renderer.draw();
        return;
      }
    }

    s.selectedDestination = { r, c };
    this._previewMove(s.selectedSource, { r, c });
  }

  _handlePreviewClick(r, c) {
    const s     = this.state;
    const piece = s.board[r][c];

    // Clicked the destination again → undo the preview
    if (r === s.selectedDestination.r && c === s.selectedDestination.c) {
      this._undoPreview();
      return;
    }

    // Clicked a same-side piece while preview is active → ignore
    if (piece !== ".") {
      const clickedIsWhite = piece === piece.toUpperCase();
      const sourceIsWhite  = s.selectedSource.piece === s.selectedSource.piece.toUpperCase();
      if (clickedIsWhite === sourceIsWhite) {
        this.renderer.draw();
        return;
      }
    }

    // Any other square → commit the previewed move; start a fresh selection
    s.clearSelection();
    this.renderer.draw();
    this.handleClick(r, c);
  }

  // ── Private: preview / undo ───────────────────────────────────────────────

  _previewMove(from, to) {
    const s             = this.state;
    const capturedPiece = s.board[to.r][to.c];

    // Snapshot the full state so _undoPreview can restore it exactly
    s.lastPreview = {
      board:         ChessConstants.cloneBoard(s.board),
      moveList:      s.moveList.slice(),
      moveNumber:    s.moveNumber,
      turn:          s.turn,
      source:        { ...from },
      capturedPiece
    };

    // Apply the move on the board
    s.board[to.r]   = ChessConstants.replaceChar(s.board[to.r],   to.c,   from.piece);
    s.board[from.r] = ChessConstants.replaceChar(s.board[from.r], from.c, ".");

    this._recordMove(from, to); // also advances turn / moveNumber

    s.selectedDestination = { r: to.r, c: to.c };
    this.renderer.draw();
  }

  _undoPreview() {
    const s = this.state;
    if (!s.lastPreview) return;

    s.board      = ChessConstants.cloneBoard(s.lastPreview.board);
    s.moveList   = s.lastPreview.moveList.slice();
    s.moveNumber = s.lastPreview.moveNumber;
    s.turn       = s.lastPreview.turn;

    s.selectedSource      = { ...s.lastPreview.source };
    s.selectedDestination = null;
    s.lastPreview         = null;

    this.pgn.updatePGN();
    this.renderer.draw();
  }

  // ── Private: notation ─────────────────────────────────────────────────────

  _recordMove(from, to) {
    const s   = this.state;
    const sep = (s.lastPreview?.capturedPiece &&
                 s.lastPreview.capturedPiece !== ".") ? "x" : "-";

    const notation =
      ChessConstants.FILES[from.c] + ChessConstants.RANKS[from.r] + sep +
      ChessConstants.FILES[to.c]   + ChessConstants.RANKS[to.r];

    if (s.turn === "white") {
      s.moveList.push(s.moveNumber + ". " + notation);
    } else {
      s.moveList[s.moveList.length - 1] += " " + notation;
      s.moveNumber++;
    }

    s.turn = (s.turn === "white") ? "black" : "white";

    this.pgn.updatePGN();
  }
}
