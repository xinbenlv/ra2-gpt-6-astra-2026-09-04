import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TEST_ORIGIN||'http://localhost:4175')+'/canvas/');await page.waitForFunction(()=>window.__hd?.comparisons?.length);await page.click('#loop');await page.click('#pause');
 const directions=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
 const result=[];
 for(const type of ['tanya','apocalypse']){
  await page.click('#reset');
  for(let heading=0;heading<8;heading++){
  const [dx,dy]=directions[heading];await page.evaluate(({type,dx,dy})=>{const h=__hd,e=h.actors.find(e=>e.type===type);h.game.commandStop([e.id]);e.x=9.5;e.y=12.5;e.lastShot=-100;e.lastMovedAt=-100;h.game.commandMove([e.id],9.5+dx*3,12.5+dy*3);h.game.step(.1);},{type,dx,dy});await page.waitForTimeout(50);
  const sample=await page.evaluate(type=>{const h=__hd,p=h.comparisons.find(p=>p.source.type===type),v=h.renderer.entityPresentation(p.copy),s=p.sprite,seq=s.sequences?.walk;return {angle:p.source.angle,frame:v.frame,direction:seq?Math.floor((v.frame-seq[0])/seq[2]):v.frame,dx:p.source.x-9.5,dy:p.source.y-12.5};},type);
  assert(sample.dx*dx+sample.dy*dy>0);assert(Math.abs(Math.atan2(sample.dy,sample.dx)-sample.angle)<1e-8,JSON.stringify({type,heading,...sample}));assert.equal(sample.direction,type==='tanya'?[5,4,3,2,1,0,7,6][heading]:heading*4,JSON.stringify({type,heading,...sample}));result.push({type,heading,...sample});
 }
 }
 await page.click('#loop');await page.click('#pause');await page.waitForTimeout(1500);await page.screenshot({path:'/tmp/facing-corrected.png'});assert.deepEqual(errors,[]);console.log('PASS real movement along all 8 headings: original Tanya and VXL vehicle face their projected travel direction');
}finally{await browser.close();}
