#!/usr/bin/env bash
# Usage: stage-dist.sh <dist> <out>
# Copies <dist> to <out> and renames every *.html (except index.html and 404.html,
# any depth) to the path without ".html" (GCS serves them as extensionless pages).
# The list of renamed objects is written to <out>/../extensionless.txt.
# A page whose extensionless name is also a directory (blog.html next to blog/) cannot be
# renamed on a local filesystem. It stays as <name>.html, is listed in <out>/../collisions.txt
# and must be uploaded to the object <name> separately (see deploy_web.yml).
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <dist> <out>" >&2
  exit 2
fi

dist="${1%/}"
out="${2%/}"

[ -d "$dist" ] || { echo "dist not found: $dist" >&2; exit 1; }

rm -rf "$out"
mkdir -p "$out"
cp -a "$dist/." "$out/"

list="$(dirname "$out")/extensionless.txt"
collisions="$(dirname "$out")/collisions.txt"
: > "$list"
: > "$collisions"

while IFS= read -r -d '' file; do
  rel="${file#"$out"/}"
  case "$rel" in
    index.html|404.html) continue ;;
  esac
  echo "${rel%.html}" >> "$list"
  if [ -d "${file%.html}" ]; then
    echo "$rel" >> "$collisions"
  else
    mv "$file" "${file%.html}"
  fi
done < <(find "$out" -type f -name '*.html' -print0 | sort -z)

echo "staged $(wc -l < "$list" | tr -d ' ') extensionless objects ($(wc -l < "$collisions" | tr -d ' ') kept as .html) -> $out"
