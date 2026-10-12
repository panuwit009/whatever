'use strict';

function validateCandles(payload, symbol, timeframe) {
  if (!payload || !Array.isArray(payload.candles)) {
    throw new Error(`${symbol} ${timeframe}: MT5 returned no candles array`);
  }

  const candles = payload.candles.map((c, index) => ({
    time: Number(c.time),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    tick_volume: Number(c.tick_volume ?? 0),
    spread: Number(c.spread ?? 0),
    real_volume: Number(c.real_volume ?? 0),
    sourceIndex: index,
  }));

  for (const [i, c] of candles.entries()) {
    if (!Number.isFinite(c.time) || ![c.open, c.high, c.low, c.close].every(Number.isFinite)) {
      throw new Error(`${symbol} ${timeframe}: invalid OHLC at candle index ${i}`);
    }
    if (c.high < c.low || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close)) {
      throw new Error(`${symbol} ${timeframe}: inconsistent OHLC at candle index ${i}`);
    }
  }

  // Sort explicitly in chronological order; MT5 payload ordering should not be assumed.
  candles.sort((a, b) => a.time - b.time);
  const unique = candles.filter((c, i) => i === 0 || c.time !== candles[i - 1].time);
  return {
    symbol: payload.symbol || symbol,
    timeframe: payload.timeframe || timeframe,
    digits: Number.isInteger(payload.digits) ? payload.digits : 2,
    receivedCount: unique.length,
    candles: unique,
  };
}

function getClosedCandles(candles, excludeNewest = true) {
  if (!Array.isArray(candles)) throw new TypeError('candles must be an array');
  return excludeNewest ? candles.slice(0, -1) : [...candles];
}

module.exports = { validateCandles, getClosedCandles };
