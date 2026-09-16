// Exercise real preview controls and compare rendered pixels inside/outside the embedded mask.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {readGLB} from '../four-assets/glb.mjs';
const before=await readGLB('assets/hd/batch-two/htnk-v4.glb'),after=await readGLB('assets/hd/batch-two/htnk-v4-team.glb');
assert(after.bin.subarray(0,before.bin.length).equals(before.bin),'Original geometry and PBR bytes must remain unchanged');
assert.deepEqual(before.g.meshes,after.g.meshes);assert.deepEqual(before.g.accessors,after.g.accessors);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:4192/rhino.html',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.rhino?.ready,{},{timeout:120000}).catch(e=>{throw Error(e.message+'\n'+errors.join('\n'));});
 await page.getByTestId('team-preset').selectOption('#2166ff');assert.equal(await page.getByTestId('team-color').inputValue(),'#2166ff');
 await page.screenshot({path:'.cache/batch-two/team-color/blue.png'});
 await page.getByTestId('team-color').fill('#ff9900');await page.getByTestId('team-color').dispatchEvent('input');
 await page.getByTestId('team-mask').check();await page.screenshot({path:'.cache/batch-two/team-color/mask-preview.png'});await page.getByTestId('team-mask').uncheck();
 const report=await page.evaluate(()=>{
  const a=window.rhino,r=a.renderer,gl=r.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  const capture=()=>{r.render(a.scene,a.camera);const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
  const rows=[];for(let view=0;view<4;view++){
   const delta=a.camera.position.clone().sub(a.controls.target),angle=Math.PI/2,x=delta.x,z=delta.z;delta.x=x*Math.cos(angle)-z*Math.sin(angle);delta.z=x*Math.sin(angle)+z*Math.cos(angle);a.camera.position.copy(a.controls.target).add(delta);a.controls.update();
   a.team.setColor('#ff0000');const red=capture();a.team.setColor('#2166ff');const blue=capture();a.team.showMask(true);const mask=capture();a.team.showMask(false);
   let changed=0,outside=0;for(let i=0;i<red.length;i+=4){if(Math.max(Math.abs(red[i]-blue[i]),Math.abs(red[i+1]-blue[i+1]),Math.abs(red[i+2]-blue[i+2]))>2){changed++;if(mask[i]<=1)outside++;}}
   rows.push({view,changed,outside});
  }a.team.setColor('#2166ff');return rows;
 });
 assert.equal(errors.length,0,errors.join('\n'));for(const row of report){assert(row.changed>500,JSON.stringify(row));assert.equal(row.outside,0,JSON.stringify(row));}
 await page.getByTestId('reset').click();await page.getByTestId('team-preset').selectOption('#ffd52a');await page.screenshot({path:'.cache/batch-two/team-color/yellow.png'});
 await fs.writeFile('.cache/batch-two/team-color/verification.json',JSON.stringify({originalBytesPreserved:true,views:report,errors},null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
