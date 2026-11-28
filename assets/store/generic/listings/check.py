"""Check translated listings against the store limits: python3 check.py [code ...]"""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
en = json.load(open(f'{here}/en.json')); den = json.load(open(f'{here}/demo-en.json'))
LIM = {'name': 30, 'subtitle': 30, 'short': 80, 'keywords': 100, 'full': 4000, 'whatsNew': 4000, 'notes': 500}
BAD = ['Apple', 'iPhone', 'iOS', 'App Store', 'Android', 'Google', 'Play Store', '—']
codes = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(here) if f.endswith('.json') and not f.startswith('demo-'))
ok = True
def fail(c, m):
    global ok; ok = False; print(f'FAIL {c}: {m}')
for c in codes:
    try:
        d = json.load(open(f'{here}/{c}.json')); dd = json.load(open(f'{here}/demo-{c}.json'))
    except Exception as e:
        fail(c, e); continue
    if set(d) != set(en): fail(c, f'keys differ: {set(d) ^ set(en)}')
    for k, n in LIM.items():
        if len(d.get(k, '')) > n: fail(c, f'{k} is {len(d[k])} > {n}')
        if not d.get(k): fail(c, f'{k} empty')
    if not d.get('name', '').startswith('Flow: '): fail(c, 'name must start with "Flow: "')
    if ', ' in d.get('keywords', ''): fail(c, 'space after comma in keywords')
    caps = d.get('captions', [])
    if len(caps) != 8: fail(c, f'{len(caps)} captions')
    for cap in caps:
        if cap.count('\n') > 1: fail(c, f'caption has 3+ lines: {cap!r}')
    for k in ('full', 'whatsNew', 'notes', 'short', 'subtitle', 'keywords', 'name'):
        for b in BAD:
            if b in d.get(k, ''): fail(c, f'{k} contains {b!r}')
    for u in ('https://aqsaqal.github.io/moneyapp/flow/privacy/', 'https://aqsaqal.github.io/moneyapp/flow/terms/', 'ak.saken@gmail.com'):
        if u not in d.get('full', ''): fail(c, f'full lacks {u}')
    if d.get('full', '').count('•') != en['full'].count('•'): fail(c, 'bullet count in full differs')
    if set(dd) != set(den): fail(c, f'demo keys differ: {set(dd) ^ set(den)}')
    for k, v in dd.items():
        if len(v) > 26: fail(c, f'demo {k!r} too long: {v!r}')
    print(c, 'name', len(d.get('name', '')), 'sub', len(d.get('subtitle', '')), 'short', len(d.get('short', '')), 'kw', len(d.get('keywords', '')), 'full', len(d.get('full', '')), 'notes', len(d.get('notes', '')))
sys.exit(0 if ok else 1)
