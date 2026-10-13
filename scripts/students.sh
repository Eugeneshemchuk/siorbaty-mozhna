#!/bin/sh
# Manage who may register for the course (D1 database "siorbaty-auth").
#   sh scripts/students.sh add a@x.com b@y.com   allow these emails to register
#   sh scripts/students.sh remove a@x.com        revoke: deletes the allowance, account and sessions
#   sh scripts/students.sh list                  allowed emails and whether each has a verified account
# Add --local as the first argument to work on the local dev database (wrangler pages dev).
set -e
WHERE=--remote
[ "$1" = "--local" ] && { WHERE=--local; shift; }
cmd=$1; shift || true
q() { npx --yes wrangler@4 d1 execute siorbaty-auth $WHERE --command "$1"; }
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed "s/'//g"; }
case "$cmd" in
  add)    for e in "$@"; do e=$(lower "$e"); q "INSERT OR IGNORE INTO allowed (email, added_at) VALUES ('$e', unixepoch()*1000)"; echo "allowed: $e"; done ;;
  remove) for e in "$@"; do e=$(lower "$e"); q "DELETE FROM allowed WHERE email='$e'; DELETE FROM users WHERE email='$e'; DELETE FROM sessions WHERE email='$e'; DELETE FROM tokens WHERE email='$e'"; echo "removed: $e"; done ;;
  list)   q "SELECT a.email, COALESCE(u.verified, 0) AS registered FROM allowed a LEFT JOIN users u USING (email) ORDER BY a.email" ;;
  *)      sed -n 2,7p "$0"; exit 1 ;;
esac
