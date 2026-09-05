import assert from 'node:assert/strict';
import test from 'node:test';
import { originalsReady, ORIGINAL_VERSION, SOURCE_SHA256, READY_URL } from '../src/browser-storage';

test('browser readiness requires a committed cache and every original file, including audio and maps',async()=>{
  const files=Array.from({length:3000},(_,i)=>`/assets/sprites/test-${i}.png`);
  files.push('/assets/audio/hm2.wav','/maps/mp22s8.map');
  let stored=[...files],marker:unknown;
  const original=Object.getOwnPropertyDescriptor(globalThis,'caches');
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{open:async()=>({
    match:async(url:string)=>url===READY_URL&&marker?Response.json(marker):undefined,
    keys:async()=>stored.map(file=>({url:'https://example.test'+file})),
  })}});
  try{
    assert.equal(await originalsReady(),false,'Partial conversion must never start the game');
    marker={version:ORIGINAL_VERSION,sourceSha256:SOURCE_SHA256,files,installedAt:'test'};
    assert.equal(await originalsReady(),true);
    for(const missing of ['/assets/audio/hm2.wav','/maps/mp22s8.map']){
      stored=files.filter(file=>file!==missing);assert.equal(await originalsReady(),false,missing);stored=[...files];
    }
    marker={version:0,sourceSha256:SOURCE_SHA256,files};assert.equal(await originalsReady(),false);
    marker={version:ORIGINAL_VERSION,sourceSha256:'unverified',files};assert.equal(await originalsReady(),false);
    marker={version:ORIGINAL_VERSION,sourceSha256:SOURCE_SHA256,files:[]};assert.equal(await originalsReady(),false);
  }finally{if(original)Object.defineProperty(globalThis,'caches',original);else Reflect.deleteProperty(globalThis,'caches');}
});
