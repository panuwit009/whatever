'use strict';

function findSwingPoints(candles, atrSeries, leftBars = 3, rightBars = 3) {
  const points = [];
  if (candles.length < leftBars + rightBars + 1) return points;

  // Confirm a swing only after rightBars closed candles exist to its right.
  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const current = candles[i];
    const neighbors = [
      ...candles.slice(i - leftBars, i),
      ...candles.slice(i + 1, i + rightBars + 1),
    ];
    const swingHigh = neighbors.every(c => current.high >= c.high) && neighbors.some(c => current.high > c.high);
    const swingLow = neighbors.every(c => current.low <= c.low) && neighbors.some(c => current.low < c.low);
    const atrAtSwing = atrSeries[i];
    const later = candles.slice(i + 1, i + rightBars + 1);

    if (swingHigh) {
      const maxDrop = Math.max(...later.map(c => current.high - c.low));
      points.push({
        type: 'swing_high', price: current.high, time: current.time,
        confirmationTime: later.at(-1).time,
        reversalDistance: maxDrop,
        reversalATR: atrAtSwing > 0 ? maxDrop / atrAtSwing : null,
        atrAtSwing: atrAtSwing ?? null,
      });
    }
    if (swingLow) {
      const maxRise = Math.max(...later.map(c => c.high - current.low));
      points.push({
        type: 'swing_low', price: current.low, time: current.time,
        confirmationTime: later.at(-1).time,
        reversalDistance: maxRise,
        reversalATR: atrAtSwing > 0 ? maxRise / atrAtSwing : null,
        atrAtSwing: atrAtSwing ?? null,
      });
    }
  }
  return points.sort((a, b) => a.time - b.time || a.price - b.price);
}

module.exports = { findSwingPoints };
