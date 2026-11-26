# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/yahoo3111/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/yahoo3111/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: ranks 226 pre-token protocols by implied value from a sealed DefiLlama snapshot, with farm plans for each.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../kit/input/snapshot.json
```

Node 22.18 or later, standard library only, no network. `main.ts` writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. Open `out/dashboard/index.html` in a browser (it loads `../data.js`).

## The model (radar-2)

`implied = min($5B, round(TVL x categoryMultiple x growthMult x maturityMult x chainMult))`

- **categoryMultiple, 0.08–0.34 by category.** Lending and DEX-style protocols score highest; bridge and liquid-staking products score 0.08, because the underlying token already trades or the product is a derivative of one. No protocol name is special-cased.
- **growthMult:** `1 + clamp(change_7d, -50, 150)/100 x weight`, weight 0.6 on growth, 0.8 on shrinkage. Missing 7-day change counts as 0.
- **maturityMult:** `0.55 + min(age_days, 1460)/1460 x 0.45`. Age is days since `listed_at`; unknown age uses 180 days.
- **chainMult:** `1 + 0.03 x min(chains-1, 5)`, at most 1.15.

The board covers all 40 watchlist slugs (TVL at or above the $50M floor, no token on record) plus every rankable pre-token protocol below the floor — 186 early rows, 226 rows in all on this snapshot. Rankable means records no token, not a CEX, not a versioned pool.

Implied value is this entry's own claim, not a prediction that a token will be issued, or what it would trade at. A protocol "records no token"; that is not proof it has none.

## Farm plans

Each row carries 7 steps, each with a cost and a time, generated from the protocol's own category, chains, TVL and age: a core action, a second qualifying action, a category-specific risk to check, a hold period, a points/claim safety step, and a farm log with an exit plan. No plan is a copy of another protocol's: every step names the protocol, its chain or its category.

## Layout

- `main.ts` — entrypoint: reads the snapshot, writes the board, data and dossier
- `lib/model.ts` — the radar-2 model, farm plans, snapshot parsing, gate checks
- `vendor/makefun-board.ts` — make.fun's dossier library, as shipped in the kit
- `dashboard/` — static page: `index.html`, `app.css`, `app.js` (no network)
- `screenshots/` — board, detail and filtered views of the dashboard

---

<sub>Entered on [make.fun](https://make.fun/?ref=rnpejvxk&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
