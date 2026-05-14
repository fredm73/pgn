// game.js
// ChessApp: constructs and wires all objects; exposes the button API.
// Depends on: constants.js, state.js, board.js, pgn.js, moves.js
//
// A single global `app` instance is created inside window.onload so that
// all DOM elements exist before the constructors try to find them.
// By the time any button can be clicked, `app` is fully initialised.
// updated on 5/14/2026

class ChessApp {

  constructor() {
    this.state    = new ChessState();
    this.renderer = new BoardRenderer(this.state, "board");
    this.pgn      = new PGNManager(this.state, "moves");
    this.moves    = new MoveHandler(this.state, this.renderer, this.pgn);

    // Inject the click handler now that MoveHandler exists.
    // BoardRenderer stored a null placeholder so it could be loaded first.
    this.renderer.onSquareClick = (r, c) => this.moves.handleClick(r, c);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init() {
    this.pgn.updatePGN();
    this.renderer.draw();
  }

  // ── Button handlers (called directly from HTML onclick attributes) ────────

  newGame() {
    // If moves have been made (and no result recorded yet), ask for the result
    if (this.state.moveList.length > 0 && this.state.result === "*") {
      document.getElementById("resultOverlay").classList.add("open");
      return;
    }
    this._startNewGame();
  }

  // Called by result dialog buttons: result is "1-0", "0-1", or "1/2-1/2"
  finishGame(result) {
    document.getElementById("resultOverlay").classList.remove("open");
    this.pgn.appendResult(result);   // writes result into current PGN
    this._startNewGame();
  }

  _startNewGame() {
    this.pgn.updatePGN();
    this.state.resetForNewGame(this.pgn.textarea.value);
    this.pgn.updatePGN();
    this.renderer.draw();
  }

  flipBoard() {
    this.state.flipped = !this.state.flipped;
    this.renderer.draw();
  }

  copyPGN() {
    this.pgn.copyPGN();
  }

  sendEmail() {
    const raw       = document.getElementById("emailInput").value;
    const addresses = raw.split(",")
                         .map(a => a.trim())
                         .filter(a => a.length > 0)
                         .join(",");
    this.pgn.sendEmail(addresses);
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
// Assign to window so onclick="app.newGame()" etc. resolve correctly.
window.onload = () => {
  window.app = new ChessApp();
  app.init();
};
