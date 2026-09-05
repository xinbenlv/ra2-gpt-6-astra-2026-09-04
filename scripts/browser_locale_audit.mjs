/** Uses the asset cache created by browser_setup.py; does not download or serve original assets. */
import { chromium } from '@playwright/test';
const context = await chromium.launchPersistentContext(process.env.RA2_BROWSER_PROFILE || '.cache/browser-acceptance', {headless:true,viewport:{width:1440,height:1000}});
const page=context.pages()[0]||await context.newPage(); const errors=[],requests=[];
page.on('pageerror',error=>errors.push(String(error)));page.on('request',request=>requests.push(request.url()));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const han=()=>page.evaluate(()=>{
 const values=[]; const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let node;
 while(node=walk.nextNode()){if(node.parentElement?.closest('script,style,[data-language-control]'))continue;if(/[\u3400-\u9fff]/.test(node.nodeValue||''))values.push(node.nodeValue);}
 return values;
});
try{
 await page.goto(process.env.RA2_BROWSER_URL || 'http://127.0.0.1:4174/',{waitUntil:'networkidle'});await page.waitForSelector('#start',{timeout:90000});
 await page.evaluate(()=>localStorage.removeItem('ra2-language'));await page.reload({waitUntil:'networkidle'});await page.waitForSelector('#start',{timeout:90000});
 assert(await page.locator('html').getAttribute('lang')==='en','English must be default');
 assert((await han()).length===0,'Untranslated Chinese in English lobby');
 await page.screenshot({path:'.cache/locale-lobby-en-desktop.png'});
 await page.setViewportSize({width:1366,height:768});await page.screenshot({path:'.cache/locale-lobby-en-laptop.png'});
 assert(await page.evaluate(()=>document.querySelector('.checks').getBoundingClientRect().bottom<=document.querySelector('.settings-panel').getBoundingClientRect().bottom),'Laptop settings overflow');
 await page.locator('#help').click(); assert((await han()).length===0,'Untranslated Chinese in English help');await page.locator('#help-close').click();
 await page.locator('[data-language-select]').selectOption('zh-CN');assert(await page.locator('#start').innerText()==='开始作战','Chinese lobby switch');
 await page.reload({waitUntil:'networkidle'});await page.waitForSelector('#start',{timeout:90000});assert(await page.locator('#start').innerText()==='开始作战','Chinese persisted');
 await page.locator('[data-language-select]').selectOption('en');await page.locator('#start').click();await page.waitForSelector('#battlefield-canvas');await page.keyboard.press('d');await page.waitForTimeout(900);
 assert((await han()).length===0,'Untranslated Chinese in English game');await page.screenshot({path:'.cache/locale-game-en-laptop.png'});
 await page.evaluate(()=>window.auditGame=window.ra2.game);
 await page.locator('[data-language-select]').selectOption('zh-CN');assert(await page.evaluate(()=>window.auditGame===window.ra2.game),'Switch must preserve running game');
 assert((await page.locator('#game-options').innerText()).includes('选项'),'Chinese HUD');await page.screenshot({path:'.cache/locale-game-zh-laptop.png'});
 await page.locator('[data-language-select]').selectOption('en');assert(await page.evaluate(()=>window.auditGame===window.ra2.game),'English switch must preserve running game');
 await page.locator('#game-options').click();assert((await han()).length===0,'Untranslated Chinese in English pause menu');await page.locator('#leave').click();
 const countBefore=requests.filter(url=>url.includes('archive.org')).length;
 const removed=await page.evaluate(async()=>{const original=await caches.open('ra2-originals-v2');const keys=await original.keys();const request=keys.find(r=>r.url.endsWith('/assets/audio/hm2.wav'))||keys.find(r=>r.url.includes('/assets/audio/'));if(!request)throw Error('No audio cached');const value=await original.match(request);const backup=await caches.open('ra2-locale-audit-backup');await backup.put(request,value.clone());await original.delete(request);return request.url;});
 await page.reload({waitUntil:'networkidle'});await page.waitForSelector('#setup-download',{timeout:90000});assert(requests.filter(url=>url.includes('archive.org')).length===countBefore,'Missing cached asset must not trigger download');
 await page.evaluate(async removed=>{const original=await caches.open('ra2-originals-v2'),backup=await caches.open('ra2-locale-audit-backup');await original.put(removed,await backup.match(removed));await caches.delete('ra2-locale-audit-backup');},removed);
 await page.locator('#setup-recheck').click();await page.waitForSelector('#start',{timeout:90000});console.log('CACHE_MISSING_RECOVERY_PASS',removed);
 console.log('ERRORS',JSON.stringify(errors));assert(!errors.length,'Browser errors');
 console.log('PASS English default; Chinese persisted; running match retained; missing cache requires consent; no new IA download.');
}finally{
 // Restore the deliberate test deletion even if an assertion fails partway through.
 await page.evaluate(async()=>{if(!await caches.has('ra2-locale-audit-backup'))return;const backup=await caches.open('ra2-locale-audit-backup'),original=await caches.open('ra2-originals-v2');for(const request of await backup.keys())await original.put(request,await backup.match(request));await caches.delete('ra2-locale-audit-backup');}).catch(()=>{});
 await context.close();
}
