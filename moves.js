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

    // Block all clicks while a promotion dialog is open
    if (s.promotionPending) return;

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

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION A — Click-state machine
  // ══════════════════════════════════════════════════════════════════════════

  _trySelectSource(r, c) {
    const s     = this.state;
    const piece = s.board[r][c];

    if (piece === ".") return;
    if (s.turn === "white" && piece !== piece.toUpperCase()) return;
    if (s.turn === "black" && piece !== piece.toLowerCase()) return;

    s.selectedSource      = { r, c, piece };
    s.selectedDestination = null;
    s.lastPreview         = null;
    s.castlingHighlights  = null;
    this.renderer.draw();
  }

  _trySelectDestination(r, c) {
    const s    = this.state;
    const from = s.selectedSource;

    // Re-clicking the source square deselects it
    if (r === from.r && c === from.c) {
      s.selectedSource = null;
      this.renderer.draw();
      return;
    }

    // Validate legality — silent ignore on failure
    if (!this._isLegalMove(s.board, from.r, from.c, r, c, s)) return;

    s.selectedDestination = { r, c };
    this._previewMove(from, { r, c });
  }

  _handlePreviewClick(r, c) {
    const s     = this.state;
    const piece = s.board[r][c];

    // Clicking the king's destination square → undo
    if (r === s.selectedDestination.r && c === s.selectedDestination.c) {
      this._undoPreview();
      return;
    }

    // Clicking either castling-rook square → undo
    const ch = s.castlingHighlights;
    if (ch &&
        ((r === ch.rookFrom.r && c === ch.rookFrom.c) ||
         (r === ch.rookTo.r   && c === ch.rookTo.c))) {
      this._undoPreview();
      return;
    }

    // Clicking a same-side piece while preview is active → ignore
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

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION B — Legal-move validation
  // ══════════════════════════════════════════════════════════════════════════

  // Returns true iff moving the piece at (fr,fc) to (tr,tc) is fully legal
  // (piece movement rules + does not leave own king in check).
  _isLegalMove(board, fr, fc, tr, tc, state) {
    const piece       = board[fr][fc];
    const isWhite     = piece === piece.toUpperCase();
    const targetPiece = board[tr][tc];

    // Cannot capture own piece
    if (targetPiece !== ".") {
      const targetIsWhite = targetPiece === targetPiece.toUpperCase();
      if (isWhite === targetIsWhite) return false;
    }

    const type = piece.toLowerCase();

    let pseudoLegal = false;

    switch (type) {
      case "p": pseudoLegal = this._pawnMove(board, fr, fc, tr, tc, isWhite, state); break;
      case "n": pseudoLegal = this._knightMove(fr, fc, tr, tc);                      break;
      case "b": pseudoLegal = this._bishopMove(board, fr, fc, tr, tc);               break;
      case "r": pseudoLegal = this._rookMove(board, fr, fc, tr, tc);                 break;
      case "q": pseudoLegal = this._queenMove(board, fr, fc, tr, tc);                break;
      case "k": pseudoLegal = this._kingMove(board, fr, fc, tr, tc, isWhite, state); break;
      default: return false;
    }

    if (!pseudoLegal) return false;

    // After applying the move, the moving side's king must not be in check.
    // For castling the path check is handled inside _kingMove; we still need
    // to verify the destination square isn't in check, which the board-sim
    // below covers for the king itself.
    const simBoard = this._applyMoveToBoard(board, fr, fc, tr, tc, piece, state);
    return !this._isInCheck(simBoard, isWhite);
  }

  // ── Piece-specific pseudo-legal generators ────────────────────────────────

  _pawnMove(board, fr, fc, tr, tc, isWhite, state) {
    const dir       = isWhite ? -1 : 1;   // white moves up (decreasing row)
    const startRow  = isWhite ? 6 : 1;
    const dr        = tr - fr;
    const dc        = tc - fc;

    // Single push
    if (dc === 0 && dr === dir && board[tr][tc] === ".") return true;

    // Double push from starting rank
    if (dc === 0 && dr === 2 * dir && fr === startRow &&
        board[fr + dir][fc] === "." && board[tr][tc] === ".") return true;

    // Diagonal capture (normal)
    if (Math.abs(dc) === 1 && dr === dir && board[tr][tc] !== ".") return true;

    // En passant
    const ep = state.enPassantTarget;
    if (ep && Math.abs(dc) === 1 && dr === dir && tr === ep.r && tc === ep.c) return true;

    return false;
  }

  _knightMove(fr, fc, tr, tc) {
    const dr = Math.abs(tr - fr);
    const dc = Math.abs(tc - fc);
    return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
  }

  _bishopMove(board, fr, fc, tr, tc) {
    const dr = tr - fr, dc = tc - fc;
    if (Math.abs(dr) !== Math.abs(dc)) return false;
    return this._pathClear(board, fr, fc, tr, tc);
  }

  _rookMove(board, fr, fc, tr, tc) {
    if (fr !== tr && fc !== tc) return false;
    return this._pathClear(board, fr, fc, tr, tc);
  }

  _queenMove(board, fr, fc, tr, tc) {
    return this._bishopMove(board, fr, fc, tr, tc) ||
           this._rookMove(board, fr, fc, tr, tc);
  }

  _kingMove(board, fr, fc, tr, tc, isWhite, state) {
    const dr = Math.abs(tr - fr);
    const dc = Math.abs(tc - fc);

    // Normal king move (one square any direction)
    if (dr <= 1 && dc <= 1 && (dr + dc) > 0) return true;

    // Castling — king moves exactly 2 squares horizontally on its home row
    if (dr !== 0 || dc !== 2) return false;

    const homeRow  = isWhite ? 7 : 0;
    if (fr !== homeRow) return false;

    // King must not currently be in check
    if (this._isInCheck(board, isWhite)) return false;

    const side = (tc > fc) ? "K" : "Q";   // kingside or queenside

    if (isWhite) {
      if (side === "K" && !state.castling.wK) return false;
      if (side === "Q" && !state.castling.wQ) return false;
    } else {
      if (side === "K" && !state.castling.bK) return false;
      if (side === "Q" && !state.castling.bQ) return false;
    }

    // Squares between king and rook must be empty
    const rookCol   = (side === "K") ? 7 : 0;
    const minCol    = Math.min(fc, rookCol) + 1;
    const maxCol    = Math.max(fc, rookCol) - 1;
    for (let col = minCol; col <= maxCol; col++) {
      if (board[homeRow][col] !== ".") return false;
    }

    // The square the king passes through must not be attacked
    const passThroughCol = (side === "K") ? fc + 1 : fc - 1;
    const passBoard = this._applyMoveToBoard(board, fr, fc, homeRow, passThroughCol,
                                             isWhite ? "K" : "k", state);
    if (this._isInCheck(passBoard, isWhite)) return false;

    return true;
  }

  // ── Board utilities ───────────────────────────────────────────────────────

  // True when every square strictly between (fr,fc) and (tr,tc) is empty.
  _pathClear(board, fr, fc, tr, tc) {
    const dr   = Math.sign(tr - fr);
    const dc   = Math.sign(tc - fc);
    let r = fr + dr, c = fc + dc;
    while (r !== tr || c !== tc) {
      if (board[r][c] !== ".") return false;
      r += dr; c += dc;
    }
    return true;
  }

  // Apply a move to a board copy and return the new board.
  // Handles en passant capture and castling rook move automatically.
  _applyMoveToBoard(board, fr, fc, tr, tc, piece, state) {
    let b = ChessConstants.cloneBoard(board);
    const isWhite = piece === piece.toUpperCase();
    const type    = piece.toLowerCase();

    // Move the piece
    b[tr] = ChessConstants.replaceChar(b[tr], tc, piece);
    b[fr] = ChessConstants.replaceChar(b[fr], fc, ".");

    // En passant: remove the captured pawn
    if (type === "p" && state.enPassantTarget &&
        tr === state.enPassantTarget.r && tc === state.enPassantTarget.c) {
      const capturedRow = isWhite ? tr + 1 : tr - 1;
      b[capturedRow] = ChessConstants.replaceChar(b[capturedRow], tc, ".");
    }

    // Castling: also move the rook
    if (type === "k" && Math.abs(tc - fc) === 2) {
      const homeRow = isWhite ? 7 : 0;
      if (tc > fc) { // kingside
        b[homeRow] = ChessConstants.replaceChar(b[homeRow], 5, isWhite ? "R" : "r");
        b[homeRow] = ChessConstants.replaceChar(b[homeRow], 7, ".");
      } else {       // queenside
        b[homeRow] = ChessConstants.replaceChar(b[homeRow], 3, isWhite ? "R" : "r");
        b[homeRow] = ChessConstants.replaceChar(b[homeRow], 0, ".");
      }
    }

    return b;
  }

  // True when the side given by isWhite has their king in check on `board`.
  _isInCheck(board, isWhite) {
    // Find the king
    const kingPiece = isWhite ? "K" : "k";
    let kr = -1, kc = -1;
    outer: for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === kingPiece) { kr = r; kc = c; break outer; }
      }
    }
    if (kr === -1) return false; // no king found (shouldn't happen)

    // Check whether any enemy piece attacks (kr, kc)
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p === ".") continue;
        const pIsWhite = p === p.toUpperCase();
        if (pIsWhite === isWhite) continue; // same side

        // Use pseudo-legal generators with a dummy state (no ep/castling needed
        // for attack detection — en passant can't attack a king, and a rook
        // can't castle to check a king)
        const dummyState = { enPassantTarget: null, castling: { wK:false,wQ:false,bK:false,bQ:false } };
        const attacks = this._squareAttackedBy(board, r, c, kr, kc, p, dummyState);
        if (attacks) return true;
      }
    }
    return false;
  }

  // True when the piece `p` at (pr,pc) attacks square (tr,tc).
  _squareAttackedBy(board, pr, pc, tr, tc, p, state) {
    const isWhite = p === p.toUpperCase();
    switch (p.toLowerCase()) {
      case "p": {
        const dir = isWhite ? -1 : 1;
        return (tr - pr === dir) && Math.abs(tc - pc) === 1;
      }
      case "n": return this._knightMove(pr, pc, tr, tc);
      case "b": return this._bishopMove(board, pr, pc, tr, tc);
      case "r": return this._rookMove(board, pr, pc, tr, tc);
      case "q": return this._queenMove(board, pr, pc, tr, tc);
      case "k": {
        const dr = Math.abs(tr - pr), dc = Math.abs(tc - pc);
        return dr <= 1 && dc <= 1 && (dr + dc) > 0;
      }
      default: return false;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION C — Preview / undo
  // ══════════════════════════════════════════════════════════════════════════

  _previewMove(from, to) {
    const s           = this.state;
    const piece       = from.piece;
    const isWhite     = piece === piece.toUpperCase();
    const type        = piece.toLowerCase();
    const isCastling  = type === "k" && Math.abs(to.c - from.c) === 2;
    const isEnPassant = type === "p" && s.enPassantTarget &&
                        to.r === s.enPassantTarget.r && to.c === s.enPassantTarget.c;

    // ── Snapshot everything for undo ──────────────────────────────────────
    s.lastPreview = {
      board:            ChessConstants.cloneBoard(s.board),
      moveList:         s.moveList.slice(),
      moveNumber:       s.moveNumber,
      turn:             s.turn,
      source:           { ...from },
      capturedPiece:    s.board[to.r][to.c],
      castling:         { ...s.castling },
      enPassantTarget:  s.enPassantTarget,
      castlingHighlights: s.castlingHighlights,
      isCastling,
      isEnPassant
    };

    // ── Apply the move ────────────────────────────────────────────────────
    s.board = this._applyMoveToBoard(s.board, from.r, from.c, to.r, to.c, piece, s);

    // ── En passant: capture square holds "." but we removed the pawn above;
    //    record the actual captured piece for notation.
    if (isEnPassant) {
      const capturedRow = isWhite ? to.r + 1 : to.r - 1;
      s.lastPreview.capturedPiece = isWhite ? "p" : "P"; // the pawn we removed
    }

    // ── Castling highlights ───────────────────────────────────────────────
    if (isCastling) {
      const homeRow   = isWhite ? 7 : 0;
      const kingside  = to.c > from.c;
      const rookFromC = kingside ? 7 : 0;
      const rookToC   = kingside ? 5 : 3;
      s.castlingHighlights = {
        rookFrom: { r: homeRow, c: rookFromC },
        rookTo:   { r: homeRow, c: rookToC   }
      };
    } else {
      s.castlingHighlights = null;
    }

    // ── Record the move (updates turn, moveNumber, castling rights, EP) ───
    this._recordMove(from, to);

    s.selectedDestination = { r: to.r, c: to.c };

    // ── Pawn promotion ────────────────────────────────────────────────────
    const promotionRow = isWhite ? 0 : 7;
    if (type === "p" && to.r === promotionRow) {
      s.promotionPending = true;
      this.renderer.draw(); // show board with pawn on promotion square first
      this._showPromotionDialog(isWhite, to.r, to.c);
    } else {
      this.renderer.draw();
    }
  }

  _undoPreview() {
    const s = this.state;
    if (!s.lastPreview) return;

    s.board             = ChessConstants.cloneBoard(s.lastPreview.board);
    s.moveList          = s.lastPreview.moveList.slice();
    s.moveNumber        = s.lastPreview.moveNumber;
    s.turn              = s.lastPreview.turn;
    s.castling          = { ...s.lastPreview.castling };
    s.enPassantTarget   = s.lastPreview.enPassantTarget;
    s.castlingHighlights = null;

    s.selectedSource      = { ...s.lastPreview.source };
    s.selectedDestination = null;
    s.lastPreview         = null;
    s.promotionPending    = false;

    this.pgn.updatePGN();
    this.renderer.draw();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION D — Promotion dialog
  // ══════════════════════════════════════════════════════════════════════════

  _showPromotionDialog(isWhite, toRow, toCol) {
    const s       = this.state;
    const choices = isWhite
      ? [{ piece:"Q", label:"Queen"  },
         { piece:"R", label:"Rook"   },
         { piece:"B", label:"Bishop" },
         { piece:"N", label:"Knight" }]
      : [{ piece:"q", label:"Queen"  },
         { piece:"r", label:"Rook"   },
         { piece:"b", label:"Bishop" },
         { piece:"n", label:"Knight" }];

    // ── Overlay ───────────────────────────────────────────────────────────
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position:fixed", "inset:0", "background:rgba(0,0,0,0.55)",
      "display:flex", "align-items:center", "justify-content:center",
      "z-index:9999"
    ].join(";");

    // ── Dialog box ────────────────────────────────────────────────────────
    const box = document.createElement("div");
    box.style.cssText = [
      "background:#fff", "border-radius:8px", "padding:20px 24px",
      "box-shadow:0 8px 32px rgba(0,0,0,0.4)", "text-align:center",
      "font-family:Arial,sans-serif"
    ].join(";");

    const title = document.createElement("h3");
    title.textContent = "Promote pawn to…";
    title.style.cssText = "margin:0 0 16px;color:#2c3e50;font-size:18px";
    box.appendChild(title);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:12px;justify-content:center";

    choices.forEach(({ piece, label }) => {
      const btn = document.createElement("button");
      btn.style.cssText = [
        "display:flex", "flex-direction:column", "align-items:center",
        "gap:6px", "padding:10px 14px", "background:#2c3e50", "color:#fff",
        "border:none", "border-radius:6px", "cursor:pointer", "font-size:13px"
      ].join(";");
      btn.onmouseover = () => btn.style.background = "#1b2836";
      btn.onmouseout  = () => btn.style.background = "#2c3e50";

      const img = document.createElement("img");
      img.src    = ChessConstants.pieceToSrc(piece);
      img.width  = 48;
      img.height = 48;
      img.style.pointerEvents = "none";

      const lbl = document.createElement("span");
      lbl.textContent = label;

      btn.appendChild(img);
      btn.appendChild(lbl);

      btn.onclick = () => {
        document.body.removeChild(overlay);
        this._applyPromotion(piece, toRow, toCol);
      };

      btnRow.appendChild(btn);
    });

    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  _applyPromotion(piece, r, c) {
    const s = this.state;

    // Replace the pawn on the promotion square with the chosen piece
    s.board[r] = ChessConstants.replaceChar(s.board[r], c, piece);

    // Fix the last move notation to append the promotion piece symbol
    // Standard: append "=" + piece-letter (uppercase)
    const promoSuffix = "=" + piece.toUpperCase();
    if (s.moveList.length > 0) {
      // The promotion move is the last token in the last entry
      const last  = s.moveList[s.moveList.length - 1];
      const parts = last.split(" ");
      parts[parts.length - 1] += promoSuffix;
      s.moveList[s.moveList.length - 1] = parts.join(" ");
    }

    s.promotionPending = false;
    this.pgn.updatePGN();
    this.renderer.draw();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION E — Move recording & state updates
  // ══════════════════════════════════════════════════════════════════════════

  _recordMove(from, to) {
    const s         = this.state;
    const piece     = from.piece;
    const isWhite   = piece === piece.toUpperCase();
    const type      = piece.toLowerCase();
    const preview   = s.lastPreview;

    // Determine separator and special flags
    const isCastling  = preview.isCastling;
    const isEnPassant = preview.isEnPassant;
    const captured    = preview.capturedPiece;
    const isCapture   = captured !== "." && captured !== "";

    // ── Build notation ───────────────────────────────────────────────────
    let notation;
    if (isCastling) {
      notation = (to.c > from.c) ? "O-O" : "O-O-O";
    } else {
      const sep = isCapture ? "x" : "-";
      notation  =
        ChessConstants.FILES[from.c] + ChessConstants.RANKS[from.r] + sep +
        ChessConstants.FILES[to.c]   + ChessConstants.RANKS[to.r];
      if (isEnPassant) notation += " e.p.";
    }

    // ── Append to move list ──────────────────────────────────────────────
    if (s.turn === "white") {
      s.moveList.push(s.moveNumber + ". " + notation);
    } else {
      s.moveList[s.moveList.length - 1] += " " + notation;
      s.moveNumber++;
    }

    // ── Update en passant target ─────────────────────────────────────────
    if (type === "p" && Math.abs(to.r - from.r) === 2) {
      // Double pawn push — set EP target to the square behind the pawn
      s.enPassantTarget = {
        r: (from.r + to.r) / 2,
        c: from.c
      };
    } else {
      s.enPassantTarget = null;
    }

    // ── Update castling rights ───────────────────────────────────────────
    // King move revokes both sides for that colour
    if (piece === "K") { s.castling.wK = false; s.castling.wQ = false; }
    if (piece === "k") { s.castling.bK = false; s.castling.bQ = false; }
    // Rook move revokes the relevant side
    if (piece === "R") {
      if (from.r === 7 && from.c === 7) s.castling.wK = false;
      if (from.r === 7 && from.c === 0) s.castling.wQ = false;
    }
    if (piece === "r") {
      if (from.r === 0 && from.c === 7) s.castling.bK = false;
      if (from.r === 0 && from.c === 0) s.castling.bQ = false;
    }
    // A rook captured on its starting square also revokes castling
    if (captured === "R") {
      if (to.r === 7 && to.c === 7) s.castling.wK = false;
      if (to.r === 7 && to.c === 0) s.castling.wQ = false;
    }
    if (captured === "r") {
      if (to.r === 0 && to.c === 7) s.castling.bK = false;
      if (to.r === 0 && to.c === 0) s.castling.bQ = false;
    }

    // ── Advance turn ─────────────────────────────────────────────────────
    s.turn = (s.turn === "white") ? "black" : "white";

    this.pgn.updatePGN();
  }
}
