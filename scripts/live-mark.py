"""Send one marking request to a running marking-service. Costs real AI calls.
Usage: python3 scripts/live-mark.py QUESTION_TEXT ANSWER_IMAGE [out.json]
Reads MARK_DEV_TOKEN and PORT from .env. Never prints them."""
import base64, io, json, sys, time, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

env = dict(l.split("=", 1) for l in Path(".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
q = Image.new("RGB", (900, 120), "white")
d = ImageDraw.Draw(q)
d.text((20, 20), sys.argv[1], fill="black", font=ImageFont.load_default(size=26))
buf = io.BytesIO(); q.save(buf, "PNG")
ans = Path(sys.argv[2]).read_bytes()
body = {"blockImage": {"mimeType": "image/png", "base64": base64.b64encode(buf.getvalue()).decode()},
        "answerImage": {"mimeType": "image/jpeg", "base64": base64.b64encode(ans).decode()},
        "tags": {"course": "TEST", "question": "1"}}
r = urllib.request.Request(f"http://localhost:{env.get('PORT','3001')}/api/mark", json.dumps(body).encode(),
    {"content-type": "application/json", "authorization": "Bearer " + env["MARK_DEV_TOKEN"]})
t = time.time()
try:
    out = urllib.request.urlopen(r, timeout=180).read().decode()
except urllib.error.HTTPError as e:
    out = e.read().decode(); print("HTTP", e.code)
print(f"{time.time()-t:.1f}s")
if len(sys.argv) > 3: Path(sys.argv[3]).write_text(out)
print(json.dumps(json.loads(out), indent=1))
