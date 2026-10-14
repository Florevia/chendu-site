#!/usr/bin/env bash
# Vercel build: only text sources are uploaded (data.json, build.py, css/js);
# fonts + mp3 + html are generated here, then copied to ./public (outputDirectory).
set -euo pipefail
PY=${PY:-python3}
$PY --version
PKGS="edge-tts gTTS fonttools brotli"
$PY -m pip install -q --disable-pip-version-check $PKGS \
  || $PY -m pip install -q --disable-pip-version-check --user --break-system-packages $PKGS \
  || uv pip install --system --break-system-packages $PKGS
mkdir -p tools/fonts
[ -f tools/fonts/MaShanZheng-Regular.ttf ] || curl -fsSL --retry 3 -o tools/fonts/MaShanZheng-Regular.ttf \
  https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf
[ -f tools/fonts/Caveat.ttf ] || curl -fsSL --retry 3 -o tools/fonts/Caveat.ttf \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/Caveat%5Bwght%5D.ttf"
$PY tools/build.py --tts-missing
rm -rf public && mkdir public
cp -r index.html assets issues public/
find public -name data.json -delete
ls -laR public
