// Local-only candidate inspector, original references and existing Canvas engine.
import {createServer} from 'vite';
import {readFileSync,createReadStream,statSync} from 'node:fs';
import path from 'node:path';
const repo=path.resolve(import.meta.dirname,'../..');
const original=process.env.RA2_ORIGINAL_ASSETS||'/Users/zzn/ws/xinbenlv/ra2-gpt-6-astra-2026-09-04/.cache/ra2-assets-rebuild-result/assets';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const readOriginalManifest=()=>({...json(original+'/manifest.json'),terrain:json(original+'/terrain/manifest-tiles.json'),scenery:json(original+'/scenery/manifest-scenery.json'),mapMetadata:Object.fromEntries(['catalog','terrain','overlays'].map(n=>[n,json(path.resolve(original,'../maps',n+'.json'))])),terrainMap:readFileSync(path.resolve(original,'../maps/valley.map'),'utf8')});
const server=await createServer({configFile:false,cacheDir:repo+'/.cache/environment/vite',root:import.meta.dirname,publicDir:false,resolve:{alias:{'@game':repo+'/src'}},define:{__BUILD_INFO__:JSON.stringify({hash:'0ca560d-env',committedAt:null})},server:{host:'127.0.0.1',port:Number(process.env.PORT||4186),strictPort:true,fs:{allow:[repo]}},plugins:[{name:'environment-files',configureServer(s){s.middlewares.use((req,res,next)=>{
const url=new URL(req.url,'http://localhost').pathname;
if(url==='/canvas3d'){res.statusCode=302;res.setHeader('Location','/canvas3d/');res.end();return;}
if(url==='/canvas'||url==='/canvas/'){req.url='/canvas.html';return next();}
if(url==='/original.json'){res.setHeader('Content-Type','application/json');try{res.end(JSON.stringify(readOriginalManifest()));}catch{res.statusCode=404;res.end(JSON.stringify({error:'Original comparison assets are not installed; Canvas 3D is independent.'}));}return;}
let file;
for(const [prefix,folder]of [['/hd/',repo+'/assets/hd'],['/environment/',repo+'/assets/hd/environment'],['/assets/',original],['/source/',repo+'/.cache/environment/source'],['/masters/',repo+'/.cache/environment']])if(url.startsWith(prefix)){const suffix=decodeURIComponent(url.slice(prefix.length));const p=path.resolve(folder,suffix);if(p.startsWith(path.resolve(folder)+path.sep))file=p;}
if(!file)return next();try{res.setHeader('Content-Type',({'.json':'application/json','.png':'image/png','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',statSync(file).size);createReadStream(file).pipe(res);}catch{res.statusCode=404;res.end('Missing candidate artifact');}
});}}]});await server.listen();server.printUrls();
