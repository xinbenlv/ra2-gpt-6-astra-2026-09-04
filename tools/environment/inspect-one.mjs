// Local single-model inspection while the second remote task completes.
import {chromium} from '@playwright/test';import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage();p.on('pageerror',e=>console.log(e.message));await p.goto('http://127.0.0.1:4186/bake.html');await p.waitForFunction(()=>window.ready);const s=await p.evaluate(()=>window.bake('tree22'));await writeFile('.cache/environment/tree22/bake.png',Buffer.from(s.data.split(',')[1],'base64'));await b.close();
