import json
import sys
import time
import MetaTrader5 as mt5


STARTUP_RETRIES = 12
PRICE_RETRIES = 5
RETRY_DELAY = 3

TIMEFRAME_MAP = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}


def send(data):
    print(json.dumps(data, ensure_ascii=False), flush=True)


def log(message):
    # ส่ง log ไป stderr เพื่อไม่ให้ปนกับ JSON ที่ Node.js อ่าน
    print(f"[MT5 Bridge] {message}", file=sys.stderr, flush=True)


def connect(symbol="GOLD"):
    """เชื่อมต่อ MT5 และเตรียม symbol ให้พร้อมใช้งาน"""
    if not mt5.initialize():
        raise RuntimeError(
            f"เชื่อมต่อ MT5 ไม่สำเร็จ: {mt5.last_error()}"
        )

    info = mt5.symbol_info(symbol)

    if info is None:
        raise RuntimeError(
            f"ไม่พบ {symbol} ใน MT5 กรุณาตรวจสอบชื่อใน Market Watch"
        )

    if not mt5.symbol_select(symbol, True):
        raise RuntimeError(
            f"เปิดใช้งาน {symbol} ไม่สำเร็จ: {mt5.last_error()}"
        )

    return info


def connect_with_retry(symbol="GOLD", attempts=STARTUP_RETRIES):
    """ลองเชื่อมต่อซ้ำตามจำนวนครั้งที่กำหนด"""
    last_error = None

    for attempt in range(1, attempts + 1):
        try:
            info = connect(symbol)
            log(f"เชื่อมต่อสำเร็จ: {symbol}")
            return info

        except Exception as error:
            last_error = error
            mt5.shutdown()

            log(
                f"เชื่อมต่อไม่สำเร็จ "
                f"({attempt}/{attempts}): {error}"
            )

            if attempt < attempts:
                time.sleep(RETRY_DELAY)

    raise RuntimeError(
        f"เชื่อมต่อ MT5 ไม่สำเร็จหลังลอง {attempts} ครั้ง: "
        f"{last_error}"
    )


def get_price(symbol):
    info = mt5.symbol_info(symbol)

    if info is None:
        raise RuntimeError(f"ไม่พบ symbol {symbol}")

    if not mt5.symbol_select(symbol, True):
        raise RuntimeError(
            f"เปิดใช้งาน {symbol} ไม่สำเร็จ: {mt5.last_error()}"
        )

    tick = mt5.symbol_info_tick(symbol)

    if tick is None:
        raise RuntimeError(
            f"ไม่พบ tick: {mt5.last_error()}"
        )

    if tick.bid <= 0 or tick.ask <= 0:
        raise RuntimeError(
            f"ราคาไม่ถูกต้อง: bid={tick.bid}, "
            f"ask={tick.ask}, time={tick.time}"
        )

    return {
        "symbol": symbol,
        "digits": info.digits,
        "bid": tick.bid,
        "ask": tick.ask,
        "time": tick.time,
    }

def get_symbols():
    symbols = mt5.symbols_get()

    if symbols is None:
        raise RuntimeError(
            f"ดึงรายการ Symbol ไม่สำเร็จ: {mt5.last_error()}"
        )

    return [
        {
            "name": symbol.name,
            "description": symbol.description,
            "path": symbol.path,
        }
        for symbol in symbols
    ]


def get_candles(symbol, timeframe="M15", count=10):
    """ดึงข้อมูลแท่งเทียนจาก MT5 เรียงจากเก่าไปใหม่"""

    symbol = str(symbol).strip().upper()
    timeframe = str(timeframe).strip().upper()
    count = int(count)

    if timeframe not in TIMEFRAME_MAP:
        raise RuntimeError(
            f"ไม่รองรับ timeframe {timeframe} "
            f"เลือกได้: {', '.join(TIMEFRAME_MAP.keys())}"
        )

    if count < 1 or count > 500:
        raise RuntimeError(
            "จำนวนแท่งเทียนต้องอยู่ระหว่าง 1 ถึง 500"
        )

    info = mt5.symbol_info(symbol)

    if info is None:
        raise RuntimeError(f"ไม่พบ symbol {symbol}")

    if not mt5.symbol_select(symbol, True):
        raise RuntimeError(
            f"เปิดใช้งาน {symbol} ไม่สำเร็จ: {mt5.last_error()}"
        )

    rates = mt5.copy_rates_from_pos(
        symbol,
        TIMEFRAME_MAP[timeframe],
        0,
        count
    )

    if rates is None:
        raise RuntimeError(
            f"ดึงแท่งเทียนไม่สำเร็จ: {mt5.last_error()}"
        )

    if len(rates) == 0:
        raise RuntimeError(
            f"ไม่พบข้อมูลแท่งเทียนของ {symbol}"
        )

    # เรียงตามเวลา จากเก่าไปใหม่
    rates = sorted(rates, key=lambda rate: rate["time"])

    candles = []

    for rate in rates:
        candles.append({
            "time": int(rate["time"]),
            "open": float(rate["open"]),
            "high": float(rate["high"]),
            "low": float(rate["low"]),
            "close": float(rate["close"]),
            "tick_volume": int(rate["tick_volume"]),
            "spread": int(rate["spread"]),
            "real_volume": int(rate["real_volume"]),
        })

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "digits": info.digits,
        "count": len(candles),
        "candles": candles,
    }

def get_price_with_retry(symbol):
    """ดึงราคาและพยายามเชื่อมต่อใหม่หากเกิดข้อผิดพลาด"""
    last_error = None

    for attempt in range(1, PRICE_RETRIES + 1):
        try:
            # ใช้การเชื่อมต่อเดิมก่อน
            return get_price(symbol)

        except Exception as error:
            last_error = error
            log(
                f"ดึงราคาไม่สำเร็จ "
                f"({attempt}/{PRICE_RETRIES}): {error}"
            )

            mt5.shutdown()

            if attempt < PRICE_RETRIES:
                time.sleep(RETRY_DELAY)

                try:
                    connect(symbol)
                except Exception as connect_error:
                    last_error = connect_error
                    mt5.shutdown()
                    log(f"เชื่อมต่อใหม่ไม่สำเร็จ: {connect_error}")

    raise RuntimeError(
        f"ดึงราคา {symbol} ไม่สำเร็จหลังลอง "
        f"{PRICE_RETRIES} ครั้ง: {last_error}"
    )


def main():
    # หาก MT5 ยังไม่พร้อม จะลองใหม่ก่อนแจ้งว่าเริ่มต้นสำเร็จ
    connect_with_retry("GOLD")
    send({"type": "ready"})

    # รอรับคำสั่งจาก Node.js ต่อไปเรื่อย ๆ
    for line in sys.stdin:
        request_id = None

        try:
            request = json.loads(line)
            request_id = request.get("id")

            action = request.get("action")

            if action == "symbols":
                result = get_symbols()

            elif action == "price":
                symbol = request.get("symbol", "GOLD")
                result = get_price_with_retry(symbol)

            elif action == "candles":
                symbol = request.get("symbol", "GOLD")
                timeframe = request.get("timeframe", "M15")
                count = request.get("count", 10)

                result = get_candles(symbol, timeframe, count)

            else:
                raise RuntimeError("ไม่รู้จักคำสั่งที่ได้รับ")

            send({
                "id": request_id,
                "ok": True,
                "data": result,
            })

        except Exception as error:
            send({
                "id": request_id,
                "ok": False,
                "error": str(error),
            })


if __name__ == "__main__":
    try:
        main()

    except Exception as error:
        send({
            "type": "startup_error",
            "error": str(error),
        })
        raise SystemExit(1)

    finally:
        mt5.shutdown()