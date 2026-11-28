import hashlib, json, os, sys
root='build/store-out'; m={}
for lang in sorted(os.listdir(root)):
    if not os.path.isdir(f'{root}/{lang}'): continue
    m[lang]={}
    for s in sorted(os.listdir(f'{root}/{lang}')):
        m[lang][s]=[]
        for f in sorted(os.listdir(f'{root}/{lang}/{s}')):
            b=open(f'{root}/{lang}/{s}/{f}','rb').read()
            m[lang][s].append({'file':f,'size':len(b),'md5':hashlib.md5(b).hexdigest()})
json.dump(m,open(f'{root}/manifest.json','w'))
print({k:{s:len(v) for s,v in d.items()} for k,d in m.items()})
