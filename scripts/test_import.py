import json
import urllib.request
from pathlib import Path

csv_path = Path(__file__).resolve().parents[1] / "data" / "mock_registrations.csv"
boundary = "----testboundary"
body = (
    f"--{boundary}\r\n"
    'Content-Disposition: form-data; name="file"; filename="mock.csv"\r\n'
    "Content-Type: text/csv\r\n\r\n"
    f"{csv_path.read_text(encoding='utf-8')}\r\n"
    f"--{boundary}--\r\n"
).encode("utf-8")

req = urllib.request.Request("http://127.0.0.1:8080/api/import", data=body, method="POST")
req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
print("count:", data.get("count"))
print("rows:", len(data.get("rows", [])))
if data.get("rows"):
    print("first:", data["rows"][0]["full_name"])
