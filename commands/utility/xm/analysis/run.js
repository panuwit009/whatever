'use strict';

const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const { getCandles } = require('../mt5Service');
const { validateCandles, getClosedCandles } = require('./marketData');
const { summarize } = require('./statistics');
const { findSwingPoints } = require('./swings');
const { clusterSwingZones, classifyZones } = require('./zones');
const { printReport } = require('./report');

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map(row => columns.map(key => csvEscape(row[key])).join(','))].join('\n') + '\n';
}

function writeOutputs({ symbol, timeframe, rawCandles, closedCandles, stats, swings, zones, digits, synchronizedCutoff }) {
  const outputDir = path.resolve(__dirname, config.outputDirectory);
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = `${symbol}_${timeframe}_${stamp}`;
  const candleRows = rawCandles.map(c => ({
    time: c.time,
    datetime_th: new Date(c.time * 1000).toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }),
    open: c.open, high: c.high, low: c.low, close: c.close,
    tick_volume: c.tick_volume, spread: c.spread, real_volume: c.real_volume,
    included_in_analysis: closedCandles.some(x => x.time === c.time),
  }));
  fs.writeFileSync(path.join(outputDir, `${prefix}_candles.csv`), toCsv(candleRows,
    ['time', 'datetime_th', 'open', 'high', 'low', 'close', 'tick_volume', 'spread', 'real_volume', 'included_in_analysis']), 'utf8');
  fs.writeFileSync(path.join(outputDir, `${prefix}_swings.csv`), toCsv(swings,
    ['type', 'price', 'time', 'confirmationTime', 'reversalDistance', 'reversalATR', 'atrAtSwing']), 'utf8');
  fs.writeFileSync(path.join(outputDir, `${prefix}_zones.csv`), toCsv(zones.map(z => ({
    ...z,
    sourceTypes: z.sourceTypes.join('|'),
    pointTimes: z.pointTimes.join('|'),
  })), ['low', 'high', 'price', 'touches', 'lastSeen', 'sourceTypes', 'strongestReversalATR', 'averageReversalATR', 'location', 'role', 'roleNote', 'ageCandles', 'freshnessFactor', 'rawScore', 'score', 'distance', 'distanceATR', 'closesAboveAfterZone', 'closesBelowAfterZone', 'pointTimes']), 'utf8');

  const summary = {
    generatedAt: new Date().toISOString(), symbol, timeframe, digits,
    config: {
      atrPeriod: config.atrPeriod,
      swingLeftBars: config.swingLeftBars,
      swingRightBars: config.swingRightBars,
      zoneToleranceATR: config.zoneToleranceATR,
      excludedNewestCandle: config.excludeNewestCandle,
      synchronizedCutoff: synchronizedCutoff ?? null,
      zoneFreshnessHalfLifeCandles: config.zoneFreshnessHalfLifeCandles,
    },
    rawCandleCount: rawCandles.length,
    analyzedClosedCandleCount: closedCandles.length,
    statistics: Object.fromEntries(Object.entries(stats).filter(([key]) => key !== 'atrSeries')),
    swingPoints: swings,
    zones,
    synchronizedCutoff: synchronizedCutoff ?? null,
  };
  fs.writeFileSync(path.join(outputDir, `${prefix}_summary.json`), JSON.stringify(summary, null, 2), 'utf8');
  console.log(`ไฟล์ข้อมูลดิบและผลวิเคราะห์ถูกบันทึกที่: ${outputDir}`);
  console.log(`  ${prefix}_candles.csv  = OHLCV ดิบทุกแท่งที่ MT5 ส่งมา`);
  console.log(`  ${prefix}_swings.csv   = Swing points`);
  console.log(`  ${prefix}_zones.csv    = โซนและสถิติประกอบ`);
  console.log(`  ${prefix}_summary.json = สรุปครบสำหรับตรวจย้อนหลัง`);
}

function timeframeSeconds(name) {
  const match = /^M(\d+)$/.exec(name);
  if (match) return Number(match[1]) * 60;
  const hours = /^H(\d+)$/.exec(name);
  if (hours) return Number(hours[1]) * 3600;
  const days = /^D(\d+)$/.exec(name);
  if (days) return Number(days[1]) * 86400;
  throw new Error(`Unsupported timeframe for synchronization: ${name}`);
}

async function fetchTimeframe(symbol, timeframe, count) {
  console.log(`\n[MT5] กำลังดึง ${symbol} ${timeframe} จำนวน ${count} แท่ง...`);
  const payload = await getCandles(symbol, timeframe, count);
  const market = validateCandles(payload, symbol, timeframe);
  const rawCandles = market.candles;
  const closedCandles = getClosedCandles(rawCandles, config.excludeNewestCandle);
  if (closedCandles.length < config.atrPeriod + config.swingLeftBars + config.swingRightBars + 5) {
    throw new Error(`${symbol} ${timeframe}: ข้อมูลแท่งปิดแล้วไม่พอ (${closedCandles.length})`);
  }
  return { market, rawCandles, closedCandles, rawLatestCandle: rawCandles.at(-1) ?? null };
}

function analyzePreparedTimeframe(symbol, timeframe, prepared, synchronizedCutoff) {
  const { market, rawCandles, rawLatestCandle } = prepared;
  const duration = timeframeSeconds(timeframe);
  let closedCandles = prepared.closedCandles;

  // MT5 timestamps are candle OPEN times. A candle is available at cutoff only
  // when its open time + timeframe duration is <= the shared cutoff.
  if (config.synchronizeTimeframes && synchronizedCutoff !== null) {
    closedCandles = closedCandles.filter(c => c.time + duration <= synchronizedCutoff);
  }
  if (closedCandles.length < config.atrPeriod + config.swingLeftBars + config.swingRightBars + 5) {
    throw new Error(`${symbol} ${timeframe}: แท่งที่เหลือหลังปรับเวลาให้ตรงกันไม่พอ (${closedCandles.length})`);
  }

  const stats = summarize(closedCandles, config.atrPeriod);
  stats.synchronizedCutoff = synchronizedCutoff;
  const swings = findSwingPoints(closedCandles, stats.atrSeries, config.swingLeftBars, config.swingRightBars);
  const tolerance = stats.atr ? stats.atr * config.zoneToleranceATR : 0;
  const clustered = clusterSwingZones(swings, tolerance);
  const zones = classifyZones(clustered, closedCandles, stats.lastClose, stats.atr, config.zoneFreshnessHalfLifeCandles);

  printReport({
    symbol: market.symbol, timeframe: market.timeframe, digits: market.digits,
    receivedCount: market.receivedCount, rawLatestCandle, candles: closedCandles,
    stats, swings, zones, excludedLatest: config.excludeNewestCandle,
  });
  writeOutputs({
    symbol: market.symbol, timeframe: market.timeframe, rawCandles, closedCandles,
    stats, swings, zones, digits: market.digits, synchronizedCutoff,
  });
}

async function main() {
  console.log('\nBTCUSD MARKET DATA ANALYZER — READ ONLY');
  console.log('โปรแกรมนี้ดึงข้อมูลจาก MT5 เพื่อวิเคราะห์และบันทึกไฟล์เท่านั้น ไม่มีคำสั่งเปิด/ปิดออเดอร์');
  console.log(`เริ่มเวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false })}`);

  const preparedItems = [];
  for (const timeframe of config.timeframes) {
    try {
      const prepared = await fetchTimeframe(config.symbol, timeframe.name, timeframe.count);
      preparedItems.push({ timeframe, prepared });
    } catch (error) {
      console.error(`[ERROR] ${config.symbol} ${timeframe.name}: ${error.message}`);
      console.error(error.stack);
    }
  }

  let synchronizedCutoff = null;
  if (config.synchronizeTimeframes && preparedItems.length > 1) {
    synchronizedCutoff = Math.min(...preparedItems.map(({ timeframe, prepared }) => {
      const lastClosed = prepared.closedCandles.at(-1);
      return lastClosed.time + timeframeSeconds(timeframe.name);
    }));
    console.log(`\n[SYNC] เวลาปิดแท่งร่วมสำหรับเปรียบเทียบ: ${new Date(synchronizedCutoff * 1000).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false })}`);
    console.log('[SYNC] จะคำนวณ M15/H1 จากแท่งที่ปิดไม่เกินเวลานี้ เพื่อไม่เปรียบเทียบคนละช่วงเวลา');
  }

  for (const { timeframe, prepared } of preparedItems) {
    try {
      analyzePreparedTimeframe(config.symbol, timeframe.name, prepared, synchronizedCutoff);
    } catch (error) {
      console.error(`[ERROR] ${config.symbol} ${timeframe.name}: ${error.message}`);
      console.error(error.stack);
    }
  }
  console.log('\nเสร็จแล้ว — ตรวจไฟล์ CSV/JSON ในโฟลเดอร์ data และเทียบกับกราฟ MT5 ได้เลย\n');
}

main().catch(error => {
  console.error('[FATAL] วิเคราะห์ตลาดไม่สำเร็จ:', error);
  process.exitCode = 1;
});
