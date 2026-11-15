#!/usr/bin/env bash
# Runs every NASA GMAT case for Mission Architect and writes src/data/nasa/gmat.json.
#
#   GMAT_BIN=/path/to/GMAT/R2026a/bin tools/gmat/run_all.sh [case ...]
#
# GMAT: NASA General Mission Analysis Tool, console build (GmatConsole), from
# https://sourceforge.net/projects/gmat/files/GMAT/  (tested with R2026a, ubuntu-x64 tarball).
# Steps: (1) tools/orbits/nrho.py -> NRHO initial state, (2) make_scripts.py -> tools/gmat/scripts/*.script,
# (3) GmatConsole --run on each case (JOBS in parallel), outputs moved to tools/gmat/output/<case>/,
# (4) parse.py -> src/data/nasa/gmat.json. Pass case names to rerun only those (parse always reads all outputs).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
: "${GMAT_BIN:?set GMAT_BIN to the GMAT bin directory that contains GmatConsole}"
JOBS="${JOBS:-4}"

python3 "$ROOT/tools/orbits/nrho.py" > /dev/null
python3 "$HERE/make_scripts.py"

if [ "$#" -gt 0 ]; then CASES=("$@"); else
  CASES=(); for f in "$HERE"/scripts/*.script; do CASES+=("$(basename "$f" .script)"); done
fi

GMAT_OUT="$(cd "$GMAT_BIN/../output" && pwd)"
run_case() {
  local c="$1"
  mkdir -p "$HERE/output/$c"
  rm -f "${GMAT_OUT:?}/${c:?}_"*
  local t0=$SECONDS
  (cd "$GMAT_BIN" && ./GmatConsole --logfile "$GMAT_OUT/${c}_log.txt" --run "$HERE/scripts/$c.script" > /dev/null 2>&1) \
    || { echo "FAILED $c (see $GMAT_OUT/${c}_log.txt)"; return 1; }
  mv "$GMAT_OUT/${c}_"*.txt "$HERE/output/$c/"
  # keep only the error/summary lines of the log; full logs are large
  grep -E "GMAT|Build|ERROR|Warning|Run completed|Total Run Time" "$HERE/output/$c/${c}_log.txt" > "$HERE/output/$c/log_summary.txt" || true
  rm -f "${HERE:?}/output/${c:?}/${c:?}_log.txt"
  echo "ok $c ($((SECONDS - t0)) s)"
}
export -f run_case; export HERE GMAT_BIN GMAT_OUT
printf '%s\n' "${CASES[@]}" | xargs -P "$JOBS" -I{} bash -c 'run_case {}'

(cd "$GMAT_BIN" && ./GmatConsole --version 2>/dev/null | grep -E "Build Date" | head -1) > "$HERE/output/gmat_version.txt" || true
python3 "$HERE/parse.py"
