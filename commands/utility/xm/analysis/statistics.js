'use strict';

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function standardDeviation(values) {
  if (values.length < 2) return null;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1));
}

function trueRange(candle, previousClose) {
  if (previousClose === null) return candle.high - candle.low;
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - previousClose),
    Math.abs(candle.low - previousClose),
  );
}

function calculateATRSeries(candles, period = 14) {
  const result = Array(candles.length).fill(null);
  if (candles.length < period || period < 1) return result;

  const trs = candles.map((c, i) => trueRange(c, i ? candles[i - 1].close : null));
  let atr = trs.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = atr;

  for (let i = period; i < trs.length; i++) {
    // Wilder's smoothing, commonly used for ATR.
    atr = ((atr * (period - 1)) + trs[i]) / period;
    result[i] = atr;
  }
  return result;
}

function summarize(candles, atrPeriod = 14) {
  if (!candles.length) throw new Error('No closed candles available for statistics');
  const first = candles[0];
  const last = candles[candles.length - 1];
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const ranges = candles.map(c => c.high - c.low);
  const returns = [];
  let bullish = 0, bearish = 0, unchanged = 0;
  let totalTickVolume = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.close > c.open) bullish++;
    else if (c.close < c.open) bearish++;
    else unchanged++;
    totalTickVolume += c.tick_volume || 0;
    if (i > 0 && candles[i - 1].close !== 0) {
      returns.push((c.close / candles[i - 1].close) - 1);
    }
  }

  const atrSeries = calculateATRSeries(candles, atrPeriod);
  const atr = atrSeries.at(-1) ?? null;
  const netChange = last.close - first.open;
  const netChangePct = first.open !== 0 ? (netChange / first.open) * 100 : null;
  const sampleStdev = standardDeviation(returns);

  return {
    candleCount: candles.length,
    startTime: first.time,
    endTime: last.time,
    firstOpen: first.open,
    lastClose: last.close,
    periodHigh: Math.max(...highs),
    periodLow: Math.min(...lows),
    periodRange: Math.max(...highs) - Math.min(...lows),
    netChange,
    netChangePct,
    averageCandleRange: mean(ranges),
    medianCandleRange: median(ranges),
    largestCandleRange: Math.max(...ranges),
    atr,
    atrPctOfClose: atr !== null && last.close !== 0 ? (atr / last.close) * 100 : null,
    closeReturnStdevPct: sampleStdev !== null ? sampleStdev * 100 : null,
    bullishCandles: bullish,
    bearishCandles: bearish,
    unchangedCandles: unchanged,
    bullishPct: (bullish / candles.length) * 100,
    bearishPct: (bearish / candles.length) * 100,
    averageTickVolume: totalTickVolume / candles.length,
    totalTickVolume,
    atrSeries,
  };
}

module.exports = { mean, median, standardDeviation, trueRange, calculateATRSeries, summarize };
