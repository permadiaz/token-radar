# Token Radar

A token launch radar for the [Make.fun](https://make.fun) `token-radar-01`
competition: every protocol in a sealed DefiLlama snapshot that records no
token yet, ranked by what its token would be worth if its record stayed as
it is. Not a prediction of a launch — a watchlist, priced.

## What it is

- `main.ts` — Node 22, standard library only. Reads the sealed snapshot
  (`/input/snapshot.json`, or `--input <snapshot.json|directory>`), scores
  every rankable pre-token protocol, and writes:
  - `board.json` — the ranked board, rows 1..N by implied value
  - `data.js` — the dashboard's dataset, as one script
  - `dashboard/` — the static page (no network, no framework)
  - `screenshots/` — three screenshots of the page
  - `dossier.json` — what the judge reads, built by
    `vendor/makefun-board.ts`
- `lib/model.ts` — the model (radar-2) and the farm-plan generator
- `dashboard/` — `index.html`, `app.css`, `app.js`

## The model (radar-2)

Peer-calibrated, not a flat multiple. Every live-token protocol in the same
snapshot is a peer: its market cap over its TVL is what the market actually
pays per dollar of TVL.

```
multiple(cat) = (n * median(cat peers) + 10 * global median) / (n + 10)
multiple      = clamp(multiple, 0.05, 1.50)
growthMult    = 1 + clamp(change_7d, -50, 100) / 100 * 0.5
maturity      = 0.70 + min(age_days, 1460) / 1460 * 0.30   (age unknown: 365 days)
chains        = 1 + min(chains - 1, 4) * 0.02
implied       = max(1, round(tvl_usd * multiple * growthMult * maturity * chains))
```

The strong prior (10) and the 1.50 cap matter: some categories have a single
live peer (Risk Curators: only Api3 at 2.97x; Prediction Market: only Rain
at 400.2x), so a raw category median would be one protocol's price, not a
market. No protocol name is ever special-cased.

A protocol is rankable when it is pre-token and not a wrapped, staked or
bridged product of a token that already trades: categories Bridge, Canonical
Bridge, Liquid Staking, Liquid Restaking, Restaked BTC and CEX are out, as
are names containing a whole word "wrapped", "staked" or "staking", names
beginning with an exchange name, and versioned pool names (a trailing
`V2`, `v3` or `1.2`). That is the house's own watchlist rule, applied to
the early radar too: WBTC is Bitcoin on Ethereum, not a protocol waiting
on a launch of its own.

The board is the whole watchlist (40 protocols) plus every other rankable
pre-token protocol above a $50M TVL floor: 198 rows in this snapshot, out of
758 protocols. The 119 live-token protocols are set aside and used only as
peers — and to check the model against itself.

## The check (reported honestly in the dashboard)

Leave-one-out: every live-token peer is re-priced with its category
multiple computed without it, and compared with its real market cap.
On this snapshot (119 peers):

- median miss: 5.2x
- within 2x of the real cap: 24%
- within 3x of the real cap: 34%

The multiple is a yardstick for ranking, not a price target.

## The board

| Rank | Protocol | Implied value |
| --- | --- | --- |
| 1 | Steakhouse Financial | $1.18B |
| 2 | Sentora Curator | $1.15B |
| 3 | Gauntlet | $702M |
| 4 | Polymarket International | $478M |
| 5 | Veda | $278M |

Every row has a detail view (the model broken down line by line, the
live-token peers in its category) and a 6-step farm plan with a cost and a
time for each step. The board is searchable, filterable by category and
chain, sortable, and has a watchlist-only toggle. State lives in the URL
hash (`#detail=<slug>`, `#cat=<category>`, `#q=<text>`).

## Running it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

The program is deterministic: the same snapshot always writes the same
bytes. It uses no clock, no randomness and no network.

## Screenshots

- `screenshots/board.png` — the ranked board
- `screenshots/detail.png` — the detail view for #1, Steakhouse Financial
- `screenshots/filtered.png` — the board filtered to Risk Curators

## License

MIT. See `LICENSE`.
