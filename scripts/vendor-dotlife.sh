#!/usr/bin/env bash
# Copies the dotlife packages the extension shares with the app (sync rules, task model, calendars,
# occasions, prayer times) from a dotlife checkout into packages/, and records which commit.
# Usage: scripts/vendor-dotlife.sh ../dotlife
set -euo pipefail
SRC="${1:?path to a dotlife checkout}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKGS=(shared sync tasks calendar-core event-data prayer-times)
for p in "${PKGS[@]}"; do
  rm -rf "$ROOT/packages/$p"
  mkdir -p "$ROOT/packages/$p"
  (cd "$SRC/packages/$p" && tar --exclude=node_modules -cf - .) | (cd "$ROOT/packages/$p" && tar -xf -)
done
COMMIT="$(git -C "$SRC" rev-parse HEAD)"
cat > "$ROOT/packages/VENDORED.md" <<MD
# Packages from dotlife

\`shared\`, \`sync\`, \`tasks\`, \`calendar-core\`, \`event-data\` and \`prayer-times\` are copies of the
same packages in [dotlife](https://github.com/mostafauxd-cmyk/dotlife) at commit \`$COMMIT\`.
The extension must follow exactly the app's sync rules and data model, so these are never edited
here: change them in dotlife, then copy them again with \`scripts/vendor-dotlife.sh <dotlife checkout>\`.
MD
echo "vendored ${PKGS[*]} from $COMMIT"
