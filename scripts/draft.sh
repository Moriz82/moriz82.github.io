#!/usr/bin/env bash
# draft.sh — encrypt/decrypt HTB writeup drafts for safe git storage.
#
# Usage:
#   ./scripts/draft.sh lock   posts/htb-boxname.md    → encrypts to drafts/, removes from posts/
#   ./scripts/draft.sh unlock drafts/htb-boxname.md.enc → decrypts to posts/ for editing
#   ./scripts/draft.sh edit   drafts/htb-boxname.md.enc → decrypt, open $EDITOR, re-encrypt
#
# Requires DRAFT_KEY env var or ~/.htb-draft-key file.

set -euo pipefail

KEY="${DRAFT_KEY:-$(cat ~/.htb-draft-key 2>/dev/null || true)}"
if [[ -z "$KEY" ]]; then
  echo "error: set DRAFT_KEY env var or create ~/.htb-draft-key" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRAFTS="$ROOT/drafts"
POSTS="$ROOT/posts"
mkdir -p "$DRAFTS"

cmd="${1:-help}"
file="${2:-}"

case "$cmd" in
  lock)
    [[ -f "$file" ]] || { echo "file not found: $file" >&2; exit 1; }
    base="$(basename "$file")"
    openssl enc -aes-256-cbc -pbkdf2 -salt -in "$file" -out "$DRAFTS/${base}.enc" -pass "pass:$KEY"
    rm "$file"
    # Remove generated HTML too
    html="${file%.md}.html"
    [[ -f "$html" ]] && rm "$html"
    echo "locked: $DRAFTS/${base}.enc"
    ;;
  unlock)
    [[ -f "$file" ]] || { echo "file not found: $file" >&2; exit 1; }
    base="$(basename "$file" .enc)"
    openssl enc -aes-256-cbc -pbkdf2 -d -in "$file" -out "$POSTS/$base" -pass "pass:$KEY"
    echo "unlocked: $POSTS/$base"
    ;;
  edit)
    [[ -f "$file" ]] || { echo "file not found: $file" >&2; exit 1; }
    base="$(basename "$file" .enc)"
    tmp="$(mktemp /tmp/draft-XXXXXX.md)"
    openssl enc -aes-256-cbc -pbkdf2 -d -in "$file" -out "$tmp" -pass "pass:$KEY"
    ${EDITOR:-vim} "$tmp"
    openssl enc -aes-256-cbc -pbkdf2 -salt -in "$tmp" -out "$file" -pass "pass:$KEY"
    rm "$tmp"
    echo "re-encrypted: $file"
    ;;
  *)
    echo "usage: draft.sh {lock|unlock|edit} <file>"
    ;;
esac
