// engine/src/rating.ts: Glicko-2 (Glickman, "Example of the Glicko-2 system") and seasons (section 8).
interface Rating {
  r: number;
  rd: number;
  vol: number;
}
// One game of a rating period: the opponent's rating and RD, and the score against them.
interface Game {
  r: number;
  rd: number;
  score: 0 | 0.5 | 1;
}

export const START: Rating = { r: 1500, rd: 350, vol: 0.06 };
const TAU = 0.5;
const SCALE = 173.7178;

// RD grows for the days since the player's last rated game in the pool, up to the starting RD. Days below zero (a
// last_at after the game's own time, as when games are rated again after a restore) or missing (NaN) grow nothing.
export function idle(p: Rating, days: number): Rating {
  const phi = p.rd / SCALE;
  return { ...p, rd: Math.min(START.rd, SCALE * Math.sqrt(phi * phi + Math.max(0, days || 0) * p.vol * p.vol)) };
}

// One rating period. Each game is its own period (section 8); the paper's example has three games in one.
export function rate(p: Rating, games: readonly Game[]): Rating {
  const mu = (p.r - 1500) / SCALE;
  const phi = p.rd / SCALE;
  let info = 0;
  let gain = 0;
  for (const { r, rd, score } of games) {
    const g = 1 / Math.sqrt(1 + (3 * (rd / SCALE) ** 2) / Math.PI ** 2);
    const e = 1 / (1 + Math.exp(-g * (mu - (r - 1500) / SCALE)));
    info += g * g * e * (1 - e);
    gain += g * (score - e);
  }
  const v = 1 / info;
  const vol = volatility(phi * phi, v, (v * gain) ** 2, p.vol);
  const after = 1 / Math.sqrt(1 / (phi * phi + vol * vol) + 1 / v);
  return { r: 1500 + SCALE * (mu + after * after * gain), rd: SCALE * after, vol };
}

// Step 5 of the paper: the new volatility by the Illinois algorithm, from φ², v and Δ².
function volatility(phi2: number, v: number, delta2: number, sigma: number): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number) =>
    (Math.exp(x) * (delta2 - phi2 - v - Math.exp(x))) / (2 * (phi2 + v + Math.exp(x)) ** 2) - (x - a) / TAU ** 2;
  // The paper steps down from a - τ while f stays negative; f(a - kτ) > 2k - 1/2 at τ = 0.5, so a - τ brackets.
  let lo = a;
  let hi = delta2 > phi2 + v ? Math.log(delta2 - phi2 - v) : a - TAU;
  let fLo = f(lo);
  let fHi = f(hi);
  while (Math.abs(hi - lo) > 1e-6) {
    const c = lo + ((lo - hi) * fLo) / (fHi - fLo);
    const fC = f(c);
    if (fC * fHi <= 0) {
      lo = hi;
      fLo = fHi;
    } else fLo /= 2;
    hi = c;
    fHi = fC;
  }
  return Math.exp(lo / 2);
}

// The season of a time: calendar quarters in UTC, numbered from the launch quarter as season 1. The launch quarter,
// 2027 Q1, is an assumption that M12 confirms before the first rated public game.
const LAUNCH = 2027 * 4;
export function seasonOf(ms: number): number {
  const d = new Date(ms);
  return d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3) - LAUNCH + 1;
}
