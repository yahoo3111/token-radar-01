// Token Radar, model radar-2.
//
// One sealed snapshot in, one ranked board out. The board ranks only protocols
// whose snapshot record shows no token (no market cap, no CoinGecko id, no
// symbol). Live-token protocols are set aside with their market caps, never
// ranked as if they were still to launch.
//
// Implied value is a claim built only from the snapshot's own figures:
//
//   implied = round( TVL x categoryMultiple
//                    x growthMult x maturityMult x chainMult )
//   capped at $5,000,000,000, floored at $1.
//
//   categoryMultiple  a per-category multiple of TVL, 0.08-0.34. Categories
//                     whose product is a derivative of a token that already
//                     trades (Bridge, Canonical Bridge, Liquid Staking,
//                     Liquid Restaking, Restaked BTC) get 0.08: their launch,
//                     if any, is not a fresh token. Lending and DEX-style
//                     protocols, where a token most often captures fees,
//                     get the highest multiples. No protocol name is ever
//                     special-cased.
//   growthMult        1 + clamp(change_7d, -50, 150)/100 x weight, weight
//                     0.6 on growth, 0.8 on shrinkage (a falling TVL hurts
//                     faster than a rising one helps). Missing change_7d = 0.
//   maturityMult      0.55 + min(age_days, 1460)/1460 x 0.45. Age is days
//                     since listed_at, the record of how long a protocol has
//                     run with no token; unknown age uses 180 days.
//   chainMult         1 + 0.03 x min(chains-1, 5), at most 1.15: a protocol
//                     live on more chains has a wider distribution to farm.
//
// The watchlist (40 slugs at or above the $50M floor) is the floor, never
// the ceiling: the board adds every pre-token protocol below the floor the
// rankable rule admits, by TVL, up to EARLY_ROWS. Rankable here means
// pre-token, not a CEX, and not a versioned pool (name ending V2 / 2.0 and
// the like). That admits 186 early rows on this snapshot, for 226 rows in
// all. Derivative-category rows are admitted too, but at the 0.08 multiple
// and flagged derivative: true, so the reader can see why they rank low.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  growth_weight_up: number;
  growth_weight_down: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max_extra: number;
  implied_cap_usd: number;
}

export const MODEL: ModelConstants = {
  growth_weight_up: 0.6,
  growth_weight_down: 0.8,
  growth_floor: -50,
  growth_cap: 150,
  maturity_floor: 0.55,
  maturity_range: 0.45,
  maturity_days: 1460,
  unknown_age_days: 180,
  chain_step: 0.03,
  chain_max_extra: 5,
  implied_cap_usd: 5_000_000_000,
};

export const MODEL_VERSION = 'radar-2';
export const EARLY_ROWS = 200;
export const LIVE_ROWS = 24;

/** TVL multiple by category. Derivative categories sit at 0.08 on purpose. */
export const CATEGORY_MULTIPLE: Record<string, number> = {
  Dexs: 0.34,
  Derivatives: 0.32,
  Lending: 0.3,
  CDP: 0.28,
  Yield: 0.28,
  'Yield Aggregator': 0.27,
  'Risk Curators': 0.26,
  'Onchain Capital Allocator': 0.26,
  'Collateral Markets': 0.26,
  'Basis Trading': 0.24,
  CeDeFi: 0.24,
  RWA: 0.22,
  Payments: 0.22,
  Insurance: 0.22,
  'Staking Pool': 0.2,
  Restaking: 0.2,
  Chain: 0.2,
  'Governance Incentives': 0.18,
  'Stablecoin Wrapper': 0.18,
  Bridge: 0.08,
  'Canonical Bridge': 0.08,
  'Liquid Staking': 0.08,
  'Liquid Restaking': 0.08,
  'Restaked BTC': 0.08,
};

export const DEFAULT_MULTIPLE = 0.25;

export function categoryMultiple(category: string | null): number {
  if (category === null) return 0.22;
  return CATEGORY_MULTIPLE[category] ?? DEFAULT_MULTIPLE;
}

export function isDerivativeCategory(category: string | null): boolean {
  return category !== null && categoryMultiple(category) === 0.08;
}

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  derivative: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  derivative: boolean;
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): { implied: number; catMult: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = typeof protocol.change_7d === 'number' && Number.isFinite(protocol.change_7d) ? protocol.change_7d : 0;
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const weight = growthPct >= 0 ? model.growth_weight_up : model.growth_weight_down;
  const growthMult = 1 + (growthPct / 100) * weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainCount = Math.max(1, protocol.chains.length);
  const chainMult = 1 + model.chain_step * Math.min(chainCount - 1, model.chain_max_extra);
  const catMult = categoryMultiple(protocol.category);
  const implied = Math.max(
    1,
    Math.min(model.implied_cap_usd, Math.round(protocol.tvl_usd * catMult * growthMult * maturityMult * chainMult)),
  );
  return { implied, catMult, growthPct, growthMult, maturityMult, chainMult, age };
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Rankable: records no token, is not a CEX, and is not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    derivative: isDerivativeCategory(s.p.category),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: s.catMult,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

interface Plan {
  action: string;
  second: string;
  risk: string;
}

/** Category-specific plan: core action, a second qualifying action, and the risk to check. */
function planFor(p: SnapshotProtocol, capital: number, chain: string): Plan {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateralized')) {
    return {
      action: `Supply $${capital} of USDC to ${name} on ${chain} and keep the loan position open.`,
      second: `Borrow a small amount against the deposit on ${name}, then repay it in the same week.`,
      risk: `Check the liquidation price on ${name} before you borrow: a sharp move in the collateral can liquidate a small position first.`,
    };
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('liquidity manager') || c.includes('farm')) {
    return {
      action: `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`,
      second: `Swap $25 through ${name} on ${chain} so the wallet shows both providing and trading activity.`,
      risk: `Check impermanent loss on ${name}'s pool before you add liquidity: a one-sided price move can cost more than the fees you earn.`,
    };
  }
  if (c.includes('bridge')) {
    return {
      action: `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`,
      second: `Bridge a second, smaller amount back the other way through ${name} a week later.`,
      risk: `Bridge transfers through ${name} can be delayed for hours: never bridge funds you need the same day, and check the destination address twice.`,
    };
  }
  if (c.includes('staking') || c.includes('restak')) {
    return {
      action: `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`,
      second: `Use the receipt token from ${name} in one low-risk position on ${chain}, such as a lending deposit, and keep it there.`,
      risk: `A liquid-staking receipt can trade below its peg: check the peg for ${name} on ${chain} before you stake, and note that this is a derivative product, not a fresh launch.`,
    };
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) {
    return {
      action: `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`,
      second: `Close the position on ${name} and open a second small one the following week, keeping the margin deposit in place.`,
      risk: `Check funding rates and the liquidation price on ${name} before every trade: leveraged positions can be liquidated in minutes.`,
    };
  }
  if (c.includes('prediction')) {
    return {
      action: `Fund $${capital} on ${name} and place one market position on ${chain}.`,
      second: `Place a second small position on a different market on ${name} the following week.`,
      risk: `Prediction markets resolve on an oracle's answer: read the market's resolution rule on ${name} before you bet, and never stake more than you can lose.`,
    };
  }
  if (c.includes('curator') || c.includes('allocator')) {
    return {
      action: `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`,
      second: `Deposit a second, smaller amount into a different ${name} vault on ${chain} so the wallet shows two allocations.`,
      risk: `A vault's strategy can change: read ${name}'s current allocation on ${chain} before you deposit, and check who curates it.`,
    };
  }
  if (c.includes('stable')) {
    return {
      action: `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`,
      second: `Use the stable asset in one payment or swap on ${chain} through ${name}'s app.`,
      risk: `Check the stable asset's peg and backing on ${name} before you mint: a depegged stablecoin can lose value even while the position looks open.`,
    };
  }
  if (c.includes('rwa')) {
    return {
      action: `Mint $${capital} of the yield asset on ${name} on ${chain} and hold it.`,
      second: `Test a small redemption of the yield asset on ${name} so the wallet shows both minting and redeeming.`,
      risk: `Real-world-asset products depend on an off-chain issuer: read ${name}'s redemption terms and the issuer's name before you mint.`,
    };
  }
  if (c.includes('insurance')) {
    return {
      action: `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`,
      second: `Renew or extend the cover on ${name} before it lapses, rather than letting it expire.`,
      risk: `Cover pays only on the policy's own terms: read what ${name} actually covers on ${chain}, and the claim deadline, before you buy.`,
    };
  }
  return {
    action: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    second: `Make a second qualifying action on ${name}, such as a swap, a vote or a second deposit, a week later.`,
    risk: `Check ${name}'s own page on ${chain} for unaudited contracts or paused deposits before you put money in, and start with the smallest amount that still qualifies.`,
  };
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time.
 * Every step names the protocol, its chain or its category, so no two
 * protocols' plans are the same text.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const plan = planFor(p, capital, chain);
  const gas = capital >= 150 ? 8 : 4;
  return [
    {
      text: `Open a fresh wallet for ${p.name} on ${chain} that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    { text: plan.action, cost: `$${capital} of capital and about $${gas} of gas`, time: '15 minutes to set up' },
    { text: plan.second, cost: 'about $2 to $5 of gas', time: '10 minutes' },
    { text: plan.risk, cost: 'nothing to check, and it can save the whole position', time: '10 minutes' },
    {
      text: `Hold the position for at least ${hold} days and make one qualifying action each week on ${p.name}, so the activity spans more than one snapshot.`,
      cost: `the $${capital} stays in the position, about $2 of gas a week`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page from the link it publishes and claim only there.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction for ${p.name} on ${chain} in a farm log, with an exit plan for unwinding the position.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    derivative: row.derivative,
    category_multiple: row.model.category_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
  };
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    watchlist: snapshot.watchlist,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}`;
  }
  for (const r of board) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
