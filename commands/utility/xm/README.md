# BTCUSD MT5 Market Data Analyzer (console only)

Standalone read-only analyzer for the existing Discord.js XM/MT5 project. It does not edit `xm.js` and does not place trades.

## Files

- `analysis/config.js` — symbol, timeframes, lookback and algorithm settings.
- `analysis/marketData.js` — validates/sorts MT5 OHLC candles and excludes the newest possibly-forming candle from calculations.
- `analysis/statistics.js` — OHLC period stats, candle ranges, ATR(14) using Wilder smoothing, close-return standard deviation, bull/bear counts and tick volume.
- `analysis/swings.js` — confirmed swing highs/lows using left/right candle comparisons; confirmation requires later closed bars.
- `analysis/zones.js` — clusters swing prices using ATR tolerance, assigns support/resistance *candidates* based on current price, checks possible role flips, and applies a gradual freshness penalty to old zones.
- `analysis/report.js` — readable Thai console report.
- `analysis/run.js` — fetches M15/H1 first, aligns calculations to the latest shared closed-bar cutoff, prints reports and exports CSV/JSON.
- `data/` — output folder created automatically.

## Install into the existing project

Copy the `analysis` folder into:

`C:\github\whatever\commands\utility\xm\analysis`

The existing `mt5Service.js` must be at:

`C:\github\whatever\commands\utility\xm\mt5Service.js`

This project expects it to export `getCandles(symbol, timeframe, count)` and return a payload shaped like:

`{ symbol, timeframe, digits, candles: [{ time, open, high, low, close, tick_volume, spread, real_volume }] }`

## Run

From the project root (`C:\github\whatever`):

```powershell
node .\commands\utility\xm\analysis\run.js
```

Or from the XM folder:

```powershell
node .\analysis\run.js
```

Outputs go to `commands/utility/xm/data/`:

- `*_candles.csv` — all received OHLCV candles, with a column marking whether each candle was included in calculations.
- `*_swings.csv` — confirmed swing points and subsequent reversal size.
- `*_zones.csv` — zones, location relative to current price, distance, touches and heuristic score.
- `*_summary.json` — settings, statistics, swing points and zones in machine-readable form.

## Important interpretation notes

- MT5 candle timestamps are Unix seconds; CSV includes a Bangkok-local datetime column for convenience.
- The newest candle is excluded from calculations because it may still be forming. It remains in the raw CSV and is marked `included_in_analysis=false`. With timeframe synchronization enabled, other closed bars newer than the shared cutoff are also excluded from the synchronized calculation window.
- Support/resistance are labelled as candidates by their position relative to the latest closed price. Swing-origin labels alone do not prove that a level is currently support or resistance.
- M15 and H1 calculations are aligned to a shared cutoff time when both timeframes were fetched successfully. The candle timestamp is treated as its OPEN time; only bars whose end time is at or before the cutoff are included. This improves same-time comparisons, but does not make separately sampled broker data perfectly identical.
- Old zones remain visible for auditing but their score is gradually reduced by an age-based freshness factor. `rawScore` is the score before the age penalty; `score` is after it. This is a configurable heuristic, not an empirically optimized decay rate.
- A zone score is an internal heuristic, not a probability, not a tested strategy, and not a trade signal. Compare results with the chart before deciding whether the rules are useful.
- This code uses Node.js CommonJS and assumes the existing bridge service works.

## Updated in v4: merged support/resistance zones and shared cutoff

The support/resistance generator fetches all configured timeframes, chooses one shared cutoff based on the earliest last-closed candle end, and excludes candles ending after that cutoff. Nearby/overlapping swing clusters are merged when the gap is at most 0.12 ATR, with a maximum merged zone width of 0.85 ATR. This is a transparent starting heuristic, not an optimized setting. The CSV stays price-sorted low-to-high within each side; rank is based on heuristic score, with distance used as a tie-breaker. JSON also contains the top five ranked candidates per side.

## New: separate support/resistance lists

Run from project root:

```powershell
node .\commands\utility\xm\analysis\supportResistance.js
```

It writes one CSV and one JSON per timeframe into `commands/utility/xm/data/`. Supports and resistances are split into separate lists and each list is sorted by price from low to high. Columns include zone low/high, midpoint, distance from current price, touch count, heuristic score and age. If the latest close is inside a zone, it is listed separately as `current_price_inside_zone` instead of mislabeling it support or resistance.

## New: walk-forward swing-level reaction test

Run from project root:

```powershell
node .\commands\utility\xm\analysis\backtest.js
```

This is a descriptive historical level-reaction test, not a profit/loss strategy backtest. Each swing level only becomes available at its confirmation time; subsequent candles are used to measure the first observable outcome after touch. If the target and a close-through condition occur in the same OHLC candle, the result is marked `ambiguous_same_bar` because OHLC cannot show which happened first. Results are written to CSV plus a JSON summary.

Optional settings in PowerShell:

```powershell
$env:BTC_BACKTEST_FORWARD_BARS = "20"
$env:BTC_BACKTEST_REACTION_ATR = "1"
$env:BTC_BACKTEST_BREAK_BUFFER_ATR = "0.1"
node .\commands\utility\xm\analysis\backtest.js
```

- `FORWARD_BARS`: number of closed candles after confirmation to observe.
- `REACTION_ATR`: favorable move required to count as a reaction.
- `BREAK_BUFFER_ATR`: close-through buffer beyond the zone.

Important: results are only as representative as the fetched MT5 history (currently configured for 500 candles per timeframe). The newest cases may not have the full forward window and are identified in the CSV/summary. This is not evidence of a profitable trading method.


## Updated in v5: comparable lookback and clearer candidate quality

- M15 requests 2,000 candles while H1 requests 500, so both aim at roughly 21 calendar days rather than comparing ~5 days of M15 with ~21 days of H1. Actual start/end timestamps and candle counts are recorded in JSON; broker history availability can still shorten one timeframe.
- CSV/JSON retain low-confidence levels for auditability, but now mark each zone `confidence` (`normal`, `aged`, `low`) and `stale`. Single-touch levels are low confidence; old levels are marked stale rather than silently treated as strong.
- JSON includes `nearestSupports` / `nearestResistances` sorted by distance separately from `topSupports` / `topResistances` sorted by heuristic rank. Distance and quality are different questions.
- Backtest uses a shared cutoff across timeframes and reports rates excluding ambiguous same-bar outcomes, plus full-forward-window-only rates. These are still level-reaction statistics, not strategy profitability or a trade signal.

If the MT5 bridge cannot provide 2,000 M15 candles, the script will analyze whatever valid count the service returns and record the actual period. Check the JSON `lookback` section instead of assuming both spans matched.
