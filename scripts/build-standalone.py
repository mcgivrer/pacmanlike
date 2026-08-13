#!/usr/bin/env python3
"""Génère un fichier HTML autonome (standalone) pour PacmanLike.

Inline le HTML, le CSS et tout le JavaScript (modules ES convertis en un
script unique) dans un seul fichier `pacmanlike-standalone.html`.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "pacmanlike-standalone.html"

JS_ORDER = [
    "shaders/crt.glsl.js",
    "crt.js",
    "input.js",
    "music.js",
    "main.js",
]

SCRIPT_TAG_RE = re.compile(r"""<script[^>]*\bsrc=["']main\.js["'][^>]*>\s*</script>\s*""")
IMPORT_RE = re.compile(r"""^\s*import\s+.*?from\s+['"][^'"]+['"];?\s*$""", re.MULTILINE)
EXPORT_RE = re.compile(r"""^\s*export\s+(const|function|class|let|var)\b""", re.MULTILINE)


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


def transform_module(src):
    """Convertit un module ES en script classique:
    - supprime les `import { ... } from '...'`;
    - supprime les `export ` devant `const`/`function`.
    Les symboles déclarés deviennent accessibles aux modules suivants
    car ils sont concaténés dans la même portée de script (globale).
    """
    src = IMPORT_RE.sub("", src)
    src = EXPORT_RE.sub(r"\1", src)
    return src


def main():
    index = read("index.html")
    css = read("styles.css")

    # Extraire le contenu du <body> (entre <body> et </body>).
    m = re.search(r"<body>(.*?)</body>", index, flags=re.DOTALL)
    if not m:
        print("Erreur: balise <body> introuvable dans index.html", file=sys.stderr)
        sys.exit(1)
    body = m.group(1).strip()
    # Retirer la balise <script src="main.js"> (remplacée par le script inliné).
    body = SCRIPT_TAG_RE.sub("", body)

    # Concaténer les modules JS transformés.
    js_parts = [transform_module(read(p)) for p in JS_ORDER]
    js = "\n\n".join(js_parts)

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#000000">
  <title>PacmanLike (autonome)</title>
  <style>
{css}
  </style>
</head>
<body>
{body}
  <script>
{js}
  </script>
</body>
</html>
"""

    OUT.write_text(html, encoding="utf-8")
    print(f"Fichier autonome généré: {OUT} ({OUT.stat().st_size} octets)")


if __name__ == "__main__":
    main()
