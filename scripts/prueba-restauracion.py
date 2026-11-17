#!/usr/bin/env python3
"""Prueba de recuperación NO destructiva de una copia cifrada de Cofradía.

Comprueba huellas SHA-256 del manifiesto y restaura datos de tablas de negocio
en tablas TEXT de un PostgreSQL Docker temporal, sin crear conexión con
producción. No pretende reproducir Auth, RLS ni el esquema completo de Supabase.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

TABLAS = (
    "cofrades",
    "cuotas",
    "cuotas_cofrades",
    "pagos_cuotas",
    "comidas",
    "asistencias",
    "invitados_comida",
    "pagos_restaurante_comida",
    "gastos_adicionales_comida",
    "pagos_gastos_comida",
    "gastos_historicos_remanente_comida",
    "liquidaciones_comida",
    "liquidaciones_bote_comida",
    "cargos_bote",
    "ajustes_tesoreria_cofradia",
)
ESENCIALES = {"cofrades", "cuotas", "pagos_cuotas", "comidas"}
CONTENEDOR = "cofradia-recuperacion-temporal"
COPY_RE = re.compile(
    r"(?m)^COPY public\.([a-z_][a-z0-9_]*) \(([^)\n]+)\) FROM stdin;$"
)
CAMPO_RE = re.compile(r'^(?:"[a-z_][a-z0-9_]*"|[a-z_][a-z0-9_]*)$')


def ejecutar(args: list[str], *, entrada: str | None = None) -> str:
    resultado = subprocess.run(
        args, input=entrada, capture_output=True, text=True, check=False
    )
    if resultado.returncode:
        # No mostrar datos personales ni secretos de una restauración fallida.
        raise RuntimeError(
            f"Error al ejecutar {args[0]} ({resultado.returncode}). "
            "Consulta el estado del trabajo, sin publicar contenido del respaldo."
        )
    return resultado.stdout


def revisar_archivos(raiz: Path) -> tuple[int, int]:
    manifiesto = raiz / "manifest.json"
    if not manifiesto.is_file():
        raise RuntimeError("No existe manifest.json")
    m = json.loads(manifiesto.read_text(encoding="utf-8"))
    archivos = m.get("files")
    if not isinstance(archivos, list) or not archivos:
        raise RuntimeError("Manifiesto vacío o incorrecto")
    observados: set[str] = set()
    totales = {"comidas": 0, "estatutos": 0}
    for item in archivos:
        if not isinstance(item, dict):
            raise RuntimeError("Entrada de manifiesto incorrecta")
        nombre = item.get("name")
        if not isinstance(nombre, str):
            raise RuntimeError("Ruta de archivo no válida")
        ruta = PurePosixPath(nombre)
        if ruta.is_absolute() or not ruta.parts or any(p in (".", "..") for p in ruta.parts):
            raise RuntimeError("Ruta de archivo no segura")
        if nombre in observados:
            raise RuntimeError("Archivo repetido en manifiesto")
        observados.add(nombre)
        destino = raiz.joinpath(*ruta.parts)
        if not destino.is_file() or destino.is_symlink():
            raise RuntimeError("Falta un archivo del manifiesto")
        if destino.stat().st_size != item.get("bytes"):
            raise RuntimeError("El tamaño de un archivo no coincide")
        huella = hashlib.file_digest(destino.open("rb"), "sha256").hexdigest()
        if huella != item.get("sha256"):
            raise RuntimeError("SHA-256 incorrecto: respaldo alterado")
        if len(ruta.parts) >= 3 and ruta.parts[0] == "storage" and ruta.parts[1] in totales:
            totales[ruta.parts[1]] += 1
    actuales = {
        f.relative_to(raiz).as_posix()
        for f in raiz.rglob("*") if f.is_file() and f != manifiesto
    }
    if actuales != observados:
        raise RuntimeError("Los archivos del respaldo no coinciden con el manifiesto")
    if "base.dump" not in observados or not (raiz / "base.dump").read_bytes()[:5] == b"PGDMP":
        raise RuntimeError("El archivo de base de datos no es un dump PostgreSQL válido")
    if not all(totales.values()):
        raise RuntimeError("Faltan fotos o documentos estatutarios del respaldo")
    print(
        f"Integridad SHA-256: {len(archivos)} archivos correctos. "
        f"Storage: {totales['comidas']} fotos, {totales['estatutos']} documentos."
    )
    return totales["comidas"], totales["estatutos"]


def restaurar_datos(raiz: Path) -> None:
    dump = (raiz / "base.dump").resolve()
    # Docker sólo monta el directorio de respaldo en modo lectura.
    volumen = f"{raiz.resolve()}:/respaldo:ro"
    ejecutar([
        "docker", "run", "--rm", "--network", "none",
        "-v", volumen, "postgres:17", "pg_restore",
        "--list", "/respaldo/base.dump",
    ])
    print("Archivo PostgreSQL: índice pg_restore legible.")

    ejecutar([
        "docker", "run", "--rm", "--network", "none",
        "--name", CONTENEDOR, "-d",
        "-e", "POSTGRES_HOST_AUTH_METHOD=trust",
        "postgres:17",
    ])
    try:
        listo = False
        import time
        for _ in range(30):
            try:
                ejecutar(["docker", "exec", CONTENEDOR, "pg_isready", "-U", "postgres"])
                listo = True
                break
            except RuntimeError:
                time.sleep(1)
        if not listo:
            raise RuntimeError("PostgreSQL temporal no inicia")

        restauradas = 0
        for tabla in TABLAS:
            sql = ejecutar([
                "docker", "run", "--rm", "--network", "none",
                "-v", volumen, "postgres:17", "pg_restore",
                "--data-only", "--no-owner", "--no-acl",
                "--table", tabla, "-f", "-", "/respaldo/base.dump",
            ])
            coincidencias = list(COPY_RE.finditer(sql))
            if len(coincidencias) != 1 or coincidencias[0].group(1) != tabla:
                raise RuntimeError(
                    f"No se encontró exactamente una sección COPY para {tabla}. "
                    "No se confirma la restauración."
                )
            m = coincidencias[0]
            columnas = [v.strip() for v in m.group(2).split(",")]
            if not columnas or len(columnas) != len(set(columnas)) or not all(
                CAMPO_RE.fullmatch(v) for v in columnas
            ):
                raise RuntimeError(f"Cabecera COPY no válida en {tabla}")
            seccion = sql[m.end():].splitlines()
            if not seccion or seccion[0] != "":
                raise RuntimeError(f"Comienzo COPY no reconocido en {tabla}")
            try:
                fin = seccion.index(r"\.", 1)
            except ValueError as error:
                raise RuntimeError(f"Fin COPY no encontrado en {tabla}") from error
            filas_lineas = seccion[1:fin]
            filas = "\n".join(filas_lineas)
            n = len(filas_lineas)
            cols = ", ".join(f"{c} text" for c in columnas)
            encabezado = (
                "BEGIN;\n"
                f"CREATE TABLE public.{tabla} ({cols});\n"
                f"COPY public.{tabla} ({', '.join(columnas)}) FROM stdin;\n"
            )
            contenido = encabezado + (filas + "\n" if filas else "") + "\\.\nCOMMIT;\n"
            ejecutar(
                ["docker", "exec", "-i", CONTENEDOR, "psql",
                 "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
                entrada=contenido,
            )
            recuperadas = int(ejecutar([
                "docker", "exec", CONTENEDOR, "psql",
                "-U", "postgres", "-Atc", f"select count(*) from public.{tabla}"
            ]).strip())
            if recuperadas != n or (tabla in ESENCIALES and recuperadas <= 0):
                raise RuntimeError(f"Datos no recuperados correctamente en {tabla}")
            print(f"Tabla {tabla}: {recuperadas} filas restauradas y verificadas.")
            restauradas += 1
        print(f"PRUEBA_DE_RECUPERACION_OK: {restauradas} tablas de negocio.")
        print("NOTA: prueba de datos; no es una restauración funcional íntegra de Supabase.")
    finally:
        subprocess.run(
            ["docker", "rm", "-f", CONTENEDOR],
            capture_output=True, text=True, check=False,
        )


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Uso: prueba-restauracion.py <directorio-de-copia-descifrada>")
    raiz = Path(sys.argv[1]).resolve()
    if not raiz.is_dir():
        raise SystemExit("No existe el directorio de la copia")
    try:
        revisar_archivos(raiz)
        restaurar_datos(raiz)
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError) as error:
        print("PRUEBA_DE_RECUPERACION_FALLIDA:", str(error), file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
