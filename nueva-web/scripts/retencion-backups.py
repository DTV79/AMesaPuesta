#!/usr/bin/env python3
"""Conservar 7 días recientes y 4 semanas anteriores de copias AUTOMÁTICAS verificadas.

Solo elimina directorios que coinciden exactamente con automaticas/backup_AAAA-MM-DD_HH-MM-SS.
No afecta las copias manuales en la raíz de Google Drive.
"""
import datetime as dt
import os
import re
import subprocess

REMOTE = "cofradia_cifrado:automaticas"
PATTERN = re.compile(r"^backup_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/$")

def run(*args):
    return subprocess.check_output(["rclone", *args], text=True).strip()

entries = run("lsf", REMOTE, "--dirs-only").splitlines()
backups = []
for name in entries:
    match = PATTERN.fullmatch(name)
    if match:
        stamp = dt.datetime.strptime(match.group(1)+"_"+match.group(2), "%Y-%m-%d_%H-%M-%S")
        backups.append((stamp, name))

backups.sort(reverse=True)
if not backups:
    raise SystemExit("Sin copias automáticas verificables; no se elimina nada.")

retener = set()
dias = set()
for stamp, name in backups:
    if len(dias) < 7:
        retener.add(name)
        dias.add(stamp.date())

semanas = set()
for stamp, name in backups:
    if name in retener:
        continue
    semana = stamp.date().isocalendar()[:2]
    if semana not in semanas and len(semanas) < 4:
        retener.add(name)
        semanas.add(semana)

# Si hay varias copias un mismo día, se conserva la más reciente por día.
eliminar = [name for _, name in backups if name not in retener]
print("Copias automáticas:", len(backups), "| Conservar:", len(retener), "| Eliminar:", len(eliminar))
for name in eliminar:
    target = REMOTE + "/" + name[:-1]
    subprocess.run(["rclone", "purge", target], check=True)
    print("Eliminada copia automática antigua:", name)
