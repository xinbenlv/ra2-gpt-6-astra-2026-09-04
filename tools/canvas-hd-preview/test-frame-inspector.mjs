import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TEST_ORIGIN||'http://localhost:4175')+'/canvas/');await page.waitForFunction(()=>window.__hd?.ready);
 await page.selectOption('#frame-action','all');
 assert.equal(await page.getAttribute('#frame-step','max'),'618');
 const checked=await page.evaluate(()=>{const h=__hd,source=h.actors[7],copy=h.comparisons.find(p=>p.source===source).copy,slider=document.querySelector('#frame-step');let count=0;for(let i=0;i<619;i++){slider.value=String(i);slider.dispatchEvent(new Event('input'));const a=h.renderer.entityPresentation(source),b=h.renderer.entityPresentation(copy);if(a.frame!==i||b.frame!==i||a.frame>=a.sprite.frames||b.frame>=b.sprite.frames)throw Error('bad frame '+i);count++;}return count;});
 assert.equal(checked,619);
 for(const action of ['walk','fireup','fireprone','swim','tread','wetattack','wetidle1','wetdie2','cheer','paradrop']){
  await page.selectOption('#frame-action',action);await page.selectOption('#frame-facing','5');await page.click('#frame-next');
  assert(await page.evaluate(()=>{const h=__hd,p=h.comparisons.find(p=>p.source===h.actors[7]);return h.renderer.entityPresentation(p.source).frame===h.renderer.entityPresentation(p.copy).frame;}));
 }
 await page.selectOption('#frame-action','swim');await page.click('#frame-play');const before=await page.evaluate(()=>__hd.inspector.frame);await page.waitForTimeout(140);assert.notEqual(await page.evaluate(()=>__hd.inspector.frame),before);
 await page.click('#pause');const frozen=await page.evaluate(()=>__hd.inspector.frame);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__hd.inspector.frame),frozen);
 await page.selectOption('#frame-action','walk');await page.screenshot({path:'/tmp/tanya-frame-inspector.png'});
 await page.click('#reset');assert(await page.evaluate(()=>__hd.renderer.entityPresentation(__hd.actors[7]).frame===__hd.inspector.frame));
 assert.deepEqual(errors,[]);console.log('PASS all 619 original frame IDs, complete action menu, synchronized in-map pair, looping, pause and reset');
}finally{await browser.close();}
