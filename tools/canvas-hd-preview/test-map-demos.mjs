import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TEST_ORIGIN||'http://localhost:4175')+'/canvas/');await page.waitForFunction(()=>window.__hd?.demos?.prone.lastShot>0);
 assert.equal(await page.locator('.tanya-scenarios').count(),0);
 assert(await page.evaluate(()=>__hd.demos.target.hp<__hd.demos.target.maxHp));
 await page.click('#pause');
 const sample=async t=>{await page.evaluate(t=>__hd.game.time=t,t);await page.waitForTimeout(100);return page.evaluate(()=>{const h=__hd,d=h.demos;return {prone:h.renderer.entityPresentation(d.prone)?.action,swim:h.renderer.entityPresentation(d.swim)?.action,water:h.game.map.cells[Math.round(d.swim.y)*h.game.map.width+Math.round(d.swim.x)],height:h.renderer.entityPresentation(d.slope).height,angle:d.slope.angle,x:d.swim.x};});};
 assert.equal((await sample(.5)).prone,'prone');assert.equal((await sample(2)).prone,'pronefire');assert.equal((await sample(6.5)).prone,'prone');assert.equal((await sample(7.5)).prone,undefined);
 const up=await sample(2),down=await sample(8);assert.equal(up.swim,'swim');assert.equal(up.water,'water');assert(up.height>0);assert.notEqual(up.angle,down.angle);assert.notEqual(up.height,down.height);
 const frozen=await page.evaluate(()=>({x:__hd.demos.swim.x,time:__hd.game.time}));await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>({x:__hd.demos.swim.x,time:__hd.game.time})),frozen);
 // Picking and close-up use the very same entity and special sprite shown on the battlefield.
 await page.evaluate(()=>__hd.renderer.setSelection([__hd.demos.swim.id]));await page.click('#pause');await page.waitForFunction(()=>document.querySelector('#action').textContent==='游泳');
 await page.locator('#own-color').fill('#a960ee');await page.locator('#own-color').dispatchEvent('input');assert.equal(await page.evaluate(()=>__hd.game.players[0].color),'#a960ee');
 await page.screenshot({path:'/tmp/tanya-map.png'});assert.deepEqual(errors,[]);console.log('PASS in-map prone attack, water swimming, ramp motion, pause, selection and color');
}finally{await browser.close();}
