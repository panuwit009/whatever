'use strict';

// Generates merged, price-sorted S/R zones from confirmed swings only.
// Uses a shared closed-candle cutoff across timeframes to avoid snapshot drift.
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const { getCandles } = require('../mt5Service');
const { validateCandles, getClosedCandles } = require('./marketData');
const { summarize } = require('./statistics');
const { findSwingPoints } = require('./swings');
const { clusterSwingZones, classifyZones } = require('./zones');

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows, cols) {
  return [cols.join(','), ...rows.map(r => cols.map(c => csvEscape(r[c])).join(','))].join('\r\n') + '\r\n';
}
function timeframeSeconds(name) {
  const m = /^M(\d+)$/.exec(name); if (m) return +m[1] * 60;
  const h = /^H(\d+)$/.exec(name); if (h) return +h[1] * 3600;
  const d = /^D(\d+)$/.exec(name); if (d) return +d[1] * 86400;
  throw new Error(`Unsupported timeframe: ${name}`);
}

// Merge clusters that are overlapping or separated by a very small gap.
// A hard max width prevents a single broad zone swallowing the whole chart.
function mergeNearbyZones(zones, atr, mergeGapATR = 0.12, maxWidthATR = 0.85) {
  if (!zones.length || !(atr > 0)) return zones;
  const gapLimit = atr * mergeGapATR;
  const widthLimit = atr * maxWidthATR;
  const sorted = [...zones].sort((a, b) => a.low - b.low);
  const out = [];
  for (const z of sorted) {
    const prev = out[out.length - 1];
    const mergedLow = prev ? Math.min(prev.low, z.low) : z.low;
    const mergedHigh = prev ? Math.max(prev.high, z.high) : z.high;
    if (prev && z.low - prev.high <= gapLimit && mergedHigh - mergedLow <= widthLimit) {
      const wa = Math.max(1, prev.touches), wb = Math.max(1, z.touches);
      prev.low = mergedLow; prev.high = mergedHigh;
      prev.price = (prev.price * wa + z.price * wb) / (wa + wb);
      prev.touches += z.touches;
      prev.lastSeen = Math.max(prev.lastSeen, z.lastSeen);
      prev.sourceTypes = [...new Set([...prev.sourceTypes, ...z.sourceTypes])];
      prev.pointTimes = [...(prev.pointTimes || []), ...(z.pointTimes || [])];
      prev.strongestReversalATR = Math.max(prev.strongestReversalATR || 0, z.strongestReversalATR || 0);
      prev.averageReversalATR = [prev.averageReversalATR, z.averageReversalATR].filter(Number.isFinite).reduce((s,v)=>s+v,0) / [prev.averageReversalATR, z.averageReversalATR].filter(Number.isFinite).length || null;
      prev.mergedClusters = (prev.mergedClusters || 1) + (z.mergedClusters || 1);
    } else out.push({ ...z, pointTimes: [...(z.pointTimes || [])], mergedClusters: 1 });
  }
  return out;
}

function rankAndFormat(zones, currentPrice) {
  const eligible = zones.filter(z => z.role !== 'price_inside_zone');
  const supports = eligible.filter(z => z.high < currentPrice)
    .sort((a,b) => b.score-a.score || (currentPrice-a.high)-(currentPrice-b.high));
  const resistances = eligible.filter(z => z.low > currentPrice)
    .sort((a,b) => b.score-a.score || (a.low-currentPrice)-(b.low-currentPrice));
  // Rank by score with distance as a tie-breaker, but emit CSV rows price-sorted.
  const decorate = (arr, type) => {
    const ranks = new Map(arr.map((z,i)=>[z, i+1]));
    return arr.map(z => ({
      label: `${type === 'support' ? 'แนวรับ' : 'แนวต้าน'}ที่ ${ranks.get(z)}`,
      type: type === 'support' ? 'support_candidate' : 'resistance_candidate',
      rank: ranks.get(z), low: z.low, high: z.high, midpoint: z.price,
      distanceFromCurrent: type === 'support' ? currentPrice-z.high : z.low-currentPrice,
      touches: z.touches, score: z.score, rawScore: z.rawScore, ageCandles: z.ageCandles,
      confidence: z.confidence || 'unrated', stale: Boolean(z.stale),
      distanceATR: z.distanceATR, sourceTypes: (z.sourceTypes || []).join('|'),
      mergedClusters: z.mergedClusters || 1, roleNote: z.roleNote || '',
    }));
  };
  const supportRows = decorate(supports, 'support');
  const resistanceRows = decorate(resistances, 'resistance');
  return {
    supports: supportRows.sort((a,b)=>a.low-b.low),
    resistances: resistanceRows.sort((a,b)=>a.low-b.low),
    inside: zones.filter(z => z.role === 'price_inside_zone').map(z => ({
      label:'ราคาปัจจุบันอยู่ในโซน', type:'current_price_inside_zone', rank:0,
      low:z.low, high:z.high, midpoint:z.price, distanceFromCurrent:0,
      touches:z.touches, score:z.score, rawScore:z.rawScore, ageCandles:z.ageCandles,
      confidence:z.confidence || 'unrated', stale:Boolean(z.stale),
      distanceATR:z.distanceATR, sourceTypes:(z.sourceTypes||[]).join('|'),
      mergedClusters:z.mergedClusters||1, roleNote:z.roleNote||'',
    })).sort((a,b)=>b.score-a.score)
  };
}

async function main() {
  const outDir = path.resolve(__dirname, config.outputDirectory);
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fetched = [];
  for (const tf of config.timeframes) {
    console.log(`[S/R] Fetching ${config.symbol} ${tf.name}...`);
    const payload = await getCandles(config.symbol, tf.name, tf.count);
    const market = validateCandles(payload, config.symbol, tf.name);
    const closed = getClosedCandles(market.candles, config.excludeNewestCandle);
    fetched.push({ tf, market, closed });
  }
  // The cutoff is the earliest last-closed candle end across all timeframes.
  const commonCutoff = Math.min(...fetched.map(({tf,closed}) => {
    if (!closed.length) throw new Error(`${tf.name}: no closed candles`);
    return closed[closed.length-1].time + timeframeSeconds(tf.name);
  }));
  const report = { generatedAt:new Date().toISOString(), symbol:config.symbol, commonCutoffUnix:commonCutoff,
    merge:{gapATR:0.12,maxZoneWidthATR:0.85}, timeframes:{} };

  for (const item of fetched) {
    const {tf,market} = item;
    const seconds = timeframeSeconds(tf.name);
    const candles = item.closed.filter(c => c.time + seconds <= commonCutoff);
    if (candles.length < config.atrPeriod + config.swingLeftBars + config.swingRightBars + 5)
      throw new Error(`${tf.name}: not enough candles before shared cutoff`);
    const stats = summarize(candles, config.atrPeriod);
    const swings = findSwingPoints(candles, stats.atrSeries, config.swingLeftBars, config.swingRightBars);
    const rawZones = clusterSwingZones(swings, (stats.atr || 0) * config.zoneToleranceATR);
    const mergedZones = mergeNearbyZones(rawZones, stats.atr || 0);
    const zones = classifyZones(mergedZones, candles, stats.lastClose, stats.atr, config.zoneFreshnessHalfLifeCandles);
    const lists = rankAndFormat(zones, stats.lastClose);
    const rows = [...lists.supports, ...lists.inside, ...lists.resistances];
    const columns = ['label','type','rank','low','high','midpoint','distanceFromCurrent','distanceATR','touches','confidence','stale','score','rawScore','ageCandles','mergedClusters','sourceTypes','roleNote'];
    const prefix = `${config.symbol}_${tf.name}_${stamp}_support_resistance`;
    fs.writeFileSync(path.join(outDir, `${prefix}.csv`), toCsv(rows, columns), 'utf8');
    const json = { generatedAt:new Date().toISOString(), symbol:config.symbol, timeframe:tf.name,
      commonCutoffUnix:commonCutoff, commonCutoffISO:new Date(commonCutoff*1000).toISOString(),
      currentPrice:stats.lastClose, priceBasis:'latest included closed candle close at shared cutoff',
      atr:stats.atr, rawZoneCount:rawZones.length, mergedZoneCount:zones.length,
      sort:'CSV price ascending; rank is quality score; nearestByDistance is separately sorted by distance',
      merge:{gapATR:0.12,maxZoneWidthATR:0.85}, ...lists,
      topSupports:lists.supports.slice().sort((a,b)=>a.rank-b.rank).slice(0,5),
      topResistances:lists.resistances.slice().sort((a,b)=>a.rank-b.rank).slice(0,5),
      nearestSupports:lists.supports.slice().sort((a,b)=>a.distanceFromCurrent-b.distanceFromCurrent).slice(0,5),
      nearestResistances:lists.resistances.slice().sort((a,b)=>a.distanceFromCurrent-b.distanceFromCurrent).slice(0,5),
      note:'Candidates only. A price below/above a zone is a positional label, not confirmation that the zone will hold.' };
    fs.writeFileSync(path.join(outDir, `${prefix}.json`), JSON.stringify(json,null,2), 'utf8');
    report.timeframes[tf.name] = { currentPrice:stats.lastClose, atr:stats.atr, candleCount:candles.length,
      rawZoneCount:rawZones.length, mergedZoneCount:zones.length, supports:lists.supports.length,
      resistances:lists.resistances.length, inside:lists.inside.length, topSupports:json.topSupports, topResistances:json.topResistances,
      nearestSupports:json.nearestSupports, nearestResistances:json.nearestResistances, outputCsv:`${prefix}.csv`, outputJson:`${prefix}.json` };
    console.log(`  Shared cutoff: ${json.commonCutoffISO}`);
    console.log(`  Close: ${stats.lastClose}; raw zones=${rawZones.length}; merged zones=${zones.length}`);
    console.log(`  Support candidates=${lists.supports.length}; resistance candidates=${lists.resistances.length}; price-inside=${lists.inside.length}`);
    console.log(`  Saved: ${prefix}.csv and ${prefix}.json`);
  }
  fs.writeFileSync(path.join(outDir, `${config.symbol}_${stamp}_support_resistance_summary.json`), JSON.stringify(report,null,2), 'utf8');
  console.log('Summary saved. Levels are informational candidates, not trading signals.');
}
main().catch(err => { console.error('[S/R ERROR]', err.stack || err); process.exitCode = 1; });
