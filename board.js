// board.js
// BoardRenderer: responsible only for drawing the chessboard in the DOM.
// Depends on: constants.js (ChessConstants), state.js (ChessState)
//
// The click handler is intentionally decoupled: ChessApp sets
// this.onSquareClick after constructing both BoardRenderer and MoveHandler,
// avoiding a forward-dependency on moves.js.
// changed 5/14/2026...

class BoardRenderer {

  constructor(state, boardDivId) {
    this.state       = state;
    this.boardDiv    = document.getElementById(boardDivId);
    this.onSquareClick = null; // (boardRow, boardCol) => void  — set by ChessApp
  }

  // ── Public API ────────────────────────────────────────────────────────────

  draw() {
    this.boardDiv.innerHTML = "";

    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        const sq = this._createSquare(displayRow, displayCol);
        this.boardDiv.appendChild(sq);
      }
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  // Map a display cell (displayRow, displayCol) to the logical board
  // (boardRow, boardCol), honouring the flip flag.
  _displayToBoard(displayRow, displayCol) {
    return this.state.flipped
      ? { br: 7 - displayRow, bc: 7 - displayCol }
      : { br: displayRow,     bc: displayCol      };
  }

  _createSquare(displayRow, displayCol) {
    const { br, bc } = this._displayToBoard(displayRow, displayCol);
    const isLight     = (displayRow + displayCol) % 2 === 0;

    const sq = document.createElement("div");
    sq.className = "square " + (isLight ? "light" : "dark");

    // Piece image
    const piece = this.state.board[br][bc];
    if (piece !== ".") {
      const img = document.createElement("img");
      img.className = "piece-img";
      img.src = ChessConstants.pieceToSrc(piece);
      sq.appendChild(img);
    }

    // Coordinate label (always reflects the logical square)
    const coordSpan = document.createElement("div");
    coordSpan.className   = "coord";
    coordSpan.textContent = ChessConstants.FILES[bc] + ChessConstants.RANKS[br];
    sq.appendChild(coordSpan);

    // Highlight source square
    const sel = this.state.selectedSource;
    if (sel && br === sel.r && bc === sel.c) {
      sq.classList.add("source-selected");
    }

    // Highlight destination square
    const dest = this.state.selectedDestination;
    if (dest && br === dest.r && bc === dest.c) {
      sq.classList.add("dest-selected");
    }

    // Click routing — resolved at runtime so moves.js need not be loaded yet
    sq.onclick = () => this.onSquareClick && this.onSquareClick(br, bc);

    return sq;
  }
}
