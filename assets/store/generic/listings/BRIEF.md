# Translating Flow's store listing

Source: `en.json` (store listing) and `demo-en.json` (sample-data labels shown in screenshots) in this folder.
For each language code you are given, write `<code>.json` and `demo-<code>.json` here, same keys as the English files.

Flow is a private, offline personal finance app (iOS and Android). Write as a native copywriter would for an app store in that language: natural, plain, friendly, informal "you" where the language's app stores normally use it. Not word for word. No machine-translation stiffness.

## Use the app's own terms
The app is already translated: `/Users/admin/dev/projects/moneyapp/i18n/<file>.json` (es→es-ES, pt→pt-BR, fr→fr-FR, de→de-DE, tr→tr, id→id, ru→ru, kk→kk, ja→ja-JP, ko→ko-KR, zh→zh-CN). Before writing, grep it and reuse its wording for feature names so the listing matches what people see in the app: "Safe to spend" (home.*), Plan, Activity, Split, Events, Net worth, Insights, budgets, goals, debts, the theme names (grep Graphite / theme), widget names (Quick add), "Demo". Keep untranslated: Flow, Flow Pro, Smart Add if the app keeps it, PDF, JSON, CSV, URLs, the email.

## Hard limits (count characters, the check script enforces them)
- `name` ≤ 30. Must start with "Flow: " then a short descriptor in the language (like "Money Tracker").
- `subtitle` ≤ 30.
- `short` ≤ 80.
- `keywords` ≤ 100 characters total, comma separated, no space after commas, search terms a native speaker would type; do not repeat words from the name.
- `full` ≤ 4000. Keep the structure: section headings in capitals (where the script has capitals), "• " bullets, the three link lines at the end unchanged.
- `whatsNew` ≤ 4000, same structure.
- `notes` ≤ 500 (count carefully; shorten wording if needed, keep all six lines).
- `captions`: exactly 8 strings, same order, each one or two lines separated by "\n", each line at most about 24 characters (about 12 for ja/ko/zh). They are headlines over screenshots: punchy.

## Rules
- Do not mention Apple, iPhone, iOS, App Store, Android, Google or Play anywhere. "Home screen" is fine.
- No em dashes. Use the quotation marks native to the language.
- The Smart Add example "12 coffee" should use the language's word for coffee, and it must be the same word as the `coffee` (lower-case) entry in the demo file.
- `demo-<code>.json`: keys stay English, values are short everyday labels a person in that country would type into a finance app (account names, bills, notes). Keep them short, at most about 22 characters. "Miami trip", "Dinner at Joe's" stay recognisable (translate "trip", "Dinner at"). 

## Check
Run `python3 assets/store/generic/listings/check.py <code> ...` from the repo root and fix every failure before you finish. Reply with one line per language: the name, the subtitle, and anything you were unsure about.
