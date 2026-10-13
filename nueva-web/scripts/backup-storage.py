#!/usr/bin/env python3
"""Descarga los objetos actuales de Storage usando una clave de servicio solo en CI."""
import json, os, pathlib, sys, urllib.request, urllib.parse
BASE="https://wmfcpnihymiiwgpvbngj.supabase.co/storage/v1"
KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ROOT=pathlib.Path(sys.argv[1])
HEAD={"Authorization":"Bearer "+KEY,"apikey":KEY,"Content-Type":"application/json"}
def request(url,data=None):
    req=urllib.request.Request(url,data=data,headers=HEAD,method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req,timeout=60) as resp:return resp.read()
count=0
for bucket in ("comidas","estatutos"):
    pending=[""]
    while pending:
        prefix=pending.pop()
        offset=0
        while True:
            payload=json.dumps({"prefix":prefix,"limit":100,"offset":offset,"sortBy":{"column":"name","order":"asc"}}).encode()
            items=json.loads(request(f"{BASE}/object/list/{bucket}",payload))
            if not items:break
            for obj in items:
                name=obj["name"]
                path=prefix+name
                if obj.get("id") is None:
                    pending.append(path+"/")
                    continue
                target=ROOT/bucket/path
                target.parent.mkdir(parents=True,exist_ok=True)
                quoted=urllib.parse.quote(path,safe="/")
                target.write_bytes(request(f"{BASE}/object/{bucket}/{quoted}"))
                if target.stat().st_size==0:raise RuntimeError("Archivo vacio: "+str(target))
                count+=1
            if len(items)<100:break
            offset+=len(items)
print("Archivos Storage descargados:",count)
if count==0:raise RuntimeError("Storage sin archivos: comprobar permisos o inventario")
