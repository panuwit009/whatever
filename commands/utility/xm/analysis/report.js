'use strict';

function dateTime(unixSeconds) {
  if (!Number.isFinite(unixSeconds)) return 'N/A';
  return new Date(unixSeconds * 1000).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', hour12: false,
  });
}

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : 'N/A';
}

function printReport({ symbol, timeframe, digits, receivedCount, rawLatestCandle, candles, stats, swings, zones, excludedLatest }) {
  const line = '='.repeat(88);
  console.log(`\n${line}`);
  console.log(`  ${symbol} | ${timeframe} | รายงานวิเคราะห์ข้อมูลตลาด`);
  console.log(line);
  console.log(`ข้อมูลแท่งเทียนที่ได้รับ : ${receivedCount}`);
  console.log(`แท่งที่ใช้คำนวณ       : ${candles.length} (แท่งปิดแล้ว)`);
  console.log(`แท่งล่าสุดที่ตัดออก     : ${excludedLatest ? dateTime(rawLatestCandle?.time) + ' (อาจยังไม่ปิด)' : 'ไม่มี'}`);
  console.log(`ช่วงข้อมูล              : ${dateTime(stats.startTime)} ถึง ${dateTime(stats.endTime)}`);
  if (stats.synchronizedCutoff) console.log(`เวลาตัดข้อมูลร่วม        : ${dateTime(stats.synchronizedCutoff)} (ใช้เทียบ M15/H1)`);
  console.log('-'.repeat(88));
  console.log('สถิติราคา');
  console.log(`  Open แรก / Close ล่าสุด : ${fmt(stats.firstOpen, digits)} / ${fmt(stats.lastClose, digits)}`);
  console.log(`  High / Low ของช่วง      : ${fmt(stats.periodHigh, digits)} / ${fmt(stats.periodLow, digits)}`);
  console.log(`  Range ทั้งช่วง           : ${fmt(stats.periodRange, digits)}`);
  console.log(`  เปลี่ยนแปลงสุทธิ         : ${fmt(stats.netChange, digits)} (${fmt(stats.netChangePct, 3)}%)`);
  console.log(`  ATR(14) / ATR ต่อราคา   : ${fmt(stats.atr, digits)} / ${fmt(stats.atrPctOfClose, 3)}%`);
  console.log(`  Range แท่งเฉลี่ย / มัธยฐาน: ${fmt(stats.averageCandleRange, digits)} / ${fmt(stats.medianCandleRange, digits)}`);
  console.log(`  Range แท่งใหญ่สุด        : ${fmt(stats.largestCandleRange, digits)}`);
  console.log(`  SD ของ close-to-close return: ${fmt(stats.closeReturnStdevPct, 4)}% (ต่อแท่ง)`);
  console.log(`  Bull / Bear / Unchanged : ${stats.bullishCandles} (${fmt(stats.bullishPct, 1)}%) / ${stats.bearishCandles} (${fmt(stats.bearishPct, 1)}%) / ${stats.unchangedCandles}`);
  console.log(`  Tick volume เฉลี่ย / รวม: ${fmt(stats.averageTickVolume, 0)} / ${fmt(stats.totalTickVolume, 0)}`);
  console.log('-'.repeat(88));
  console.log(`Swing points ที่ยืนยันแล้ว: ${swings.length}`);
  console.log(`โซนที่รวมได้             : ${zones.length}`);
  console.log('โซนใกล้ราคาปัจจุบัน (เรียงตามระยะ ไม่ใช่คำแนะนำซื้อขาย)');

  if (!zones.length) console.log('  ไม่พบโซนที่เข้าเงื่อนไข');
  zones.slice(0, 12).forEach((z, i) => {
    const role = z.location === 'below_price' ? 'ใต้ราคา / แนวรับ candidate'
      : z.location === 'above_price' ? 'เหนือราคา / แนวต้าน candidate'
      : 'ราคาปัจจุบันอยู่ในโซน';
    console.log(`  ${String(i + 1).padStart(2, '0')}. ${fmt(z.low, digits)} - ${fmt(z.high, digits)} | กลาง ${fmt(z.price, digits)} | ${role}`);
    console.log(`      ห่าง ${fmt(z.distance, digits)} (${fmt(z.distanceATR, 2)} ATR) | แตะ ${z.touches} ครั้ง | คะแนน ${fmt(z.score, 2)} (ก่อนหักอายุ ${fmt(z.rawScore, 2)}) | อายุ ${z.ageCandles} แท่ง`);
    console.log(`      ที่มา: ${z.sourceTypes.join(', ')} | ${z.roleNote}`);
  });
  console.log('-'.repeat(88));
  console.log('หมายเหตุ: โซนด้านล่าง/บนราคาถูกเรียกว่า candidate ตามตำแหน่งเท่านั้น');
  console.log('ต้องเปิดกราฟเทียบเอง; คะแนนเป็น heuristic ภายในโปรแกรม ไม่ใช่ความน่าจะเป็นหรือสัญญาณเทรด');
  console.log(`${line}\n`);
}

module.exports = { dateTime, fmt, printReport };
