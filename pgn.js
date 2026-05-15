// pgn.js
// PGNManager: PGN generation, clipboard copy, and email delivery.
// Depends on: state.js (ChessState)
// changed 5/15/2026...

class PGNManager {

  constructor(state, textareaId) {
    this.state    = state;
    this.textarea = document.getElementById(textareaId);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  // Builds the isolated PGN string for the current game only
  buildCurrentGamePGN() {
    const moves = this.state.moveList.join("\r\n");
    const result = this.state.result !== "*" ? "\r\n" + this.state.result : "";
    return this._header() + "\r\n\r\n" + moves + result;
  }

  // Rebuild the textarea to reflect all archived games plus the current game.
  updatePGN() {
    const currentGamePGN = this.buildCurrentGamePGN();
    
    // Only append the current game to the view if it has active moves
    const allGames = this.state.moveList.length > 0
      ? [...this.state.games, currentGamePGN.trim()]
      : [...this.state.games];

    // Separate distinct games by a double newline delimiter
    this.textarea.value = allGames.join("\r\n\r\n");
  }

  // Append the result token to the current PGN and update the textarea.
  appendResult(result) {
    this.state.result = result;
    this.updatePGN();
  }

  // Return one PGN string containing all archived games plus the current one.
  buildAllPGN() {
    this.updatePGN();
    return this.textarea.value;
  }

  copyPGN() {
    const pgn = this.buildAllPGN();
    if (!pgn) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pgn);
    } else {
      // Fallback for browsers without the Clipboard API
      const tmp = document.createElement("textarea");
      tmp.value = pgn;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      document.body.removeChild(tmp);
    }
  }

  // addresses — a pre-validated, comma-joined address string from ChessApp
  sendEmail(addresses) {
    if (!addresses) return;
    const pgn = this.buildAllPGN();
    if (!pgn) return;

    // Gmail requires percent-encoded CRLF to preserve line breaks
    const encodedBody = pgn
      .replace(/\r?\n/g, "\r\n")
      .replace(/\r\n/g,  "%0D%0A")
      .replace(/ /g,     "%20");

    window.location.href =
      "mailto:" + addresses +
      "?subject=Chess%20Game%20PGN" +
      "&body=" + encodedBody;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  _header() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `[Event "Casual Match"]\r\n[Site "Local App"]\r\n[Date "${yyyy}.${mm}.${dd}"]\r\n[Round "-"]\r\n[White "White"]\r\n[Black "Black"]\r\n[Result "${this.state.result}"]`;
  }
}