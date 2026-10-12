'use strict';

function clusterSwingZones(points, tolerance) {
  if (!(tolerance > 0)) return [];
  const sorted = points.filter(p => Number.isFinite(p.price)).sort((a, b) => a.price - b.price);
  const groups = [];

  for (const point of sorted) {
    let group = groups.at(-1);
    // Limit the full cluster width, not merely distance to the previous point.
    if (!group || point.price - group.low > tolerance) {
      group = { low: point.price, high: point.price, points: [] };
      groups.push(group);
    }
    group.points.push(point);
    group.low = Math.min(group.low, point.price);
    group.high = Math.max(group.high, point.price);
  }

  return groups.map(group => {
    const prices = group.points.map(p => p.price);
    const reversals = group.points.map(p => p.reversalATR).filter(Number.isFinite);
    const lastSeen = Math.max(...group.points.map(p => p.time));
    return {
      low: group.low,
      high: group.high,
      price: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      touches: group.points.length,
      lastSeen,
      sourceTypes: [...new Set(group.points.map(p => p.type))],
      strongestReversalATR: reversals.length ? Math.max(...reversals) : null,
      averageReversalATR: reversals.length ? reversals.reduce((sum, v) => sum + v, 0) / reversals.length : null,
      pointTimes: group.points.map(p => p.time),
    };
  });
}

function countRecentCloses(candles, startTime, endTime, predicate) {
  return candles.filter(c => c.time > startTime && c.time <= endTime && predicate(c.close)).length;
}

function classifyZones(zones, candles, currentPrice, atr, freshnessHalfLifeCandles = 100) {
  const lastTime = candles.at(-1)?.time ?? 0;
  const recencyWindow = candles.length ? candles[Math.max(0, candles.length - 50)].time : 0;

  return zones.map(zone => {
    const below = zone.high < currentPrice;
    const above = zone.low > currentPrice;
    const location = below ? 'below_price' : above ? 'above_price' : 'contains_price';
    const role = below ? 'support_candidate' : above ? 'resistance_candidate' : 'price_inside_zone';
    const ageCandles = candles.filter(c => c.time > zone.lastSeen).length;
    const recentTouches = zone.pointTimes.filter(t => t >= recencyWindow).length;
    const breakBuffer = Number.isFinite(atr) ? atr * 0.1 : 0;
    const closesAbove = countRecentCloses(candles, zone.lastSeen, lastTime, close => close > zone.high + breakBuffer);
    const closesBelow = countRecentCloses(candles, zone.lastSeen, lastTime, close => close < zone.low - breakBuffer);
    const reversal = zone.strongestReversalATR ?? 0;
    const touchScore = Math.min(zone.touches, 5) * 1.5;
    const reversalScore = Math.min(reversal, 4) * 2;
    const recencyScore = recentTouches > 0 ? 1.5 : 0;
    const proximityScore = Number.isFinite(atr) && atr > 0
      ? Math.max(0, 3 - (Math.abs(currentPrice - zone.price) / atr))
      : 0;

    // Smooth freshness penalty: old zones remain visible, but lose score gradually.
    const halfLife = Math.max(1, Number(freshnessHalfLifeCandles) || 100);
    const freshnessFactor = Math.pow(0.5, ageCandles / halfLife);
    const rawScore = touchScore + reversalScore + recencyScore + proximityScore;
    const score = rawScore * freshnessFactor;

    let roleNote = 'ตำแหน่งเทียบกับราคาปัจจุบันเท่านั้น ยังไม่ยืนยันการเปลี่ยนบทบาท';
    if (below && zone.sourceTypes.includes('swing_high') && closesAbove > 0) {
      roleNote = 'มีราคาปิดเหนือโซนหลังเกิดโซนเดิม อาจเปลี่ยนเป็นแนวรับ';
    } else if (above && zone.sourceTypes.includes('swing_low') && closesBelow > 0) {
      roleNote = 'มีราคาปิดใต้โซนหลังเกิดโซนเดิม อาจเปลี่ยนเป็นแนวต้าน';
    }

    const staleAfter = Math.max(1, Number(require('./config').staleAfterCandles) || 200);
    const preferredTouches = Math.max(1, Number(require('./config').preferredMinTouches) || 2);
    const stale = ageCandles > staleAfter;
    const confidence = zone.touches >= preferredTouches && !stale ? 'normal' : zone.touches >= preferredTouches ? 'aged' : 'low';

    return {
      ...zone,
      location, stale, confidence,
      role,
      roleNote,
      ageCandles,
      freshnessFactor: Number(freshnessFactor.toFixed(4)),
      rawScore: Number(rawScore.toFixed(2)),
      score: Number(score.toFixed(2)),
      distance: Math.abs(currentPrice - zone.price),
      distanceATR: Number.isFinite(atr) && atr > 0 ? Math.abs(currentPrice - zone.price) / atr : null,
      closesAboveAfterZone: closesAbove,
      closesBelowAfterZone: closesBelow,
    };
  }).sort((a, b) => {
    const aSide = a.location === 'contains_price' ? 0 : 1;
    const bSide = b.location === 'contains_price' ? 0 : 1;
    return aSide - bSide || a.distance - b.distance || b.score - a.score;
  });
}

module.exports = { clusterSwingZones, classifyZones };
