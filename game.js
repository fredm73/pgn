// game.js
// ChessApp: constructs and wires all objects; exposes the button API.
// Depends on: constants.js, state.js, board.js, pgn.js, moves.js

class ChessApp {

  constructor() {
    this.state    = new ChessState();
    this.renderer = new BoardRenderer(this.state, "board");
    this.pgn      = new PGNManager(this.state, "moves");
    this.moves    = new MoveHandler(this.state, this.renderer, this.pgn);

    // Inject the click handler now that MoveHandler exists.
    this.renderer.onSquareClick = (r, c) => this.moves.handleClick(r, c);

    // Track the deferred action when the results overlay intercepts a button press
    this.pendingAction = null; 
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init() {
    this.pgn.updatePGN();
    this.renderer.draw();
    this.promptPlayerNames();
  }

  // ── Button handlers (called directly from HTML onclick attributes) ────────

  newGame() {
    if (this.state.moveList.length > 0 && this.state.result === "*") {
      this.pendingAction = "new";
      document.getElementById("resultOverlay").classList.add("open");
      return;
    }
    this._startNewGame();
  }

  // Called by result dialog buttons: result is "1-0", "0-1", or "1/2-1/2"
  finishGame(result) {
    document.getElementById("resultOverlay").classList.remove("open");
    
    // Save the result to the current game state and refresh the PGN view
    this.state.result = result;
    this.pgn.updatePGN();
    
    // Process deferred requests if the dialog was triggered by Copy, Send, or New buttons
    const action = this.pendingAction;
    this.pendingAction = null;

    if (action === "copy") {
      this.pgn.copyPGN();
    } else if (action === "send") {
      this._executeSendEmail();
    } else if (action === "new") {
      this._startNewGame();
    }
  }

  _startNewGame() {
    // Isolate the current un-flagged game string to push into archives
    const completedPGN = this.pgn.buildCurrentGamePGN();
    this.state.resetForNewGame(completedPGN);
    
    this.promptPlayerNames();
  }

  promptPlayerNames() {
    document.getElementById("whiteInput").value = "White";
    document.getElementById("blackInput").value = "Black";
    document.getElementById("namesOverlay").classList.add("open");
  }

  submitPlayerNames() {
    const whiteName = document.getElementById("whiteInput").value.trim();
    const blackName = document.getElementById("blackInput").value.trim();

    this.state.whitePlayer = whiteName || "White";
    this.state.blackPlayer = blackName || "Black";

    document.getElementById("namesOverlay").classList.remove("open");
    
    this.pgn.updatePGN();
    this.renderer.draw();
  }

  flipBoard() {
    this.state.flipped = !this.state.flipped;
    this.renderer.draw();
  }

  copyPGN() {
    if (this.state.moveList.length > 0 && this.state.result === "*") {
      this.pendingAction = "copy";
      document.getElementById("resultOverlay").classList.add("open");
      return;
    }
    this.pgn.copyPGN();
  }

  sendEmail() {
    if (this.state.moveList.length > 0 && this.state.result === "*") {
      this.pendingAction = "send";
      document.getElementById("resultOverlay").classList.add("open");
      return;
    }
    this._executeSendEmail();
  }

  _executeSendEmail() {
    const raw       = document.getElementById("emailInput").value;
    const addresses = raw.split(",")
                         .map(a => a.trim())
                         .filter(a => a.length > 0)
                         .join(",");
    this.pgn.sendEmail(addresses);
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
window.onload = () => {
  window.app = new ChessApp();
  app.init();
};