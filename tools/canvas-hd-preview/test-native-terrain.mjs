import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin=process.env.TEST_ORIGIN||'http://localhost:4175';await page.goto(origin+'/canvas/');await page.waitForFunction(()=>window.__hd?.ready);
 const proof=await page.evaluate(()=>{
  const h=__hd,map=h.game.map,defs=h.original.mapMetadata.terrain.temperate;
  // Fail if the preview ever draws synthetic terrain or synthetic resource art.
  const painter=h.renderer.terrainPainter;painter.drawGround=()=>{throw Error('Procedural ground fallback');};painter.drawResources=()=>{throw Error('Procedural resource fallback');};h.renderer.draw();
  const files=map.originalTerrain.required.map(k=>defs[Number(k.split(':')[1])].file);
  return {water:files.some(f=>/^water/i.test(f)),shore:files.some(f=>/^shore/i.test(f)),slope:map.tiles.some(t=>t.slope>0),elevated:map.elevations.some(v=>v>0),patch:map.originalTerrain.patch,allNative:map.resolvedTerrain.every(c=>c.layers.length&&c.layers.every(l=>h.assets.images.has(h.assets.terrain[`${l.theater}:${l.tileId}:${l.subTile}`].src)))};
 });
 assert(proof.water&&proof.shore&&proof.slope&&proof.elevated&&proof.allNative);assert.equal(proof.patch.sourceMap,'valley.map');await page.waitForTimeout(1200);await page.screenshot({path:'/tmp/native-preview.png'});assert.deepEqual(errors,[]);
 // A missing original atlas entry must stop the preview, never substitute generated art.
 const missing=await browser.newPage();await missing.route('**/original-manifest.json',async route=>{const response=await route.fetch(),data=await response.json();delete data.terrain['temperate:0:0'];await route.fulfill({response,json:data});});
 await missing.goto(origin+'/canvas/');await missing.waitForFunction(()=>document.querySelector('#status').textContent.includes('缺少原版地块'));assert.equal(await missing.evaluate(()=>!!window.__hd?.ready),false);
 console.log('PASS original water, shore, ramps, resource artwork, zero terrain fallbacks and missing-art error');
}finally{await browser.close();}
