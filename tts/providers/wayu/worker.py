from wayu_tts import ThaiTTS
import sys

voices = [
    "f_elderly_low",
    "f_elderly_soft",
    "f_mid_clear",
    "f_mid_warm",
    "f_teen_bright",
    "f_young_bright",
    "f_young_clear",
    "f_young_warm",
    "m_elderly_deep",
    "m_mid_warm",
    "m_teen_bright",
    "m_young_clear",
]
voice = voices[11]  # เลือกเสียงที่ต้องการ

print("Loading Wayu...", flush=True)

tts = ThaiTTS.from_pretrained("wayu-ai/wayu-paxa-tts-edge")

print("READY", flush=True)

for line in sys.stdin:
    text = line.strip()

    if not text:
        continue

    if text == "__EXIT__":
        break

    print("Generating audio...", flush=True)

    audio = tts(
        text,
        voice=voice
    )

    tts.save("worker-test.wav", audio)

    print("DONE", flush=True)