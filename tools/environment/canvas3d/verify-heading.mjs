// Regression: compare observed model forward axes against real engine displacement.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 await page.goto('http://127.0.0.1:4186/canvas3d/');await page.waitForFunction(()=>window.canvas3d?.ready);
 await page.locator('#demo').click();await page.locator('#pause').click();
 const results=await page.evaluate(()=>{
  const a=window.canvas3d,results=[];
  const observedAxes={apocalypse:[-1,0,0],miner:[-1,0,0],tanya:[0,0,1],rocketeer:[0,0,1],squid:[0,0,-1]};
  for(const id of Object.keys(observedAxes))for(let direction=0;direction<8;direction++){
   const m=a.models.find(m=>m.id===id),e=m.entity,angle=direction*Math.PI/4;
   // Keep the test lane clear: overlap separation can add sideways displacement unrelated to yaw.
   a.models.filter(other=>other.kind!=='building'&&other!==m).forEach((other,i)=>{a.game.commandStop([other.entity.id]);other.entity.x=other.kind==='naval'?27:2+i*2;other.entity.y=28;});
   const x=id==='squid'?27:15;
   a.game.commandStop([e.id]);e.x=x;e.y=18;m.mode='auto';m.heading=0;
   a.game.commandMove([e.id],x+Math.cos(angle)*3,18+Math.sin(angle)*3);
   const start={x:e.x,z:e.y};a.tick(.1);m.group.updateMatrixWorld(true);
   const velocity=m.group.position.clone().set(e.x-start.x,0,e.y-start.z).normalize();
   // Independent axes established from neutral GLB views and the Squid source frame.
   const nose=m.group.position.clone().set(...observedAxes[id]).transformDirection(m.group.matrixWorld);
   results.push({id,direction,distance:Math.hypot(e.x-start.x,e.y-start.z),alignment:nose.dot(velocity)});
  }
  return results;
 });
 await fs.writeFile('.cache/environment/canvas3d/heading-report.json',JSON.stringify(results,null,2)+'\n');
 for(const row of results){assert(row.distance>.01,'Vehicle must actually travel');assert(row.alignment>.99,`${row.id} direction ${row.direction}: nose/movement dot ${row.alignment.toFixed(4)}`);}
 // An inspection-only turn must not leave the vehicle moving diagonally on its next order.
 await page.selectOption('#actor','apocalypse');await page.selectOption('#action','auto');
 const turned=await page.evaluate(()=>{const a=window.canvas3d,m=a.selected,e=m.entity;a.game.commandStop([e.id]);e.x=15;e.y=18;m.heading=Math.PI/4;a.game.commandMove([e.id],18,18);a.tick(.1);m.group.updateMatrixWorld(true);const nose=m.group.position.clone().set(-1,0,0).transformDirection(m.group.matrixWorld);return {alignment:nose.dot(nose.clone().set(e.x-15,0,e.y-18).normalize()),heading:m.heading};});
 assert(turned.alignment>.99&&turned.heading===0,'Moving clears the inspection heading offset');
 await page.locator('#focus').click();await page.waitForTimeout(100);await page.screenshot({path:'.cache/environment/canvas3d/tank-heading-fixed.png'});
 console.log('PASS: all five mobile models face their movement in all eight directions; inspection turn resets.');
}finally{await browser.close();}
