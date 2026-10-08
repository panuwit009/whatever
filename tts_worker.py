from wayu_tts import ThaiTTS
import sys

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
        voice="m_young_clear"
    )

    tts.save("worker-test.wav", audio)

    print("DONE", flush=True)