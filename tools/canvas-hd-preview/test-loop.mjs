import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TEST_ORIGIN||'http://localhost:4175')+'/canvas/');await page.waitForFunction(()=>window.__hd?.ready);
 await page.waitForFunction(()=>__hd.actors[2].lastMovedAt>0&&__hd.actors[5].lastMovedAt>0&&__hd.targets[1].lastHit>0);
 const a=await page.evaluate(()=>__hd.actors[5].x);await page.waitForTimeout(750);assert.notEqual(await page.evaluate(()=>__hd.actors[5].x),a);
 await page.waitForFunction(()=>__hd.game.time>7.5);assert(await page.evaluate(()=>__hd.actors[5].path.at(-1)?.x<=17));
 await page.evaluate(()=>{for(let i=0;i<2400;i++)__hd.game.step(.05);});
 const state=await page.evaluate(()=>({hp:__hd.targets.slice(0,2).map(e=>e.hp/e.maxHp),losses:__hd.game.players.map(p=>p.losses),hits:__hd.targets.slice(0,2).map(e=>e.lastHit)}));
 assert(state.hp.every(h=>h>=.019&&h<.05));assert.deepEqual(state.losses,[0,0]);assert(state.hits.every(t=>t>100));
 await page.waitForTimeout(200);await page.screenshot({path:'/tmp/hd-loop.png'});
 await page.click('#pause');const time=await page.evaluate(()=>__hd.game.time);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__hd.game.time),time);
 await page.click('#loop');assert.equal(await page.evaluate(()=>__hd.game.loopProtection),false);assert.equal(await page.evaluate(()=>__hd.automatic),false);
 assert.deepEqual(errors,[]);console.log('PASS automatic movement loop, repeated hits, 2% HP floor, no deaths, pause and manual mode');
}finally{await browser.close();}
