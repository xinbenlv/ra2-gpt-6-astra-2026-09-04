// Bake all six models in real Chromium and save 4x Canvas-compatible sprite metadata.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:4186/bake.html');await page.waitForFunction(()=>window.ready);const sprites={};await mkdir('assets/hd/environment/sprites',{recursive:true});
for(const id of ['grass','ocean','plateau','ramp','tree22','tree10']){const s=await page.evaluate(id=>window.bake(id),id);await writeFile('assets/hd/environment/sprites/'+id+'.png',Buffer.from(s.data.split(',')[1],'base64'));delete s.data;sprites[id]=s;}
await writeFile('assets/hd/environment/sprites/manifest.json',JSON.stringify({description:'Offline GLB renders; four pixels per logical pixel; fixed original camera.',sprites},null,2)+'\n');await browser.close();
