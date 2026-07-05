#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  compare-newer.sh <folderA> <folderB>
EOF
}

if [[ $# -ne 2 || "$1" == "-h" || "$1" == "--help" ]]; then
  usage
  if [[ $# -eq 2 ]]; then
    exit 0
  fi
  exit 2
fi

FOLDER_A="$1"
FOLDER_B="$2"

if [[ ! -d "$FOLDER_A" ]]; then
  echo "Directory not found: $FOLDER_A" >&2
  exit 1
fi

if [[ ! -d "$FOLDER_B" ]]; then
  echo "Directory not found: $FOLDER_B" >&2
  exit 1
fi

mapfile -t common < <(
  comm -12 \
    <(cd "$FOLDER_A" && find . -maxdepth 1 -type f -printf '%f\n' | sort) \
    <(cd "$FOLDER_B" && find . -maxdepth 1 -type f -printf '%f\n' | sort)
)

echo "COMMON FILES:"
printf '%s\n' "${common[@]}" | sed '/^$/d' | wc -l
echo

folder_a_newer=0
folder_b_newer=0
same=0
newest_a_name=''
newest_a_ts=0
newest_b_name=''
newest_b_ts=0

for f in "${common[@]}"; do
  ats=$(stat -c %Y "$FOLDER_A/$f")
  bts=$(stat -c %Y "$FOLDER_B/$f")
  afmt=$(date -d "@$ats" '+%Y-%m-%d %H:%M:%S')
  bfmt=$(date -d "@$bts" '+%Y-%m-%d %H:%M:%S')

  if (( ats > bts )); then
    result="$FOLDER_A newer"
    folder_a_newer=$((folder_a_newer+1))
  elif (( bts > ats )); then
    result="$FOLDER_B newer"
    folder_b_newer=$((folder_b_newer+1))
  else
    result='same timestamp'
    same=$((same+1))
  fi

  echo "$f"
  echo "  $FOLDER_A: $afmt"
  echo "  $FOLDER_B: $bfmt"
  echo "  result: $result"
  echo
done

while IFS= read -r f; do
  ts=$(stat -c %Y "$FOLDER_A/$f")
  if (( ts > newest_a_ts )); then
    newest_a_ts=$ts
    newest_a_name=$f
  fi
done < <(cd "$FOLDER_A" && find . -maxdepth 1 -type f -printf '%f\n')

while IFS= read -r f; do
  ts=$(stat -c %Y "$FOLDER_B/$f")
  if (( ts > newest_b_ts )); then
    newest_b_ts=$ts
    newest_b_name=$f
  fi
done < <(cd "$FOLDER_B" && find . -maxdepth 1 -type f -printf '%f\n')

echo 'SUMMARY'
echo "$FOLDER_A newer count: $folder_a_newer"
echo "$FOLDER_B newer count: $folder_b_newer"
echo "same timestamp count: $same"
echo
echo "Newest in $FOLDER_A: $newest_a_name @ $(date -d "@$newest_a_ts" '+%Y-%m-%d %H:%M:%S')"
echo "Newest in $FOLDER_B: $newest_b_name @ $(date -d "@$newest_b_ts" '+%Y-%m-%d %H:%M:%S')"

if (( newest_a_ts > newest_b_ts )); then
  echo "OVERALL: $FOLDER_A has the newer newest file."
elif (( newest_b_ts > newest_a_ts )); then
  echo "OVERALL: $FOLDER_B has the newer newest file."
else
  echo 'OVERALL: newest timestamps are equal.'
fi
