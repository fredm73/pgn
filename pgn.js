// pgn.js
// PGNManager: PGN generation, clipboard copy, and email delivery.
// Depends on: state.js (ChessState)
// updated 5/14/2026

class PGNManager {

  constructor(state, textareaId) {
    this.state    = state;
    this.textarea = document.getElementById(textareaId);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  // Rebuild the textarea from current state.
  updatePGN() {
    this.textarea.value = this._header() + "\r\n\r\n" +
                          this.state.moveList.join("\r\n");
  }

  // Return one PGN string containing all archived games plus the current one.
  buildAllPGN() {
    this.updatePGN();
    const currentPGN = this.textarea.value.trim();

    const all = currentPGN.length > 0
      ? [...this.state.games, currentPGN]
      : [...this.state.games];

    return all.join(
      "\r\n\r\n----------------------------------------\r\n\r\n"
    );
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
    const d    = new Date();
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const dd   = String(d.getDate()).padStart(2, "0");

    return [
      `[Date "${yyyy}.${mm}.${dd}"]`,
      `[White " "]`,
      `[Black " "]`,
      `[Result "1/2-1/2"]`
    ].join("\r\n");
  }
}
