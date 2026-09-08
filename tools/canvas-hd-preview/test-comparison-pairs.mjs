import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TEST_ORIGIN||'http://localhost:4175')+'/canvas/');await page.waitForFunction(()=>window.__hd?.comparisons?.length&&__hd.game.time>1);
 const inspect=()=>page.evaluate(()=>{const h=__hd;return h.comparisons.map(({source,copy,sprite})=>{const view=h.renderer.entityPresentation(copy);return {type:source.type,dx:copy.x-source.x,dy:copy.y-source.y,sameState:copy.angle===source.angle&&copy.hp===source.hp&&copy.lastShot===source.lastShot&&copy.path===source.path,notCombatant:!h.game.getEntity(copy.id),original:view.sprite===h.original.sprites[source.type==='tanya'?'tany':'mtnk'],frameValid:view.frame>=0&&view.frame<sprite.frames,action:view.action};});});
 const pairs=await inspect();assert(pairs.some(p=>p.type==='apocalypse'));assert(pairs.some(p=>p.type==='tanya'));assert(pairs.every(p=>p.sameState&&p.notCombatant&&p.original&&p.frameValid&&p.dx>0&&p.dy<0));
 await page.click('#pause');
 for(const time of [.5,2,6.5,8,10]){await page.evaluate(t=>__hd.game.time=t,time);await page.waitForTimeout(100);assert((await inspect()).every(p=>p.frameValid&&p.sameState));}
 const actions=await inspect();assert(actions.some(p=>p.action==='swim'));assert(actions.some(p=>p.action==='fireprone'));
 await page.locator('#own-color').fill('#7a6beb');await page.locator('#own-color').dispatchEvent('input');
 assert(await page.evaluate(()=>__hd.comparisons.every(p=>p.source.owner===p.copy.owner)));
 await page.screenshot({path:'/tmp/paired-preview.png'});
 await page.click('#reset');assert.equal((await inspect()).length,pairs.length);assert.deepEqual(errors,[]);
 console.log('PASS original vehicle/Tanya pairs, shared pose state, complete swimming frames, reset and no added combatants');
}finally{await browser.close();}
