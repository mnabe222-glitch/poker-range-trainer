// src/App.tsx
import React, { useMemo, useState, useEffect } from "react";
import ResponsiveShell from "./ResponsiveShell";
import { ScenarioTabsWrap } from "./components/ScenarioTabsWrap";

/**
 * Poker Range Trainer - all-in-one
 * - 上三角 = Suited, 下三角 = Offsuit
 * - Hero/Board はカード画像から選択（重複は自動ブロック）
 * - レンジ文字列（22+, A2s+, KTo+, T9s-87s など）をパース
 * - Scenario × Position でプリセット適用
 * - 合計コンボ数 + 役の割合 + ドロー内訳（FD/OESD/Gutshot/BDFD）
 */

/* ===================== Ranks / Suits ===================== */
const ORDER = "AKQJT98765432";
const RANKS = ORDER.split("") as string[];
const SUITS = ["c", "d", "h", "s"] as const;
const SUIT_GLYPH: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };
const SUIT_COLOR: Record<string, string> = { c: "#111827", d: "#dc2626", h: "#dc2626", s: "#111827" };
const RANK_ORDER: Record<string, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, RANKS.length - 1 - i]) // A:12 ... 2:0
);

/* ===================== Grid (13x13 labels) ===================== */
function labelFromRanks(i: number, j: number) {
  if (i === j) return RANKS[i] + RANKS[j]; // pair
  const high = RANKS[Math.min(i, j)];
  const low = RANKS[Math.max(i, j)];
  const suitedFlag = j > i ? "s" : "o"; // 上三角=suited, 下三角=offsuit
  return high + low + suitedFlag;
}

const GRID_LABELS: string[][] = [];
for (let i = 0; i < 13; i++) {
  const row: string[] = [];
  for (let j = 0; j < 13; j++) row.push(labelFromRanks(i, j));
  GRID_LABELS.push(row);
}

/* ===================== Presets ===================== */
type Pos = "BTN" | "CO" | "HJ" | "LJ";
type ThreePos = Pos | "SB" | "BB" | "EP";
type Scenario = "OPEN" | "BBvsOPEN" | "SB_3BET" | "BB_3BET" | "BB_SB_CALL_3BET" | "BTN_3BET";
type VsOpenPos = Pos | "SB";
type Sb3betPos = "BTN" | "EP";
type BbSbCall3betPos = "BTN" | "EP";

// ユーザー提供のプリセット（整形済み）
const PRESETS = {
  open: {
    BTN: "22+, A2s+, K2s+, Q3s+, J6s+, T7s+, 97s+, 86s+, 75s+, 64s+, 54s+, 43s+, 32s, A2o+, K6o+, Q8o+, J8o+, T8o+, 97o+, 87o+, 76o, 65o, 54o",
    CO:  "22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 53s+, 98s, 87s, 76s,65s, 54s, 43s, 32s, A2o+, K8o+, Q9o+, J9o+, T9o+, 98o, 87o, 76o, 65o",
    HJ:  "22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 53s+, 98s, 87s, 76s,65s, 54s, 43s, A8o+, KTo+, QTo+, JTo+",
    LJ:  "22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 53s+,  98s, 87s, 76s,65s, 54s, 43s, AJo+, KQo",
    SB:  "22+, A2s+, K2s+, Q2s+, J6s+, T6s+, 96s+, 86s+, 75s+, 65s+, A2o+, K7o+, Q8o+, J8o+, T8o+, 98o",
  } as Record<Pos | "SB", string>,

  bbCallVs: {
    SB:  "22-99, A2s-A9s, K2s-K9s, Q2s-QTs, J2s-JTs, T2s-T9s, 87s,76s,65s,KTo,Qto,K8o,Q8o,J8o,97s, 98s, 86s, 75s, 64s, 54s, 43s, 32s, A2o-A9o, K9o,KJo, KQo, Q9o, QJo, J9o, JTo, T9o ",
    BTN: "22, 33, 44, 55, 66, A6s, A7s, A8s, K2s, K3s, K4s, K5s, K6s, K7s, K8s, K9s, Q2s, Q3s, Q4s, Q5s, Q6s, Q7s, Q8s, Q9s, J5s, J6s, J7s, J8s, J9s, T5s, T6s, T7s, T8s, 96s, 97s, 98s, 85s, 86s, 87s, 74s, 75s, 76s, 65s, 64s, 53s, 54s, 43s, ATo, A9o, A8o, A7o, A6o, A5o, A4o, A3o, K9o, KTo, KJo, KQo, Q9o, QTo, JTo, J9o",
    CO:  "22, 33, 44, 55, 66, 77, 88, 99,A2s, A3s, A4s, A5s, A6s, A7s, A8s, A9s,K7s, K8s, K9s,Q8s, Q9s, QTs,J8s, J9s, JTs,T8s, T9s,97s, 98s,86s,75s,64s,54s,A9o, ATo,KJo, KQo,QJo,JTo,87s,76s,65s",
    HJ:  "22, 33, 44, 55, 66, 77, 88, 99, 54s, 65s, 78s, 89s, 98s, T9s, JTs, A2s, K2s, A3s, K3s, A4s, K4s, Q4s, A5s, K5s, Q5s, A6s, K6s, Q6s, A7s, K7s, Q7s, J6s+, T7s+, 97s, 87s, K8s, 75s+, 76s,  KJo, AJo, ATo, KTo, KQo, QJo, QTo, JTo",
    LJ:  "72o",
  } as Record<VsOpenPos, string>,

  sb3bet: {
    BTN: "66+, A7s+, A5s, A4s, A3s, K9s+, Q9s+, J9s+, T8s+, 89s, ATo+, KJo+",
    EP:  "99+,A3s,A4s,A5s,ATs+,KTs+,QTs+,AQo+,KQo,",
  } as Record<Sb3betPos, string>,

  bb3bet: {
    BTN: "77+, ATs+, KTs+, Q9s+, J9s, T8s, 87s,76s, 98s, JTs, A9s+, A5s, A4s, A3s, A2s, T9s, A7o+,KTo+,QTo+",
    EP:  "77+,AKo, AQo, KQo, ATo+,KTo+, KQo,A2s-A5s, AJs+, KTs+, QTs+, JTs",
  } as Record<"BTN" | "EP", string>,

  bbsbCall3bet: {
    BTN: "55,66, 77, 88, 99, TT, JJ, A2s, A3s, A4s, A5s, A6s, A7s, A8s, A9s, ATs, AJs, AQs, K9s, KTs, KJs, KQs, QJs, QTs, JTs, J9s, T8s+, 89s, 87s, 76s, 65s, 54s",
    EP:  "55-QQ,ATs,AJs,AQs,KTs,KJs,KQs,JTs,54s,65s,76s,87s,QJs,QTs,98s,T9s",
  } as Record<BbSbCall3betPos, string>,

  btn3bet: {
    BTN: "72s",
    CO:  "88+, A4s+, K9s+, Q9s+, J9s+, T9s+, ATo+, KJo+",
    HJ:  "72o",
    LJ:  "TT+, ATs+, A4s, A5s, KTs+, QTs+, AJo+, KQo",
  } as Record<Pos, string>,
};

const VALID_POS: Record<Scenario, ThreePos[]> = {
  OPEN: ["SB","BTN", "CO", "HJ", "LJ"],
  BBvsOPEN: ["SB","BTN", "CO", "HJ", "LJ"],
  SB_3BET: ["BTN", "EP"],
  BB_3BET: ["BTN", "EP"],
  BB_SB_CALL_3BET: ["BTN", "EP"],
  BTN_3BET: ["CO", "HJ", "LJ", "SB", "BB"],
};

/* ===================== Range Parser ===================== */
function normalizeRange(raw: string): string {
  const s = raw.toUpperCase().replace(/\s+/g, "");
  // カンマ抜けにも耐える
  return s.replace(/([2-9TJQKA][2-9TJQKA][SO]?\+?)(?=[2-9TJQKA])/g, "$1,");
}
function idx(r: string) { return ORDER.indexOf(r); }
function sortHiLo(a: string, b: string): [string, string] { return idx(a) <= idx(b) ? [a, b] : [b, a]; }
function expandPairPlus(rr: string): string[] {
  const start = idx(rr[0]); const out: string[] = [];
  for (let i = start; i >= 0; i--) out.push(RANKS[i] + RANKS[i]); // 22..AA
  return out;
}
// 「+」展開ロジック（97s+, KTo+, A2s+ を正しく解釈）
function expandSuitedOffPlus(x: string, y: string, s: "s" | "o"): string[] {
  const [hi, lo] = sortHiLo(x, y);
  const out: string[] = [];

  // A固定でキッカーを上げる
  if (hi === "A") { for (let j = idx(lo); j > 0; j--) out.push(`A${RANKS[j]}${s}`); return out; }

  // フェイスカード始まりは1枚目固定（KTo+, K9s+ など）
  const isFace = (r: string) => "AKQJT".includes(r);
  if (isFace(hi)) { for (let t = idx(lo); t > idx(hi); t--) out.push(`${hi}${RANKS[t]}${s}`); return out; }

  // それ以外（97s+, 86s+ 等）はギャップ固定で斜めに上げる（97→T8→J9→QT→KJ→AQ）
  const gap = idx(lo) - idx(hi);
  for (let i = idx(hi); i >= 0; i--) {
    const j = i + gap;
    if (j >= RANKS.length) break;
    out.push(`${RANKS[i]}${RANKS[j]}${s}`);
  }
  return out;
}
function expandDiagonalRange(from: string, to: string): string[] {
  const s = from.endsWith("s") ? "s" : "o";
  let a1 = from[0], b1 = from[1]; const a2 = to[0], b2 = to[1];
  const out = [from];
  while (a1 !== a2 || b1 !== b2) {
    const na = RANKS[idx(a1) + 1]; const nb = RANKS[idx(b1) + 1];
    if (!na || !nb) break;
    a1 = na; b1 = nb; out.push(`${a1}${b1}${s}`);
  }
  return out;
}
function expandToken(tok: string): string[] {
  if (!tok) return [];

  // 22+（ペアの+）
  if (/^([2-9TJQKA])\1\+$/.test(tok)) {
    return expandPairPlus(tok[0] + tok[1]);
  }

  // 22（単体ペア）
  if (/^([2-9TJQKA])\1$/.test(tok)) {
    return [tok];
  }

  // 22-99 / 55-JJ など（ペアの範囲）
  let m = tok.match(/^([2-9TJQKA])\1-([2-9TJQKA])\2$/);
  if (m) {
    const [, from, to] = m;
    const out: string[] = [];
    const start = idx(from);
    const end = idx(to);
    for (let i = start; i >= end; i--) {
      out.push(RANKS[i] + RANKS[i]); // 22,33,...,99
    }
    return out;
  }

  // ★ A2s-A9s / KTo-KQo など（1枚目とs/oが同じで、2枚目だけ範囲）
  m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([so])-\1([2-9TJQKA])\3$/i);
  if (m) {
    const [, first, from, so, to] = m;
    const out: string[] = [];
    const start = idx(from.toUpperCase());
    const end = idx(to.toUpperCase());
    for (let i = start; i >= end; i--) {
      out.push(`${first.toUpperCase()}${RANKS[i]}${so.toLowerCase()}`); // A2s..A9s 等
    }
    return out;
  }

  // A2s+ / KTo+（スーテッド/オフスートの+）
  m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([so])\+$/i);
  if (m) {
    const [, x, y, so] = m as any;
    return expandSuitedOffPlus(x, y, so.toLowerCase() as "s" | "o");
  }

  // AJs / KQo（スーテッド/オフスート単体）
  m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([so])$/i);
  if (m) {
    const [, x, y, so] = m as any;
    const [hi, lo] = sortHiLo(x, y);
    return [`${hi}${lo}${so.toLowerCase()}`];
  }

  // T9s-87s など（斜めの範囲）
  m = tok.match(/^([2-9TJQKA]{2}[so])-([2-9TJQKA]{2}[so])$/i);
  if (m) {
    const [, from, to] = m;
    return expandDiagonalRange(from.toUpperCase(), to.toUpperCase());
  }

  return [];
}


function parseRangeString(raw: string): string[] {
  const norm = normalizeRange(raw);
  const parts = norm.split(",").filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) for (const h of expandToken(p)) out.add(h);
  // normalize label: 22 / AJs / AJo
  const labs: string[] = [];
  for (const h of out) {
    if (/^([2-9TJQKA])\1$/.test(h)) labs.push(h);
    else {
      const r1 = h[0], r2 = h[1], so = h[2];
      const [hi, lo] = sortHiLo(r1, r2);
      labs.push(`${hi}${lo}${so}`);
    }
  }
  return Array.from(new Set(labs));
}

/* ===================== Combos per Label ===================== */
function combosFor(label: string): string[][] {
  const a = label[0], b = label[1];
  if (label.length === 2) {
    // pair: 6 combos (4C2)
    const res: string[][] = [];
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) res.push([a + SUITS[i], b + SUITS[j]]);
    return res;
  }
  if (label[2] === "s") {
    // suited: 4 combos
    return SUITS.map((s) => [a + s, b + s]);
  }
  // offsuit: 12 combos（同スート除外）
  const res: string[][] = [];
  for (const s1 of SUITS)
    for (const s2 of SUITS)
      if (s1 !== s2) res.push([a + s1, b + s2]);
  return res;
}

const LABEL_TO_COMBOS: Record<string, string[][]> = {};
for (const row of GRID_LABELS) for (const lab of row) LABEL_TO_COMBOS[lab] = combosFor(lab);

/* ===================== Hand Eval & Draws ===================== */
type Category =
  | "High Card" | "Pair" | "Two Pair" | "Trips"
  | "Straight" | "Flush" | "Full House" | "Quads" | "Straight Flush";

const CAT_ORDER: Record<Category, number> = {
  "High Card": 0, Pair: 1, "Two Pair": 2, Trips: 3,
  Straight: 4, Flush: 5, "Full House": 6, Quads: 7, "Straight Flush": 8,
};

function rankCounts(cards: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of cards) m[c[0]] = (m[c[0]] || 0) + 1;
  return m;
}
function suitCounts(cards: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of cards) m[c[1]] = (m[c[1]] || 0) + 1;
  return m;
}
function isStraight(ranks: string[]): boolean {
  const uniq = Array.from(new Set(ranks)).sort((a, b) => RANK_ORDER[b] - RANK_ORDER[a]);
  const withWheel = uniq.includes("A") ? [...uniq, "1"] : uniq; // Aを1としても
  const order = (r: string) => (r === "1" ? 0 : RANK_ORDER[r]);
  let streak = 1;
  for (let i = 1; i < withWheel.length; i++) {
    const d = order(withWheel[i - 1]) - order(withWheel[i]);
    if (d === 1) { streak++; if (streak >= 5) return true; }
    else if (d === 0) { /* duplicate rank */ }
    else streak = 1;
  }
  return false;
}
function classify5(cards: string[]): Category {
  const rc = rankCounts(cards);
  const sc = suitCounts(cards);
  const counts = Object.values(rc).sort((a, b) => b - a);
  const flush = Object.values(sc).some((v) => v >= 5);
  const straight = isStraight(cards.map((c) => c[0]));
  if (flush && straight) return "Straight Flush";
  if (counts[0] === 4) return "Quads";
  if (counts[0] === 3 && counts[1] === 2) return "Full House";
  if (flush) return "Flush";
  if (straight) return "Straight";
  if (counts[0] === 3) return "Trips";
  if (counts[0] === 2 && counts[1] === 2) return "Two Pair";
  if (counts[0] === 2) return "Pair";
  return "High Card";
}
function chooseN(arr: string[], n: number): string[][] {
  const res: string[][] = [];
  function rec(s: number, p: string[]) {
    if (p.length === n) { res.push([...p]); return; }
    for (let i = s; i < arr.length; i++) { p.push(arr[i]); rec(i + 1, p); p.pop(); }
  }
  rec(0, []); return res;
}
function bestCategory(hole: string[], board: string[]): Category {
  const all = [...hole, ...board];
  if (all.length < 5) return "High Card";
  let best: Category = "High Card", br = -1;
  for (const five of chooseN(all, 5)) {
    const c = classify5(five); const r = CAT_ORDER[c];
    if (r > br) { br = r; best = c; }
  }
  return best;
}
function conflicts(card: string, used: Set<string>) { return used.has(card); }

// suited ラベルのコンボが「点灯中のスート」に含まれるか（offsuit & pair は常に許可）
function suitedAllowedByFilter(lab: string, combo: string[], active: Set<string>): boolean {
  if (lab.length === 3 && lab[2] === "s") {
    // comboは ["Ah","4h"] のように同スート。1枚目のスートでOK
    const suit = combo[0][1] as "c"|"d"|"h"|"s";
    return active.has(suit);
  }
  return true; // ペア＆オフスートはフィルタ無効
}


// --- Draw helpers ---
const RANK_TO_NUM: Record<string, number> = { "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14 };
function straightPresence(cards: string[]) {
  const p = new Set<number>();
  for (const c of cards) p.add(RANK_TO_NUM[c[0]]);
  if (p.has(14)) p.add(1); // Aロー
  return p;
}
function hasOESD(cards: string[]): boolean {
  const p = straightPresence(cards);
  for (let start = 1; start <= 11; start++) {
    if (p.has(start) && p.has(start+1) && p.has(start+2) && p.has(start+3)) return true;
  }
  return false;
}
function hasGutshot(cards: string[]): boolean {
  const p = straightPresence(cards);
  for (let start = 1; start <= 10; start++) {
    let cnt = 0;
    for (let k = 0; k < 5; k++) if (p.has(start + k)) cnt++;
    if (cnt === 4) return true;
  }
  return false;
}
function hasFlushDraw(cards: string[]): boolean {
  const s = suitCounts(cards);
  const max = Math.max(...Object.values(s));
  return max === 4; // 4枚同スート → 1枚でフラッシュ
}
function hasBackdoorFlushDraw(cards: string[], boardLen: number): boolean {
  if (boardLen !== 3) return false; // フロップのみ表示
  const s = suitCounts(cards);
  const max = Math.max(...Object.values(s));
  return max === 3; // 3枚同スート → ランナーランナー
}

/* ===================== App ===================== */
export default function App() {
  const [scenario, setScenario] = useState<Scenario>("OPEN");
  const [pos, setPos] = useState<ThreePos>("BTN");
  const [range, setRange] = useState<Set<string>>(new Set());
  const [hero, setHero] = useState<string[]>([]);
  const [board, setBoard] = useState<string[]>([]);
  const [custom, setCustom] = useState<string>("");
  // ★ suited の集計用スートフィルタ（複数選択可）
const [activeSuits, setActiveSuits] = useState<Set<string>>(
  new Set(["c","d","h","s"])
);

function toggleSuit(suit: "c" | "d" | "h" | "s") {
  setActiveSuits(prev => {
    const n = new Set(prev);
    if (n.has(suit)) n.delete(suit); else n.add(suit);
    return n;
  });
}


  // シナリオ変更で pos を自動補正
  useEffect(() => {
    const valids = VALID_POS[scenario];
    if (!valids.includes(pos)) setPos(valids[0]);
  }, [scenario]); // posを依存に入れない（無限ループ回避）

  const used = useMemo(() => new Set([...hero, ...board]), [hero, board]);

  // 残りコンボ（ブロッカー考慮）
  const remainingPerLabel = useMemo(() => {
    const m: Record<string, number> = {};
    for (const lab of range) {
      let cnt = 0;
      for (const c of LABEL_TO_COMBOS[lab]) {
        if (!suitedAllowedByFilter(lab, c, activeSuits)) continue; // ★ 追加
        if (!conflicts(c[0], used) && !conflicts(c[1], used)) cnt++;
      }
      m[lab] = cnt;
    }
    return m;
  }, [range, used, activeSuits]); // ★ 依存に activeSuits を追加
  

  /* ---- ALL-IN-ONE 集計：合計コンボ数 + 役/ドローの件数 ---- */
// どこか上のほうで一度だけ宣言（まだ無ければ）
type DrawKey = "FD" | "OESD" | "Gutshot" | "BDFD";

const agg = useMemo(() => {
  const catCounts: Record<Category, number> = {
    "High Card": 0, Pair: 0, "Two Pair": 0, Trips: 0,
    Straight: 0, Flush: 0, "Full House": 0, Quads: 0, "Straight Flush": 0,
  };

  // ★ ここで定義（外側は消す）
  const drawCounts: Record<DrawKey, number> = {
    FD: 0, OESD: 0, Gutshot: 0, BDFD: 0
  };

  let total = 0;

  for (const lab of range) {
    for (const c of LABEL_TO_COMBOS[lab]) {
      if (!suitedAllowedByFilter(lab, c, activeSuits)) continue; // スートフィルタ
      if (conflicts(c[0], used) || conflicts(c[1], used)) continue;

      total++;

      if (board.length >= 3) {
        const cards = [...c, ...board];
        const cat = bestCategory(c, board);
        catCounts[cat]++;
        if (hasFlushDraw(cards)) drawCounts.FD++;
        if (hasOESD(cards))    drawCounts.OESD++;
        if (hasGutshot(cards)) drawCounts.Gutshot++;
        if (hasBackdoorFlushDraw(cards, board.length)) drawCounts.BDFD++;
      }
    }
  }

  return { totalCombos: total, catCounts, drawCounts };
}, [range, used, board, activeSuits]); // activeSuits を依存に含める


  
  const totalCombos = agg.totalCombos;
  // 集計済みの役カウントから割合（%）を作る
const categoryPercents = useMemo(() => {
  const sum = Object.values(agg.catCounts).reduce((a, b) => a + b, 0) || 1;
  // out の型は Category をキーにした number
  const out: Record<Category, number> = { ...agg.catCounts } as Record<Category, number>;
  (Object.keys(out) as Category[]).forEach(k => {
    out[k] = (agg.catCounts[k] / sum) * 100;
  });
  return out;
}, [agg]);



const drawPercents = useMemo(() => {
  const denom = agg.totalCombos || 1; // Remaining Combos を分母に
  return {
    FD: (agg.drawCounts.FD / denom) * 100,
    OESD: (agg.drawCounts.OESD / denom) * 100,
    Gutshot: (agg.drawCounts.Gutshot / denom) * 100,
    BDFD: (agg.drawCounts.BDFD / denom) * 100,
  };
}, [agg]);


function getPresetText(sc: Scenario, p: ThreePos): string | null {
  switch (sc) {
    case "OPEN":
      return PRESETS.open[p as Pos] ?? null;
    case "BBvsOPEN":
      return PRESETS.bbCallVs[p as VsOpenPos] ?? null;
    case "SB_3BET":
      return PRESETS.sb3bet[p as Sb3betPos] ?? null;
    case "BB_3BET":
      return PRESETS.bb3bet[p as "BTN" | "EP"] ?? null;
    case "BB_SB_CALL_3BET": 
      return PRESETS.bbsbCall3bet[p as BbSbCall3betPos] ?? null;
    case "BTN_3BET":
      return PRESETS.btn3bet[p as Pos] ?? null;
    default:
      return null;
  }
}


  function applyPreset(txt: string) {
    const labs = parseRangeString(txt);
    setRange(new Set(labs));
  }
  function toggleCell(lab: string) {
    setRange(prev => { const n = new Set(prev); if (n.has(lab)) n.delete(lab); else n.add(lab); return n; });
  }
  function addCard(to: "hero" | "board", card: string) {
    if (used.has(card)) return;
    if (to === "hero" && hero.length >= 2) return;
    if (to === "board" && board.length >= 5) return;
    if (to === "hero") setHero([...hero, card]); else setBoard([...board, card]);
  }
  function removeCard(to: "hero" | "board", idx: number) {
    if (to === "hero") setHero(hero.filter((_, i) => i !== idx));
    else setBoard(board.filter((_, i) => i !== idx));
  }

  // ---- UI：縦スク前提レイアウト --------------------------------

  // シナリオタブ（Scenario 型に合わせてIDは大文字）
  const scenarioTabs = [
    { id: "OPEN", label: "オープン" },
    { id: "BBvsOPEN", label: "BBコール" },
    { id: "SB_3BET", label: "SB 3bet" },
    { id: "BB_3BET", label: "BB 3bet" },
    { id: "BB_SB_CALL_3BET", label: "3betにコール(BB/SB)" },
    { id: "BTN_3BET", label: "BTN 3bet" },
  ] as const;

{/* ---- Suit Filter (suited only) ---- */}
<div className="flex items-center gap-2 mb-2">
  <span className="text-xs text-gray-500 mr-1">Suited filter:</span>
  {(["c","d","h","s"] as const).map(s => (
    <button
      key={s}
      onClick={() => toggleSuit(s)}
      className={[
        "px-3 py-1 rounded-lg border text-base font-semibold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
        activeSuits.has(s)
          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      ].join(" ")}
      title={
        s==="c" ? "♣ clubs" :
        s==="d" ? "♦ diamonds" :
        s==="h" ? "♥ hearts" : "♠ spades"
      }
    >
      {SUIT_GLYPH[s]}
    </button>
  ))}
  <button
    onClick={() => setActiveSuits(new Set(["c","d","h","s"]))}
    className="ml-2 px-2 py-1 rounded-md text-xs border bg-white hover:bg-gray-50"
    title="全スートON"
  >
    reset
  </button>
</div>


  // 簡易レンジ表（見た目のみ）
  const RangeGrid = () => (
    <div style={{ display: "inline-block", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          {GRID_LABELS.map((row, i) => (
            <tr key={i}>
              {row.map((lab, j) => {
                const on = range.has(lab);
                const rem = remainingPerLabel[lab] ?? (lab.length === 2 ? 6 : lab[2] === "s" ? 4 : 12);
                const pair = on ? "#FDE68A" : "#FEF3C7";    // amber 300/200
                const suited = on ? "#BFDBFE" : "#DBEAFE";  // blue 300/200
                const offsuit = on ? "#A7F3D0" : "#D1FAE5"; // emerald 300/200
                const bg = i === j ? pair : (j > i ? suited : offsuit);

                return (
                  <td key={j} style={{ padding: 0 }}>
                    <button
                      onClick={() => toggleCell(lab)}
                      title={`${lab} (残り${rem}コンボ)`}
                      style={{
                        width: 36, height: 36,
                        background: bg,
                        border: on ? "2px solid #3b82f6" : "1px solid #d1d5db",
                        opacity: on ? 1 : 0.7,
                        transform: on ? "scale(1.02)" : "none",
                        transition: "all 120ms ease",
                        fontSize: 11, fontWeight: 700, lineHeight: 1, color: "#111827",
                      }}
                    >
                      <div>{lab}</div>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{rem}</div>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <ResponsiveShell
      left={
        <>
          <h1 className="text-xl font-bold mb-2">シナリオ</h1>
          <ScenarioTabsWrap
            items={scenarioTabs as unknown as { id: string; label: string }[]}
            value={scenario as unknown as string}
            onChange={(id) => setScenario(id as Scenario)}
          />

          {/* Position 選択 & プリセット適用 */}
          <div className="mt-4 grid grid-cols-3 gap-2">
  {VALID_POS[scenario].map((p) => {
    const active = p === pos;
    return (
      <button
        key={p}
        onClick={() => setPos(p)}
        aria-pressed={active}
        className={[
          "h-10 rounded-xl border px-3 text-sm transition",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
          active
            ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300"
            : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50 active:scale-[0.98]"
        ].join(" ")}
      >
        {p}
      </button>
    );
  })}
</div>

<div className="mt-3 flex gap-2">
  <button
    className="h-10 rounded-xl border px-3 bg-blue-600 text-white border-blue-600 hover:bg-blue-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    onClick={() => {
      const txt = getPresetText(scenario, pos);
      if (txt) applyPreset(txt);
    }}
  >
    プリセット適用
  </button>
  <button
    className="h-10 rounded-xl border px-3 bg-white text-gray-800 border-gray-300 hover:bg-gray-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    onClick={() => setRange(new Set())}
  >
    クリア
  </button>
</div>

{/* --- スートフィルタ（♣♦♥♠） -------------------------------------- */}
<div className="mt-4">
  <div className="mb-1 text-sm text-gray-500">Suited 集計に含めるスート</div>

  <div className="flex items-center gap-2">
    {(['c','d','h','s'] as const).map((s) => {
      const on = activeSuits.has(s);
      const glyph = { c:'♣', d:'♦', h:'♥', s:'♠' }[s];
      const color = { c:'text-gray-900', d:'text-red-600', h:'text-red-600', s:'text-gray-900' }[s];

      return (
        <button
          key={s}
          onClick={() => toggleSuit(s)}
          aria-pressed={on}
          title={`${glyph} を${on ? '除外' : '含める'}`}
          className={[
            'w-10 h-10 rounded-full border transition flex items-center justify-center text-xl',
            on
              ? 'bg-yellow-200 border-yellow-500 shadow-inner'
              : 'bg-white border-gray-300 hover:bg-gray-50'
          ].join(' ')}
        >
          <span className={color}>{glyph}</span>
        </button>
      );
    })}

    {/* すべてON / すべてOFF ショートカット */}
    <button
      onClick={() => setActiveSuits(new Set(['c','d','h','s']))}
      className="ml-2 h-10 px-3 rounded-xl border bg-white hover:bg-gray-50 text-sm"
      title="すべてオン"
    >
      すべて
    </button>
    <button
      onClick={() => setActiveSuits(new Set())}
      className="h-10 px-3 rounded-xl border bg-white hover:bg-gray-50 text-sm"
      title="すべてオフ"
    >
      なし
    </button>
  </div>
</div>

{/* レンジ表 */}
<h2 className="mt-5 text-lg font-semibold">レンジ</h2>
<RangeGrid />



          {/* 任意レンジ貼り付け */}
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-1">
              Paste Range (例: <code>22+,A2s+,KTo+,T9s-87s</code>)
            </div>
            <div className="flex gap-2">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="22+, A2s+, KTo+, T9s-87s ..."
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <button
                className="h-10 rounded-xl border px-3"
                onClick={() => { if (custom.trim()) applyPreset(custom); }}
              >
                適用
              </button>
            </div>
          </div>

          {/* カード選択 */}
          <div className="mt-4 grid gap-3">
            <CardSelector title="Hero" cards={hero} max={2} used={used} onAdd={(c) => addCard("hero", c)} onRemove={(i) => removeCard("hero", i)} />
            <CardSelector title="Board" cards={board} max={5} used={used} onAdd={(c) => addCard("board", c)} onRemove={(i) => removeCard("board", i)} />
          </div>
        </>
      }

      center={
        <>
          <h2 className="text-lg font-semibold mb-2">レンジ</h2>
          <RangeGrid />

          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 my-4">
            <Stat label="Remaining Combos" value={String(totalCombos)} />
            <Stat label="Selected Hands" value={String(range.size)} />
          </div>

          {/* Hand Breakdown */}
          <div className="p-3 border rounded-xl bg-white">
            <div className="font-semibold mb-2">
              Made Hand Breakdown {board.length >= 3 ? "(on current board)" : "(needs flop)"}
            </div>
            <ul className="grid grid-cols-2 gap-1 text-sm m-0 p-0 list-none">
              {(["Straight Flush","Quads","Full House","Flush","Straight","Trips","Two Pair","Pair","High Card"] as Category[]).map((k) => (
                <li key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span className="text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {agg.catCounts[k]} / {categoryPercents[k].toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Draw Breakdown */}
          <div className="p-3 border rounded-xl bg-white mt-3">
            <div className="font-semibold mb-2">
              Draw Breakdown {board.length >= 3 ? "(current board)" : "(needs flop)"}
            </div>
            <ul className="grid grid-cols-2 gap-1 text-sm m-0 p-0 list-none">
              <li className="flex justify-between">
                <span>Flush Draw</span>
                <span className="text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>{agg.drawCounts.FD} / {drawPercents.FD.toFixed(1)}%</span>
              </li>
              <li className="flex justify-between">
                <span>OESD</span>
                <span className="text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>{agg.drawCounts.OESD} / {drawPercents.OESD.toFixed(1)}%</span>
              </li>
              <li className="flex justify-between">
                <span>Gutshot</span>
                <span className="text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>{agg.drawCounts.Gutshot} / {drawPercents.Gutshot.toFixed(1)}%</span>
              </li>
              <li className="flex justify-between">
                <span>Backdoor FD</span>
                <span className="text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>{agg.drawCounts.BDFD} / {drawPercents.BDFD.toFixed(1)}%</span>
              </li>
            </ul>
          </div>

          {/* Combo Details */}
          <div className="p-3 border rounded-xl bg-white mt-3">
            <div className="font-semibold mb-2">Combo Details</div>
            <div className="max-h-64 overflow-auto grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-sm">
              {Array.from(range).sort((a, b) => handSort(a) - handSort(b)).map((lab) => (
                <React.Fragment key={lab}>
                  <span>{lab}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{remainingPerLabel[lab] ?? 0}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </>
      }

      right={<div />}

      footer={
        <>
          <button className="h-11 rounded-xl border">フィルタ</button>
          <button className="h-11 rounded-xl border">シナリオ</button>
          <button className="h-11 rounded-xl border">判定</button>
        </>
      }
    />
  );
}

/* ===================== UI Parts ===================== */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-xl p-3 bg-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CardSelector({
  title, cards, max, used, onAdd, onRemove
}:{
  title: string; cards: string[]; max: number; used: Set<string>; onAdd: (card: string) => void; onRemove: (i: number) => void;
}) {
  const disabled = cards.length >= max;
  return (
    <div className="p-2 border rounded-xl bg-white">
      <div className="text-sm text-gray-600 mb-1">
        {title} Cards ({cards.length}/{max})
      </div>

      {/* 選択済みカード */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {cards.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 border rounded-full bg-gray-100 text-sm">
            <SmallCard card={c} w={26} />
            <button onClick={() => onRemove(i)} className="text-red-600 font-bold">×</button>
          </span>
        ))}
      </div>

      {/* 4行×13列 */}
      <div className="grid" style={{ gridTemplateRows:"repeat(4, auto)", rowGap: 4, maxHeight: 170, overflow: "auto" }}>
        {(["c","d","h","s"] as const).map((suit) => (
          <div key={suit} className="grid" style={{ gridTemplateColumns:"repeat(13, 1fr)", columnGap: 4 }}>
            {RANKS.map((r) => {
              const card = r + suit;
              const isUsed = used.has(card) || disabled;
              return (
                <button
                  key={card}
                  onClick={() => !isUsed && onAdd(card)}
                  disabled={isUsed}
                  title={card.toUpperCase()}
                  className="border rounded bg-white p-0.5"
                  style={{ cursor: isUsed ? "not-allowed" : "pointer", opacity: isUsed ? 0.35 : 1 }}
                >
                  <SmallCard card={card} w={26} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SmallCard({ card, w = 26 }: { card: string; w?: number }) {
  const r = card[0]; const s = card[1];
  const color = SUIT_COLOR[s]; const glyph = SUIT_GLYPH[s];
  const h = Math.round(w * 1.45);
  return (
    <div
      style={{
        width: w,
        height: h,
        border: "1px solid #d1d5db",
        borderRadius: 4,
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        background: "#fff",
        boxShadow: "0 1px 1px rgba(0,0,0,0.04)",
        color,
      }}
    >
      <div style={{ padding: "1px 2px", fontWeight: 800, fontSize: Math.max(9, Math.round(w * 0.45)) }}>{r}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(10, Math.round(w * 0.7)) }}>{glyph}</div>
      <div style={{ padding: "0 2px 1px", display: "flex", justifyContent: "flex-end", fontSize: Math.max(9, Math.round(w * 0.45)) }}>{glyph}</div>
    </div>
  );
}

function handSort(lab: string) {
  if (lab.length === 2) return -(RANK_ORDER[lab[0]] * 100 + 50);
  const a = lab[0], b = lab[1];
  const base = RANK_ORDER[a] * 100 + RANK_ORDER[b];
  return -(base + (lab[2] === "s" ? 10 : 0));
}
