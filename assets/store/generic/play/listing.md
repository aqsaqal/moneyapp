# Flow — Google Play listing

The listing text now lives in `assets/store/generic/listings/<lang>.json`,
one file per language (name, short description, full description, App Store
subtitle / keywords / What's New, and the eight screenshot captions).
English (`en.json`) is the source; `BRIEF.md` there has the rules and
`check.py` the length limits. How it gets to the consoles is in
`docs/release-playbook.md`, section 6a.

Play language codes: en-US, es-ES, pt-BR, fr-FR, de-DE, tr-TR, id, ru-RU,
kk, ja-JP, ko-KR, zh-CN.
