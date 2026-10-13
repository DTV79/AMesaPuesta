#!/usr/bin/env python3
"""Descargar los archivos actuales de Supabase Storage para el respaldo cifrado."""
import json
import os
from pathlib import Path
import sys
from urllib.parse import quote
from urllib.request import Request, urlopen

BASE = "https://wmfcpnihymiiwgpvbngj.supabase.co/storage/v1"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ROOT = Path(sys.argv[1])
BUCKETS = ("comidas", "estatutos")
HEADERS = {
    "Authorization": "Bearer " + KEY,
    "apikey": KEY,
    "Content-Type": "application/json",
}

def request(url, data=None):
    req = Request(url, data=data, headers=HEADERS,
                  method="POST" if data is not None else "GET")
    with urlopen(req, timeout=90) as response:
        return response.read()

total = 0
for bucket in BUCKETS:
    count = 0
    pending = [""]
    while pending:
        prefix = pending.pop()
        offset = 0
        while True:
            payload = json.dumps({
                "prefix": prefix, "limit": 100, "offset": offset,
                "sortBy": {"column": "name", "order": "asc"}
            }).encode("utf-8")
            items = json.loads(request(f"{BASE}/object/list/{bucket}", payload))
            if not isinstance(items, list):
                raise RuntimeError("Respuesta de listado no válida para " + bucket)
            if not items:
                break
            for entry in items:
                name = entry["name"]
                if not isinstance(name, str) or name in ("", ".", "..") or "/" in name or "\\" in name:
                    raise RuntimeError("Nombre de archivo no válido en Storage")
                remote_path = prefix + name
                if entry.get("id") is None:
                    pending.append(remote_path + "/")
                    continue
                target = ROOT / bucket / remote_path
                target.parent.mkdir(parents=True, exist_ok=True)
                data = request(f"{BASE}/object/{bucket}/" + quote(remote_path, safe="/"))
                if not data:
                    raise RuntimeError("Archivo vacío en Storage: " + bucket + "/" + remote_path)
                target.write_bytes(data)
                count += 1
            if len(items) < 100:
                break
            offset += len(items)
    print(f"{bucket}: {count} objetos guardados")
    total += count
print("Total Storage:", total)
if total == 0:
    raise RuntimeError("No se descargó ningún objeto de Storage")
