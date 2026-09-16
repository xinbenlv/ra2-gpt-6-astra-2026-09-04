// Browser regression for actual animated meshes, controls and GameEngine movement.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root='.cache/environment/canvas3d';await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:4186/canvas3d');await page.waitForFunction(()=>window.canvas3d?.ready,null,{timeout:60000});
 const assets=await page.evaluate(()=>window.canvas3d.models.map(m=>({id:m.id,clips:m.clips.map(c=>c.name),joints:m.gltf.scene.getObjectByProperty('isSkinnedMesh',true)?.skeleton.bones.length||0})));
 assert.equal(assets.length,8,'All eight existing actor types must load');assert.equal(await page.locator('#actor option').count(),8);
 assert(!requests.some(url=>/original.json|\/assets\//.test(url)),'3D scene must not request original 2D art');
 await page.locator('#demo').click();await page.locator('#pause').click();
 const changed=[];
 for(const id of ['tanya','rocketeer','squid']){
  await page.selectOption('#actor',id);const actions=assets.find(m=>m.id===id).clips;
  for(const name of actions){await page.selectOption('#action',name);
   const positions=await page.evaluate(()=>{const m=window.canvas3d.selected,mesh=m.gltf.scene.getObjectByProperty('isSkinnedMesh',true),v=mesh.position.clone();const sample=()=>{m.group.updateMatrixWorld(true);mesh.skeleton.update();return Array.from({length:120},(_,i)=>mesh.getVertexPosition(Math.floor(i*mesh.geometry.attributes.position.count/120),v).toArray());};m.action.time=0;m.action.paused=false;m.mixer.update(0);const a=sample();m.action.time=m.action.getClip().duration*.37;m.mixer.update(0);return {a,b:sample()};});
   assert(positions.b.flat().every(Number.isFinite),id+'/'+name+' finite vertices');
   if(positions.b.some((v,i)=>Math.hypot(...v.map((n,k)=>n-positions.a[i][k]))>.001))changed.push(id+'/'+name);
  }
 }
 for(const name of ['tanya/walk','tanya/crawl','tanya/swim','rocketeer/fly','rocketeer/tumble','squid/swim','squid/attack'])assert(changed.includes(name),name+' must deform skinned vertices');
 await page.selectOption('#actor','tanya');await page.selectOption('#action','walk');
 const before=await page.evaluate(()=>window.canvas3d.selected.action.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.canvas3d.selected.action.time),before,'Pause freezes clip');
 await page.locator('#step').click();assert(await page.evaluate(()=>window.canvas3d.selected.action.time)>before,'Step advances clip');
 await page.locator('#seek').fill('600');await page.locator('#seek').dispatchEvent('input');assert(await page.evaluate(()=>Math.abs(window.canvas3d.selected.action.time/window.canvas3d.selected.action.getClip().duration-.6)<.01));
 await page.selectOption('#action','swim');assert(await page.evaluate(()=>window.canvas3d.selected.entity.x>=22&&window.canvas3d.selected.group.position.x>=22));await page.screenshot({path:root+'/tanya-swim.png'});
 await page.selectOption('#action','ready');assert(await page.evaluate(()=>window.canvas3d.selected.entity.x<22));
 await page.selectOption('#actor','apocalypse');await page.selectOption('#action','auto');await page.locator('#pause').click();
 await page.locator('#home').click();
 const target=await page.evaluate(()=>{const a=window.canvas3d,e=a.selected.entity,r=a.world.renderer.domElement.getBoundingClientRect(),v=a.selected.group.position.clone().set(e.x+3,0,e.y).project(a.world.camera);return {start:e.x,x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};});
 await page.mouse.click(target.x,target.y,{button:'right'});const start=target.start;
 await page.waitForFunction(start=>window.canvas3d.selected.entity.x>start+.15,start);await page.locator('#pause').click();
 await page.selectOption('#actor','tanya');await page.selectOption('#action','ready');
 await page.locator('#tour').click();const first=await page.evaluate(()=>window.canvas3d.selected.mode);await page.evaluate(()=>window.canvas3d.tick(3));assert.notEqual(await page.evaluate(()=>window.canvas3d.selected.mode),first,'Action tour advances');await page.locator('#tour').click();await page.evaluate(()=>window.canvas3d.pause(true));
 await page.selectOption('#actor','reactor');await page.selectOption('#action','repair');assert((await page.locator('#motion-note').textContent()).includes('静态建筑'));assert.equal(await page.evaluate(()=>window.canvas3d.selected.action),null,'Repair feedback is not a fabricated clip');
 const headings=[];await page.locator('#home').click();
 for(const id of ['north','east','south','west']){await page.locator('#'+id).count();await page.getByTestId(id).click();await page.waitForTimeout(150);headings.push(await page.evaluate(()=>window.canvas3d.world.camera.position.toArray()));await page.screenshot({path:root+'/'+id+'.png'});}
 assert.equal(new Set(headings.map(JSON.stringify)).size,4);
 await page.selectOption('#actor','squid');await page.selectOption('#action','attack');await page.locator('#seek').fill('400');await page.locator('#seek').dispatchEvent('input');await page.screenshot({path:root+'/squid-attack.png'});
 await page.selectOption('#actor','rocketeer');await page.selectOption('#action','firefly');await page.screenshot({path:root+'/rocketeer-firefly.png'});
 await page.locator('#home').click();await page.evaluate(()=>window.canvas3d.world.view(45));await page.waitForTimeout(100);await page.screenshot({path:root+'/overview.png'});
 assert.equal(errors.length,0,errors.join('\n'));
 const report={assets,changed,errors,originalRequests:0,paused:true,step:true,seek:true,waterPose:true,engineMovement:true,rightClick:true,actionTour:true,cameraDirections:headings.length};await fs.writeFile(root+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
