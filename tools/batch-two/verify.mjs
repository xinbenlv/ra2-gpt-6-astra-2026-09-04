// Prior sideways motion bug: measure actual travel against independently observed GLB axes.
// Includes a wrong-90-degree negative control and turret/body separation checks.
import{chromium}from'@playwright/test';import assert from'node:assert/strict';import fs from'node:fs/promises';
const out='.cache/batch-two/verification';await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4192/canvas3d/');await page.waitForFunction(()=>window.canvas3d?.ready);await page.locator('#demo').click();await page.evaluate(()=>window.canvas3d.pause(true));
const report=await page.evaluate(()=>{
 const a=window.canvas3d,T=a.T,axes={tanya:[0,0,1],apocalypse:[-1,0,0],miner:[-1,0,0],rocketeer:[0,0,1],squid:[0,0,-1],cons:[0,0,1],htnk:[-1,0,0],dest:[-1,0,0]},headings=[],attacks=[],clips=[];
 const clear=m=>{a.models.filter(o=>o!==m&&!o.environment&&o.kind!=='building').forEach((o,i)=>{a.game.commandStop([o.entity.id]);o.entity.x=o.kind==='naval'?30:2+i*1.7;o.entity.y=30;o.mode='auto';});};
 for(const[id,axis]of Object.entries(axes))for(let direction=0;direction<8;direction++){
  const m=a.models.find(m=>m.id===id),e=m.entity,angle=direction*Math.PI/4;clear(m);a.game.commandStop([e.id]);e.x=m.kind==='naval'?27:15;e.y=18;m.mode='auto';m.heading=Math.PI/4;
  const start=[e.x,e.y];a.game.commandMove([e.id],e.x+Math.cos(angle)*2.2,e.y+Math.sin(angle)*2.2);a.tick(.1);m.group.updateMatrixWorld(true);
  const delta=new T.Vector3(e.x-start[0],0,e.y-start[1]),nose=new T.Vector3(...axis).transformDirection(m.group.matrixWorld);
  headings.push({id,direction,distance:delta.length(),dot:nose.dot(delta.normalize()),inspectionHeading:m.heading});
 }
 const m=a.models.find(m=>m.id==='htnk'),axis=m.forwardAxis;clear(m);a.game.commandStop([m.entity.id]);m.entity.x=15;m.entity.y=18;m.forwardAxis=[0,0,1];a.game.commandMove([m.entity.id],18,18);a.tick(.1);m.group.updateMatrixWorld(true);const negative=new T.Vector3(-1,0,0).transformDirection(m.group.matrixWorld).dot(new T.Vector3(m.entity.x-15,0,m.entity.y-18).normalize());m.forwardAxis=axis;
 // Actual engine attacks and the geometry's barrel/rifle axis, independent of catalog axis settings.
 for(const id of['cons','htnk','dest']){
  const m=a.models.find(m=>m.id===id),e=m.entity;clear(m);a.game.commandStop([e.id]);e.x=m.kind==='naval'?26:15;e.y=18;m.mode='auto';m.driveAngle=Math.PI/2;m.heading=0;e.cooldown=0;
  const target=a.combat.targets[m.kind==='naval'?1:0];target.entity.x=e.x+2;target.entity.y=e.y+1;target.entity.hp=target.entity.maxHp;const before=target.entity.hp;a.combat.command(m,target);a.tick(.1);a.tick(.1);m.group.updateMatrixWorld(true);
  const node=m.gltf.scene.getObjectByName(id==='cons'?'Weapon':'Barrel'),observed=id==='cons'?[.65,0,.76]:[-1,0,0],forward=new T.Vector3(...observed).transformDirection(node.matrixWorld),toward=new T.Vector3(target.entity.x-e.x,0,target.entity.y-e.y).normalize();
  attacks.push({id,damage:before-target.entity.hp,barrelDot:forward.dot(toward),hullAngle:m.group.rotation.y,driveAngle:m.driveAngle,shots:a.combat.shots.filter(s=>s.source===id).length});
  a.game.commandMove([e.id],e.x-2,e.y);const start=[e.x,e.y];a.tick(.1);m.group.updateMatrixWorld(true);const delta=new T.Vector3(e.x-start[0],0,e.y-start[1]);attacks.at(-1).resumeDot=new T.Vector3(...axes[id]).transformDirection(m.group.matrixWorld).dot(delta.normalize());
 }
 for(const id of['cons','htnk','dest','gapile']){a.choose(id);const m=a.selected;for(const clip of m.clips){a.setMode(clip.name);for(const p of[0,.25,.5,.75,1]){m.action.time=clip.duration*p;m.mixer.update(0);m.group.updateMatrixWorld(true);const box=new T.Box3().setFromObject(m.group);clips.push({id,clip:clip.name,phase:p,finite:[...box.min.toArray(),...box.max.toArray()].every(Number.isFinite)});}}}
 return{models:a.models.map(m=>m.id),missing:a.missing,headings,negative,attacks,clips};
});
await fs.writeFile(out+'/behavior.json',JSON.stringify({...report,errors},null,2));assert.equal(report.missing.length,0);assert.equal(report.models.length,14);assert.equal(errors.length,0);
for(const row of report.headings){assert(row.distance>.01,JSON.stringify(row));assert(row.dot>.99,JSON.stringify(row));assert.equal(row.inspectionHeading,0);}
assert(Math.abs(report.negative)<.1,'Wrong 90 degree compensation must fail alignment');
for(const row of report.attacks){assert(row.damage>0,JSON.stringify(row));assert(row.barrelDot>.98,JSON.stringify(row));assert(row.resumeDot>.99,JSON.stringify(row));}
assert(report.clips.every(c=>c.finite));
// Actual UI time controls and camera changes.
await page.selectOption('#actor','cons');await page.selectOption('#action','walk');await page.evaluate(()=>window.canvas3d.pause(true));const t=await page.evaluate(()=>window.canvas3d.selected.action.time);await page.locator('#step').click();assert((await page.evaluate(()=>window.canvas3d.selected.action.time))>t);await page.locator('#seek').fill('500');await page.locator('#seek').dispatchEvent('input');const seek=await page.evaluate(()=>window.canvas3d.selected.action.time);assert(Math.abs(seek-.36)<.01);
for(const name of['north','east','south','west']){await page.getByTestId(name).click();await page.screenshot({path:out+'/'+name+'.png'});}
console.log('PASS',report.headings.length,'travel checks; 90-degree negative control; actual attack and move-resume; sampled clips; time/camera UI.');
}finally{await browser.close();}
