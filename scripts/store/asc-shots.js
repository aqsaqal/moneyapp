// Uploads the composed screenshots to App Store Connect. Runs inside the logged-in browser
// session (Playwright run-code, ASC tab). Expects http://127.0.0.1:8091 to serve todo.json
// (ASC locales to do, e.g. ["es-ES","es-MX"]) and out/ = build/store-out with manifest.json
// ({lang:{set:[{file,size,md5}]}}). Replaces what is there; two to three locales per run.
async (page) => {
  const H = {Accept:'application/json','Content-Type':'application/json','X-CSRF-ITC':'[asc-ui]'};
  const B = 'https://appstoreconnect.apple.com/iris/v1/';
  const L = 'http://127.0.0.1:8091/';
  const V = '0c41c1a3-8c1a-4339-ad4e-78e2ff9f5eec';
  const map = {'en-US':'en','es-ES':'es','es-MX':'es','pt-BR':'pt','fr-FR':'fr','de-DE':'de','tr':'tr','id':'id','ru':'ru','ja':'ja','ko':'ko','zh-Hans':'zh'};
  const sets = {APP_IPHONE_67:'appstore-6.9', APP_IPHONE_65:'appstore-6.5', APP_IPHONE_61:'appstore-6.3'};
  const R = async (method, url, opts) => {
    for (let i = 0; i < 3; i++) {
      const r = await page.request.fetch(url, {method, ...opts});
      if (r.status() !== 401) return r;
      await page.reload(); await page.waitForTimeout(7000);
    }
    throw new Error('401 after retries');
  };
  const get = async p => (await R('GET',B+p,{headers:H})).json();
  const todo = await (await page.request.get(L+'todo.json')).json();
  const man = await (await page.request.get(L+'out/manifest.json')).json();
  const locs = (await get('appStoreVersions/'+V+'/appStoreVersionLocalizations?limit=50')).data;
  const out = {};
  for (const loc of todo) {
    const lang = map[loc]; const lid = locs.find(x=>x.attributes.locale===loc).id; out[loc] = {};
    let have = (await get('appStoreVersionLocalizations/'+lid+'/appScreenshotSets?include=appScreenshots&limit=50'));
    for (const [type, dir] of Object.entries(sets)) {
      let set = have.data.find(x=>x.attributes.screenshotDisplayType===type);
      if (!set) {
        const r = await R('POST',B+'appScreenshotSets',{headers:H,data:{data:{type:'appScreenshotSets',attributes:{screenshotDisplayType:type},relationships:{appStoreVersionLocalization:{data:{type:'appStoreVersionLocalizations',id:lid}}}}}});
        if (r.status()>=300) { out[loc][type] = 'set '+r.status()+' '+(await r.text()).slice(0,200); continue; }
        set = (await r.json()).data;
      } else {
        for (const s of (set.relationships.appScreenshots.data||[])) await R('DELETE',B+'appScreenshots/'+s.id,{headers:H});
      }
      const ids = []; const errs = [];
      for (const f of man[lang][dir]) {
        const body = await (await page.request.get(L+'out/'+lang+'/'+dir+'/'+f.file)).body();
        const r = await R('POST',B+'appScreenshots',{headers:H,data:{data:{type:'appScreenshots',attributes:{fileName:lang+'-'+f.file,fileSize:f.size},relationships:{appScreenshotSet:{data:{type:'appScreenshotSets',id:set.id}}}}}});
        if (r.status()>=300) { errs.push(f.file+' reserve '+r.status()+' '+(await r.text()).slice(0,200)); continue; }
        const shot = (await r.json()).data;
        for (const op of shot.attributes.uploadOperations) {
          const h = {}; for (const x of op.requestHeaders) h[x.name] = x.value;
          const u = await page.request.fetch(op.url,{method:op.method,headers:h,data:body.subarray(op.offset,op.offset+op.length)});
          if (u.status()>=300) errs.push(f.file+' put '+u.status());
        }
        const c = await R('PATCH',B+'appScreenshots/'+shot.id,{headers:H,data:{data:{type:'appScreenshots',id:shot.id,attributes:{uploaded:true,sourceFileChecksum:f.md5}}}});
        if (c.status()>=300) errs.push(f.file+' commit '+c.status()+' '+(await c.text()).slice(0,200));
        ids.push(shot.id);
      }
      // keep the order of upload
      await R('PATCH',B+'appScreenshotSets/'+set.id+'/relationships/appScreenshots',{headers:H,data:{data:ids.map(id=>({type:'appScreenshots',id}))}});
      out[loc][type] = errs.length ? errs : ids.length;
    }
  }
  return out;
}
