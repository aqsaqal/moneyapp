#!/usr/bin/env bash
# Capture the eight store screens from the iOS simulator, once per language.
#
#   bash scripts/capture-shots.sh <ctl dir> <output dir> [lang ...]
#
# Needs: the dev build on the booted simulator, Metro running with
# EXPO_PUBLIC_BYPASS_ONBOARDING=1 EXPO_PUBLIC_DEV_PROFILE=Demo EXPO_PUBLIC_SCREENSHOT_CTL=1,
# and `python3 -m http.server 8090` serving <ctl dir> (the app polls route.txt there).
# Per language: set the app language, relaunch, rebuild the Demo profile in that language,
# walk the screens. About two minutes each. Compose with scripts/store-shots.py.
set -uo pipefail
CTL="${1:?usage: capture-shots.sh <ctl dir> <output dir> [lang ...]}"; OUT="${2:?output dir}"; shift 2
LANGS=("$@"); [ ${#LANGS[@]} -eq 0 ] && LANGS=(en es pt fr de tr id ru kk ja ko zh)
APP=com.moneyflow.generic
LISTINGS=assets/store/generic/listings

go() { printf '%s\n' "$1" > "$CTL/route.txt"; sleep "${2:-2.5}"; }
shot() { xcrun simctl io booted screenshot "$1" >/dev/null 2>&1; }
locale() { case "$1" in en) echo en-US;; es) echo es-ES;; pt) echo pt-BR;; fr) echo fr-FR;; de) echo de-DE;; tr) echo tr-TR;;
  id) echo id-ID;; ru) echo ru-RU;; kk) echo kk-KZ;; ja) echo ja-JP;; ko) echo ko-KR;; zh) echo zh-CN;; esac; }
apple_lang() { case "$1" in pt) echo pt-BR;; zh) echo zh-Hans;; *) echo "$1";; esac; }

xcrun simctl status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3 2>/dev/null
go dismiss 2; go pro:on 2
for L in "${LANGS[@]}"; do
  D="$OUT/$L"; mkdir -p "$D"
  go dismiss 1.5; go "kv:themeId=mint" 1.5; go "kv:themeMode=dark" 1.5; go "kv:locale=$(locale "$L")" 2
  go "/" 0.5
  xcrun simctl terminate booted $APP >/dev/null 2>&1
  xcrun simctl launch booted $APP -AppleLanguages "($(apple_lang "$L"))" >/dev/null
  sleep "${BOOT_WAIT:-45}"
  go demo:rebuild 12
  go "/" 3; shot "$D/home.png"
  # Percent-encoded: a "+" in the base64 would arrive as a space and the prefill would be dropped.
  COFFEE=$(python3 -c "import json,sys;print(json.load(open('$LISTINGS/demo-$L.json'))['coffee'])")
  PREFILL=$(python3 -c "import json,base64,sys;import urllib.parse;print(urllib.parse.quote(base64.b64encode(json.dumps({'type':'expense','amount':4.5,'note':sys.argv[1],'category':'food'},ensure_ascii=False).encode()).decode(),safe=''))" "$COFFEE")
  go "/add?prefill=$PREFILL" 3.5; shot "$D/add.png"; go dismiss 2
  go "/plan?segment=bills" 3; shot "$D/plan.png"
  go "/event/demo-ev-trip" 3.5; shot "$D/event.png"; go dismiss 2
  go "/activity?view=categories" 3.5; shot "$D/activity.png"; go "/activity?view=list" 2
  go "/insights" 4; shot "$D/insights.png"; go dismiss 2
  go "/accounts" 3; shot "$D/accounts.png"
  go "/" 2; go "kv:themeId=espresso" 1.5; go "mode:light" 14; shot "$D/themes.png"
  go "kv:themeId=mint" 1.5; go "mode:dark" 12
  echo "captured $L"
done
