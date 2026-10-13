#!/bin/sh
# One-time setup of the student-management Telegram bot (functions/api/telegram.js).
#   1. Create a bot with @BotFather in Telegram and copy its token.
#   2. Run in your own terminal: sh scripts/telegram-setup.sh   (it asks for the token; it is not saved anywhere)
# Generates a webhook secret, stores it as the Pages secret TELEGRAM_SECRET, points the bot at
# https://siorbaty-mozhna.com/api/telegram and redeploys. Re-running it rotates the secret.
set -e
cd "$(dirname "$0")/.."
TOKEN=$1
if [ -z "$TOKEN" ]; then printf 'Bot token from @BotFather: '; stty -echo 2>/dev/null; read -r TOKEN; stty echo 2>/dev/null; echo; fi
API="https://api.telegram.org/bot$TOKEN"
curl -fsS "$API/getMe" | grep -q '"ok":true' || { echo "Telegram rejected the token."; exit 1; }
SECRET=$(openssl rand -hex 32)
printf '%s' "$SECRET" | npx --yes wrangler@4 pages secret put TELEGRAM_SECRET --project-name siorbaty-mozhna
sh scripts/deploy.sh
curl -fsS "$API/setWebhook" -d url=https://siorbaty-mozhna.com/api/telegram -d secret_token="$SECRET" \
  -d 'allowed_updates=["message"]' -d drop_pending_updates=true; echo
curl -fsS "$API/setMyCommands" -H 'Content-Type: application/json' -d '{"commands":[
  {"command":"add","description":"додати учнів (email…)"},
  {"command":"invite","description":"надіслати запрошення ще раз"},
  {"command":"remove","description":"видалити доступ"},
  {"command":"list","description":"список учнів"}]}'; echo
echo "Done. Write to your bot in Telegram: it will reply with your Telegram ID until that ID is in TELEGRAM_ADMINS (wrangler.toml)."
