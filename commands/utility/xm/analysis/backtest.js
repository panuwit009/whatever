'use strict';

// Walk-forward validation of confirmed swing levels. A level only becomes available
// after its right-hand confirmation candles have closed; future bars are used only
// to score what happened after that point.
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const { getCandles } = require('../mt5Service');
const { validateCandles, getClosedCandles } = require('./marketData');
const { calculateATRSeries } = require('./statistics');
const { findSwingPoints } = require('./swings');

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows, cols) {
  return [cols.join(','), ...rows.map(r => cols.map(c => csvEscape(r[c])).join(','))].join('\r\n') + '\r\n';
}
function timeframeSeconds(name) {
  const m = /^M(\d+)$/.exec(name); if (m) return Number(m[1]) * 60;
  const h = /^H(\d+)$/.exec(name); if (h) return Number(h[1]) * 3600;
  const d = /^D(\d+)$/.exec(name); if (d) return Number(d[1]) * 86400;
  throw new Error(`Unsupported timeframe: ${name}`);
}

function evaluateSwing(candles, swing, indexByTime, atrSeries, options) {
  const confirmedIndex = indexByTime.get(swing.confirmationTime);
  if (confirmedIndex === undefined) return null;
  const atr = atrSeries[confirmedIndex];
  if (!(atr > 0)) return null;
  const halfWidth = atr * options.zoneToleranceATR;
  const low = swing.price - halfWidth;
  const high = swing.price + halfWidth;
  const end = Math.min(candles.length - 1, confirmedIndex + options.forwardBars);
  let firstTouchIndex = -1, maxFavorable = 0, maxAdverse = 0, outcome = 'no_touch';
  let eventIndex = -1;
  for (let i = confirmedIndex + 1; i <= end; i++) {
    const c = candles[i];
    const touched = c.low <= high && c.high >= low;
    if (firstTouchIndex < 0 && touched) firstTouchIndex = i;
    if (firstTouchIndex < 0) continue;

    if (swing.type === 'swing_low') {
      maxFavorable = Math.max(maxFavorable, c.high - high);
      maxAdverse = Math.max(maxAdverse, low - c.low);
    } else {
      maxFavorable = Math.max(maxFavorable, low - c.low);
      maxAdverse = Math.max(maxAdverse, c.high - high);
    }

    const broke = swing.type === 'swing_low'
      ? c.close < low - atr * options.breakBufferATR
      : c.close > high + atr * options.breakBufferATR;
    const reactionReached = swing.type === 'swing_low'
      ? c.high >= high + atr * options.reactionATR
      : c.low <= low - atr * options.reactionATR;

    // Score the first observable outcome after touch. If both conditions occur
    // in one OHLC candle, candle data cannot reveal the intrabar order.
    if (broke && reactionReached) {
      outcome = 'ambiguous_same_bar'; eventIndex = i; break;
    }
    if (broke) { outcome = 'break_close'; eventIndex = i; break; }
    if (reactionReached) { outcome = 'reaction_target_reached'; eventIndex = i; break; }
  }
  if (firstTouchIndex >= 0 && outcome === 'no_touch') outcome = 'touch_no_target';
  return {
    swingType: swing.type,
    swingPrice: swing.price,
    swingTime: swing.time,
    confirmationTime: swing.confirmationTime,
    confirmationClose: candles[confirmedIndex].close,
    atrAtConfirmation: atr,
    zoneLow: low,
    zoneHigh: high,
    firstTouchTime: firstTouchIndex >= 0 ? candles[firstTouchIndex].time : null,
    barsUntilTouch: firstTouchIndex >= 0 ? firstTouchIndex - confirmedIndex : null,
    eventTime: eventIndex >= 0 ? candles[eventIndex].time : null,
    barsUntilOutcome: eventIndex >= 0 ? eventIndex - confirmedIndex : null,
    forwardBarsObserved: end - confirmedIndex,
    maxFavorableMove: maxFavorable,
    maxFavorableATR: maxFavorable / atr,
    maxAdverseMove: maxAdverse,
    maxAdverseATR: maxAdverse / atr,
    outcome,
  };
}

async function main() {
  const outDir = path.resolve(__dirname, config.outputDirectory);
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const options = {
    zoneToleranceATR: config.zoneToleranceATR,
    forwardBars: Number(process.env.BTC_BACKTEST_FORWARD_BARS || 20),
    reactionATR: Number(process.env.BTC_BACKTEST_REACTION_ATR || 1),
    breakBufferATR: Number(process.env.BTC_BACKTEST_BREAK_BUFFER_ATR || 0.1),
  };
  const summary = { generatedAt: new Date().toISOString(), symbol: config.symbol, options, commonCutoffUnix: null, timeframes: {} };
  const fetched = [];
  for (const tf of config.timeframes) {
    console.log(`[BACKTEST] Fetching ${config.symbol} ${tf.name}...`);
    const payload = await getCandles(config.symbol, tf.name, tf.count);
    const market = validateCandles(payload, config.symbol, tf.name);
    const candles = getClosedCandles(market.candles, config.excludeNewestCandle);
    fetched.push({ tf, candles });
  }
  const cutoff = config.synchronizeTimeframes && fetched.length > 1
    ? Math.min(...fetched.map(x => x.candles.at(-1).time + timeframeSeconds(x.tf.name))) : null;
  summary.commonCutoffUnix = cutoff;
  summary.commonCutoffISO = cutoff === null ? null : new Date(cutoff * 1000).toISOString();
  for (const item of fetched) {
    const { tf } = item;
    const duration = timeframeSeconds(tf.name);
    const candles = cutoff === null ? item.candles : item.candles.filter(c => c.time + duration <= cutoff);
    const atrSeries = calculateATRSeries(candles, config.atrPeriod);
    const swings = findSwingPoints(candles, atrSeries, config.swingLeftBars, config.swingRightBars);
    const indexByTime = new Map(candles.map((c, i) => [c.time, i]));
    const results = swings.map(s => evaluateSwing(candles, s, indexByTime, atrSeries, options)).filter(Boolean);
    const counts = Object.fromEntries(['reaction_target_reached','touch_no_target','break_close','no_touch','ambiguous_same_bar'].map(k => [k, results.filter(r => r.outcome === k).length]));
    const touched = results.filter(r => r.outcome !== 'no_touch');
    const unambiguousTouched = touched.filter(r => r.outcome !== 'ambiguous_same_bar');
    const completed = results.filter(r => r.forwardBarsObserved >= options.forwardBars);
    const completedTouched = completed.filter(r => r.outcome !== 'no_touch');
    const completedUnambiguous = completedTouched.filter(r => r.outcome !== 'ambiguous_same_bar');
    const stats = {
      commonCutoffISO: cutoff === null ? null : new Date(cutoff * 1000).toISOString(),
      candles: candles.length, confirmedSwings: results.length,
      levelsTouchedWithinHorizon: touched.length,
      reactionTargetReached: counts.reaction_target_reached,
      touchedButNoTarget: counts.touch_no_target,
      closesThroughLevel: counts.break_close,
      noTouch: counts.no_touch,
      reactionRateAmongTouched: touched.length ? counts.reaction_target_reached / touched.length : null,
      breakRateAmongTouched: touched.length ? counts.break_close / touched.length : null,
      ambiguousRateAmongTouched: touched.length ? counts.ambiguous_same_bar / touched.length : null,
      unambiguousTouchedCases: unambiguousTouched.length,
      reactionRateExcludingAmbiguous: unambiguousTouched.length ? counts.reaction_target_reached / unambiguousTouched.length : null,
      breakRateExcludingAmbiguous: unambiguousTouched.length ? counts.break_close / unambiguousTouched.length : null,
      fullForwardWindowCases: completed.length,
      fullWindowTouchedCases: completedTouched.length,
      fullWindowUnambiguousTouchedCases: completedUnambiguous.length,
      fullWindowReactionRateExcludingAmbiguous: completedUnambiguous.length ? completedUnambiguous.filter(r => r.outcome === 'reaction_target_reached').length / completedUnambiguous.length : null,
      fullWindowBreakRateExcludingAmbiguous: completedUnambiguous.length ? completedUnambiguous.filter(r => r.outcome === 'break_close').length / completedUnambiguous.length : null,
      note: 'Descriptive first-event test, not a profitable trading-strategy backtest. Swing level is available only at confirmationTime; same-candle target/break is marked ambiguous because OHLC cannot establish intrabar order; recent cases may have fewer than the full forwardBars.'
    };
    summary.timeframes[tf.name] = { stats, outcomes: counts };
    const prefix = `${config.symbol}_${tf.name}_${stamp}_backtest`;
    fs.writeFileSync(path.join(outDir, `${prefix}.csv`), toCsv(results, [
      'swingType','swingPrice','swingTime','confirmationTime','confirmationClose','atrAtConfirmation',
      'zoneLow','zoneHigh','firstTouchTime','barsUntilTouch','eventTime','barsUntilOutcome','forwardBarsObserved','maxFavorableMove',
      'maxFavorableATR','maxAdverseMove','maxAdverseATR','outcome'
    ]), 'utf8');
    console.log(`  ${tf.name}: swings=${results.length}, touched=${touched.length}, reaction-first>=${options.reactionATR}ATR=${counts.reaction_target_reached}, breaks-first=${counts.break_close}, ambiguous=${counts.ambiguous_same_bar}, no touch=${counts.no_touch}`);
    console.log(`  Saved: ${prefix}.csv`);
  }
  fs.writeFileSync(path.join(outDir, `${config.symbol}_${stamp}_backtest_summary.json`), JSON.stringify(summary, null, 2), 'utf8');
  console.log('Backtest summary saved. This tests level reactions, not profit/loss or a trading strategy.');
}
main().catch(err => { console.error('[BACKTEST ERROR]', err.stack || err); process.exitCode = 1; });
