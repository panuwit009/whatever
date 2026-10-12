'use strict';

module.exports = {
  symbol: 'BTCUSD',
  timeframes: [
    { name: 'M15', count: 500 }, // ~20.8 days of calendar time
    { name: 'H1', count: 120 },   // ~20.8 days; aligns the lookback duration with M15
  ],
  // MT5 position 0 is the still-forming candle. Exclude the newest candle
  // from calculations so that the report uses closed candles only.
  excludeNewestCandle: true,
  atrPeriod: 14,
  swingLeftBars: 3,
  swingRightBars: 3,
  zoneToleranceATR: 0.25,
  maxZonesInConsole: 12,
  synchronizeTimeframes: true,
  // Age at which recency weighting has fallen to about 37% (e-folding).
  zoneFreshnessHalfLifeCandles: 100,
  // Candidates remain visible, but one-touch / stale zones are marked low confidence.
  preferredMinTouches: 2,
  staleAfterCandles: 200,
  outputDirectory: '../data',
};
