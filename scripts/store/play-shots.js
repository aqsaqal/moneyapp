// Fills the Play listing text and the eight phone screenshots per language. Runs inside the
// logged-in browser session (Playwright run-code) on the Play Console page
// Store listings > Edit default listing. Expects http://127.0.0.1:8091 to serve play-todo.json
// (e.g. ["es","pt"]) and listings/<lang>.json; files staged as .playwright-mcp/up/<lang>/<lang>-phone-<n>-<shot>.png.
// Saves a draft per language; sending for review is a separate step (Next, Save, Publishing overview).
async (page) => {
  const map = {zh:'zh-CN',fr:'fr-FR',de:'de-DE',id:'id',ja:'ja-JP',kk:'kk',ko:'ko-KR',pt:'pt-BR',ru:'ru-RU',es:'es-ES',tr:'tr-TR',en:'en-US'};
  const shots = ['home','add','plan','event','activity','insights','accounts','themes'];
  const todo = await (await page.request.get('http://127.0.0.1:8091/play-todo.json')).json();
  const out = {};
  const order = () => page.evaluate(() => [...document.querySelectorAll('button[aria-label^="Remove "]')].filter(e=>e.offsetParent).map(b=>b.getAttribute('aria-label').slice(7)).filter(n=>!/^icon|^feature/.test(n)));
  for (const l of todo) {
    const code = map[l];
    await page.reload(); await page.waitForTimeout(8000);
    const L = await (await page.request.get('http://127.0.0.1:8091/listings/'+l+'.json')).json();
    const cur = page.locator('button').filter({hasText:/ – [a-z]{2}(-[A-Z]{2})?\s*arrow_drop_down/}).first();
    if (!(await cur.innerText()).includes('– '+code+'\n')) {
      await cur.click(); await page.waitForTimeout(800);
      await page.locator('[role=menuitem], [role=option], [role=menuitemradio]').filter({hasText: new RegExp('– '+code+'(\\s|$)')}).first().click();
      await page.waitForTimeout(2000);
    }
    const vis = page.locator('input:not([type=file]):not([type=checkbox]):visible, textarea:visible');
    await vis.nth(0).fill(L.name); await vis.nth(1).fill(L.short); await vis.nth(2).fill(L.full);
    const nm = await vis.nth(0).inputValue();
    const names = shots.map((n,i)=>l+'-phone-'+(i+1)+'-'+n+'.png');
    const add = page.locator('button:visible', {hasText:'Add assets'}).nth(2);
    await add.scrollIntoViewIfNeeded(); await add.click(); await page.waitForTimeout(2000);
    if (await page.locator('[aria-label$="elected asset '+names[0]+'"]').count() === 0) {
      await page.locator('input[type=file]').first().setInputFiles(names.map(n=>'/Users/admin/dev/projects/moneyapp/.playwright-mcp/up/'+l+'/'+n));
      for (let i=0;i<40;i++) { await page.waitForTimeout(1500); let ok = 0; for (const n of names) ok += await page.locator('[aria-label$="elected asset '+n+'"]').count() ? 1 : 0; if (ok === 8) break; }
      await page.waitForTimeout(3000);
    }
    // uploads land in the slot in arrival order: clear, then pick in the wanted order
    for (let i=0;i<10;i++) { const rm = page.locator('button:visible[aria-label^="Remove '+l+'-phone"]'); if (await rm.count()===0) break; await rm.first().click(); await page.waitForTimeout(600); }
    for (const n of names) { const s = page.locator('[aria-label="Selected asset '+n+'"]'); if (await s.count()) { await s.first().click(); await page.waitForTimeout(400); } }
    for (const n of names) { await page.locator('[aria-label="Deselected asset '+n+'"]').first().click(); await page.waitForTimeout(400); }
    await page.locator('button:visible').filter({hasText:/^\s*\S*\s*Add\s*$/}).last().click();
    await page.waitForTimeout(3000);
    out[l] = {lang: (await cur.innerText()).split('\n')[0], order: (await order()).map(n=>n.replace(/-phone-|\.png/g,' ').trim()).join(',')};
    await page.getByRole('button',{name:'Save as draft'}).click(); await page.waitForTimeout(6000);
    out[l].name = nm; out[l].saved = await page.evaluate(()=>document.body.innerText.match(/Your changes have been saved/)?.[0] || document.body.innerText.match(/[^\n]*(error|couldn)[^\n]*/i)?.[0]);
  }
  return out;
}
