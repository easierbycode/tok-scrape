// Mini-Lucene subset evaluator for the graylog-shim.
//
// Clients (mobile-app/www/js/api.js, .claude/skills/graylog-query/scripts/
// graylog_query.py, build-preloaded.js) emit ONLY a small, fixed grammar — not
// real full-text search. We parse it into an AST and evaluate it over the flat
// `fields` map of each stored document.
//
// Grammar (exhaustive — the set of shapes clients actually produce):
//   expr      := or
//   or        := and ( OR and )*
//   and       := primary ( (AND)? primary )*        // implicit adjacency = AND
//   primary   := '(' or ')' | '*' | term
//   term      := FIELD ':' ( phrase | range | bareword )
//   phrase    := '"' chars-with-\"-escape '"'       // creator:"@prettyplug.x"
//   range     := '[' bound 'TO' bound ']'           // gmv_num:[100 TO *]
//   bound     := number | '*'
//   bareword  := non-space, non-paren run           // source:tiktok-affiliate-export
//
// `field.keyword` collapses to `field` (no analyzer in a KV store; the two are
// always OR'd by api.js, so equality on either satisfies the clause).
// AND binds tighter than OR. Field/value matching is string equality except
// ranges, which are inclusive numeric with a strict null/"" guard.

export type Node =
  | { t: "all" }
  | { t: "term"; field: string; value: string }
  | { t: "range"; field: string; lo: number | null; hi: number | null }
  | { t: "and"; kids: Node[] }
  | { t: "or"; kids: Node[] };

// ───────────────────────────── tokenizer ─────────────────────────────

type Tok =
  | { k: "lp" }
  | { k: "rp" }
  | { k: "and" }
  | { k: "or" }
  | { k: "star" }
  | { k: "term"; node: Node };

const isWs = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";

function collapseField(field: string): string {
  return field.endsWith(".keyword") ? field.slice(0, -".keyword".length) : field;
}

function parseRange(field: string, inner: string): Node {
  // inner looks like "100 TO *", "* TO 100", "100 TO 200" (TO is case-insensitive).
  const m = inner.split(/\s+TO\s+/i);
  const lo = m[0]?.trim() ?? "*";
  const hi = m[1]?.trim() ?? "*";
  const bound = (b: string): number | null =>
    (b === "*" || b === "") ? null : Number(b);
  return { t: "range", field: collapseField(field), lo: bound(lo), hi: bound(hi) };
}

function tokenize(input: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const c = input[i];
    if (isWs(c)) { i++; continue; }
    if (c === "(") { toks.push({ k: "lp" }); i++; continue; }
    if (c === ")") { toks.push({ k: "rp" }); i++; continue; }

    // Read a "head" run up to ws / paren / ':'.
    let head = "";
    while (i < n && !isWs(input[i]) && input[i] !== "(" && input[i] !== ")" && input[i] !== ":") {
      head += input[i++];
    }

    if (i < n && input[i] === ":") {
      // FIELD ':' value
      i++; // consume ':'
      const field = head;
      if (input[i] === '"') {
        // quoted phrase with \" escape
        i++; // opening quote
        let v = "";
        while (i < n) {
          const ch = input[i];
          if (ch === "\\" && i + 1 < n && input[i + 1] === '"') { v += '"'; i += 2; continue; }
          if (ch === '"') { i++; break; }
          v += ch; i++;
        }
        toks.push({ k: "term", node: { t: "term", field: collapseField(field), value: v } });
      } else if (input[i] === "[") {
        i++; // '['
        let inner = "";
        while (i < n && input[i] !== "]") { inner += input[i++]; }
        if (i < n) i++; // ']'
        toks.push({ k: "term", node: parseRange(field, inner) });
      } else {
        // bareword value: read up to ws / paren
        let v = "";
        while (i < n && !isWs(input[i]) && input[i] !== "(" && input[i] !== ")") { v += input[i++]; }
        toks.push({ k: "term", node: { t: "term", field: collapseField(field), value: v } });
      }
      continue;
    }

    // No colon: head is a bareword operator / star / stray token.
    if (head === "*") { toks.push({ k: "star" }); continue; }
    const up = head.toUpperCase();
    if (up === "AND") { toks.push({ k: "and" }); continue; }
    if (up === "OR") { toks.push({ k: "or" }); continue; }
    // Unknown bare token — clients never emit this. Treat as a term that can
    // never match (field "" is absent on every doc) so it's inert rather than
    // accidentally matching everything.
    toks.push({ k: "term", node: { t: "term", field: "", value: head } });
  }
  return toks;
}

// ───────────────────────────── parser ─────────────────────────────

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok | undefined { return this.toks[this.p]; }
  private next(): Tok | undefined { return this.toks[this.p++]; }

  parse(): Node {
    if (this.toks.length === 0) return { t: "all" };
    const node = this.parseOr();
    return node;
  }

  private parseOr(): Node {
    const kids = [this.parseAnd()];
    while (this.peek()?.k === "or") {
      this.next();
      kids.push(this.parseAnd());
    }
    return kids.length === 1 ? kids[0] : { t: "or", kids };
  }

  private parseAnd(): Node {
    const kids = [this.parsePrimary()];
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (t.k === "and") { this.next(); kids.push(this.parsePrimary()); continue; }
      // implicit AND: another primary with no operator between
      if (t.k === "lp" || t.k === "star" || t.k === "term") { kids.push(this.parsePrimary()); continue; }
      break; // 'or' or 'rp' → let the caller handle it
    }
    return kids.length === 1 ? kids[0] : { t: "and", kids };
  }

  private parsePrimary(): Node {
    const t = this.next();
    if (!t) return { t: "all" };
    if (t.k === "lp") {
      const e = this.parseOr();
      if (this.peek()?.k === "rp") this.next();
      return e;
    }
    if (t.k === "star") return { t: "all" };
    if (t.k === "term") return t.node;
    // stray AND/OR/RP at primary position — be lenient
    return { t: "all" };
  }
}

export function parse(query: string): Node {
  const q = (query ?? "").trim();
  if (q === "" || q === "*") return { t: "all" };
  return new Parser(tokenize(q)).parse();
}

// ───────────────────────────── evaluator ─────────────────────────────

export function evalNode(n: Node, f: Record<string, unknown>): boolean {
  switch (n.t) {
    case "all": return true;
    case "and": return n.kids.every((k) => evalNode(k, f));
    case "or": return n.kids.some((k) => evalNode(k, f));
    case "term": return String(f[n.field] ?? "") === n.value;
    case "range": {
      const raw = f[n.field];
      // CRITICAL: null/undefined/"" are NON-numeric. Number(null)===0 would make
      // a missing gmv_num match [* TO 100] / [0 TO *] as if GMV were 0.
      if (raw == null || raw === "") return false;
      const v = Number(raw);
      if (Number.isNaN(v)) return false;
      if (n.lo != null && v < n.lo) return false; // inclusive
      if (n.hi != null && v > n.hi) return false;
      return true;
    }
  }
}

// Pick a KV index prefix when the query pins a field to a single equality value
// at the top level (covers `source:x` and `(source:x) AND …`). Returns null if
// the field isn't pinned (e.g. it only appears inside an OR), forcing a scan.
export function pinnedEq(n: Node, field: string): string | null {
  if (n.t === "term" && n.field === field && n.value) return n.value;
  if (n.t === "and") {
    for (const k of n.kids) {
      const v = pinnedEq(k, field);
      if (v) return v;
    }
  }
  return null;
}
