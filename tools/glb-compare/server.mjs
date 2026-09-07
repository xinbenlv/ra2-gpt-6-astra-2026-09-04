import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const repo=process.env.RA2_REPO||path.resolve(root,'../..');
const require=createRequire(path.join(repo,'package.json'));
const threeRoot=path.dirname(path.dirname(require.resolve('three')));
const sampleRoot=path.join(repo,'assets/hd/models');
const samples=Object.fromEntries(Object.entries({low:'apocalypse-tank',tanya:'tanya',yard:'allied-construction-yard',reactor:'soviet-nuclear-power-plant'}).map(([key,asset])=>[key,path.join(sampleRoot,asset,'30k.glb')]));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.glb':'model/gltf-binary'};
const port=Number(process.env.PORT||4175),host=process.env.HOST||'127.0.0.1';
let canvasPreview,canvasError;
const server=http.createServer(async(req,res)=>{try{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 const url=new URL(req.url,'http://localhost');let file;
 if(url.pathname==='/canvas'){res.writeHead(302,{Location:'/canvas/'}).end();return;}
 if(url.pathname.startsWith('/canvas/')){if(canvasPreview)canvasPreview.middlewares(req,res,()=>res.writeHead(404).end('Not found'));else res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'}).end('Canvas 2D preview unavailable: '+canvasError);return;}
 if(url.pathname.startsWith('/samples/'))file=samples[url.pathname.slice(9)];
 else if(url.pathname==='/sha256.js')file=path.resolve(path.dirname(require.resolve('js-sha256')),'../build/sha256.min.js');
 else if(['/','/index.html','/app.js','/style.css'].includes(url.pathname))file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));
 else if(url.pathname.startsWith('/vendor/')){const rel=url.pathname.slice(8);if(!rel.includes('..')&&/^(build\/|examples\/jsm\/)/.test(rel))file=path.join(threeRoot,rel);}
 if(!file){res.writeHead(404).end('Not found');return;}const st=await stat(file);if(!st.isFile())throw Error();
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':st.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
 if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
}catch{res.writeHead(404).end('File unavailable');}});
try{const directory=process.env.GLB_CANVAS_DIR||path.resolve(root,'../canvas-hd-preview');const {createCanvasPreview}=await import(pathToFileURL(path.join(directory,'server.mjs')).href);canvasPreview=await createCanvasPreview({base:'/canvas/',httpServer:server,repo});}catch(error){canvasError=error.message;console.error(canvasError);}
server.listen(port,host,()=>{console.log(`GLB: http://localhost:${port}/\nCanvas 2D: http://localhost:${port}/canvas/`);if(host==='0.0.0.0')for(const n of Object.values(os.networkInterfaces()).flat())if(n.family==='IPv4'&&!n.internal)console.log(`LAN: http://${n.address}:${port}/`);});
