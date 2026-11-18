# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/kaixyzz/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/kaixyzz/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Kestrel Radar ranks every protocol DefiLlama tracks that records no token yet by what its launch would be worth, from a sealed snapshot alone — and shows how to farm each one. The board covers the whole watchlist plus the early pre-token protocols below the floor, with a detail view, filters, and a model sandbox that re-ranks the board live.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Node 22.18 or later, standard library only, no network. The program reads the sealed snapshot, writes the ranked board to `board.json`, the dashboard data to `data.js`, and copies `dashboard/` and `screenshots/` into the output directory with a `dossier.json` summary.

---

<sub>Entered on [make.fun](https://make.fun/?ref=vtc8r25b&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
