/** Browser-only archive feasibility probe. No original files are emitted.
 * node scripts/probe-browser-archive.mjs /path/to/installer.exe [/path/to/7z-wasm]
 * The temporary HTTP server only serves static test inputs; extraction runs in Chromium.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const installer = path.resolve(process.argv[2]);
const packageRoot = path.resolve(process.argv[3] || 'node_modules/7z-wasm');
const worker = `
import SevenZip from '/sevenzip/7zz.es6.js';
try {
  const archive=await (await fetch('/installer.exe')).blob();
  const logs=[];
  const z=await SevenZip({locateFile:name=>'/sevenzip/'+name,print:s=>logs.push(s),printErr:s=>logs.push(s)});
  z.FS.mkdir('/input');
  z.FS.mount(z.WORKERFS,{blobs:[{name:'installer.exe',data:archive}]},'/input');
  const started=performance.now();
  const rc=z.callMain(['x','/input/installer.exe','ra2.mix','multi.mix','language.mix','theme.mix','-o/game','-y','-bsp0']);
  const files=z.FS.readdir('/game').filter(name=>!name.startsWith('.')).map(name=>({name,bytes:z.FS.stat('/game/'+name).size}));
  self.postMessage({ok:rc===0,rc,ms:Math.round(performance.now()-started),inputBytes:archive.size,files,logs:logs.filter(line=>/Type =|Method =|Everything is Ok/.test(line))});
} catch(error) { self.postMessage({ok:false,error:String(error),stack:error.stack}); }
`;

const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Archive WASM browser probe</title>');return;}
  if(url.pathname==='/worker.js'){res.setHeader('Content-Type','text/javascript');res.end(worker);return;}
  const file=url.pathname==='/installer.exe'?installer:url.pathname==='/sevenzip/7zz.es6.js'?path.join(packageRoot,'7zz.es6.js'):url.pathname==='/sevenzip/7zz.wasm'?path.join(packageRoot,'7zz.wasm'):undefined;
  if(!file){res.statusCode=404;res.end();return;}
  try{const info=await stat(file);res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'application/octet-stream');res.setHeader('Content-Length',info.size);createReadStream(file).pipe(res);}
  catch(error){res.statusCode=500;res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  console.log('CORS',JSON.stringify(await page.evaluate(async()=>{
    const result=[];
    for(const url of ['https://archive.org/download/red-alert-2-multiplayer/Red-Alert-2-Multiplayer.exe','https://cors.archive.org/cors/red-alert-2-multiplayer/Red-Alert-2-Multiplayer.exe']){
      try{const response=await fetch(url,{headers:{Range:'bytes=0-31'},signal:AbortSignal.timeout(30000)});const reader=response.body.getReader();const first=await reader.read();await reader.cancel();result.push({url,status:response.status,type:response.type,contentLength:response.headers.get('content-length'),bytesRead:first.value?.length,firstBytes:[...first.value.slice(0,8)]});}
      catch(error){result.push({url,error:String(error)});}
    }
    return result;
  })));
  console.log('WASM',JSON.stringify(await page.evaluate(()=>new Promise((resolve,reject)=>{
    const worker=new Worker('/worker.js',{type:'module'});
    worker.onmessage=event=>{resolve(event.data);worker.terminate();};
    worker.onerror=error=>reject(String(error.message));
  }))));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
