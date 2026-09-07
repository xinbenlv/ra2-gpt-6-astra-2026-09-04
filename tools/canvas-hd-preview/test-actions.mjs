import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:4175';
const out='.cache/viewer-tests';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/canvas/');await page.waitForFunction(()=>window.__hd?.ready);
 const point=async(group,index)=>page.evaluate(({group,index})=>{const h=__hd,e=h[group][index],p=h.renderer.toScreen(e.x,e.y),r=h.renderer.canvas.getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top-14};},{group,index});
 const clickActor=async(group,index,button='left')=>{const p=await point(group,index);await page.mouse.click(p.x,p.y,{button});};
 await clickActor('actors',5);assert.equal(await page.evaluate(()=>__hd.renderer.selection.has(__hd.actors[5].id)),true);
 const before=await page.evaluate(()=>({x:__hd.actors[5].x,y:__hd.actors[5].y}));
 const destination=await page.evaluate(()=>{const p=__hd.renderer.toScreen(21,23),r=__hd.renderer.canvas.getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top};});
 await page.mouse.click(destination.x,destination.y,{button:'right'});
 await page.waitForFunction(()=>__hd.animation(__hd.actors[5].id).action==='walk');
 const frames=[];for(let i=0;i<4;i++){frames.push(await page.evaluate(()=>__hd.animation(__hd.actors[5].id).frame));await page.waitForTimeout(150);}
 assert(new Set(frames).size>1);assert(await page.evaluate(p=>Math.hypot(__hd.actors[5].x-p.x,__hd.actors[5].y-p.y)>0.1,before));
 await page.screenshot({path:out+'/hd-walk.png'});
 await page.click('#reset');await clickActor('actors',4);await clickActor('targets',0,'right');
 await page.waitForFunction(()=>__hd.actors[4].lastShot>0&&__hd.targets[0].lastHit>0);
 assert(await page.evaluate(()=>__hd.targets[0].hp<__hd.targets[0].maxHp));
 await page.screenshot({path:out+'/hd-attack.png'});
 await page.click('#stop');await page.click('#retaliate');
 await page.waitForFunction(()=>__hd.actors[4].lastHit>0);await page.click('#pause');
 const paused=await page.evaluate(()=>__hd.game.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__hd.game.time),paused);
 await page.screenshot({path:out+'/hd-hit.png'});
 // Compare every changed pixel with the explicit mask: skin and unmasked surfaces must be identical.
 const colorCheck=await page.evaluate(()=>{
   const h=__hd,s=h.hd.sprites.tany,r=h.renderer;
   const pixels=color=>{const image=r.coloredSprite(s,color),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
   const a=pixels('#ff2222'),b=pixels('#2255ff'),mask=h.assets.images.get(s.remapMaskSrc),c=document.createElement('canvas');c.width=mask.width;c.height=mask.height;const ctx=c.getContext('2d');ctx.drawImage(mask,0,0);const m=ctx.getImageData(0,0,c.width,c.height).data;
   let changed=0,outside=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]){changed++;if(!m[i+3])outside++;}return {changed,outside};
 });assert(colorCheck.changed>100);assert.equal(colorCheck.outside,0);
 await page.locator('#own-color').fill('#a960ee');await page.locator('#own-color').dispatchEvent('input');assert.equal(await page.evaluate(()=>__hd.game.players[0].color),'#a960ee');
 await page.screenshot({path:out+'/hd-colors.png'});
 await page.click('#reset');await page.click('#pause');
 await clickActor('actors',1);await page.click('#retaliate');await page.waitForFunction(()=>__hd.actors[1].hp<__hd.actors[1].maxHp,{},{timeout:30000});
 await page.click('#retaliate');await page.click('#repair');const hp=await page.evaluate(()=>__hd.actors[1].hp);await page.waitForFunction(hp=>__hd.actors[1].hp>hp,hp);await page.screenshot({path:out+'/hd-repair.png'});
 assert.deepEqual(errors,[]);await writeFile(out+'/hd-actions.json',JSON.stringify({walkFrames:frames,attack:true,hit:true,pause:true,repair:true,colorCheck,errors},null,2));console.log('PASS HD movement, combat, hit, repair, pause and masked team colors');
}finally{await browser.close();}
