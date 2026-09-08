import {readFileSync,statSync,createReadStream,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
export async function createCanvasPreview({base='/',httpServer,repo=process.env.RA2_REPO||path.resolve(root,'../..')}={}){
 const require=createRequire(path.join(repo,'package.json'));const {createServer}=await import(pathToFileURL(require.resolve('vite')).href);
 const threeRoot=path.dirname(path.dirname(require.resolve('three')));
 const art=path.join(repo,'assets/hd');const sprites=JSON.parse(readFileSync(path.join(art,'sprites/manifest.json'),'utf8'));
 const original=process.env.RA2_ORIGINAL_ASSETS||path.join(repo,'.cache/ra2-assets-rebuild-result/assets');
 const modelRoot=process.env.RA2_MODEL_DIR;
 const models=Object.fromEntries(Object.entries({mtnk:'apocalypse-tank',tany:'tanya',gacnst:'allied-construction-yard',nanrct:'soviet-nuclear-power-plant'}).map(([id,asset])=>[id,modelRoot?path.join(modelRoot,asset,asset+'.glb'):path.join(art,'models',asset,'30k.glb')]));
 let selected={},terrain={},scenery={},overlays={},mapMetadata,terrainMap,error;const originalFiles=new Map();
 try{
  const raw=JSON.parse(readFileSync(path.join(original,'manifest.json')));
  const ts=JSON.parse(readFileSync(path.join(original,'terrain/manifest-tiles.json'))),ss=JSON.parse(readFileSync(path.join(original,'scenery/manifest-scenery.json')));
  const mapRoot=path.resolve(original,'../maps');
  mapMetadata=Object.fromEntries(['catalog','terrain','overlays'].map(name=>[name,JSON.parse(readFileSync(path.join(mapRoot,name+'.json'),'utf8'))]));
  terrainMap=readFileSync(path.join(mapRoot,'valley.map'),'utf8');
  overlays=raw.overlays||{};
  const candidate={};for(const id of Object.keys(models))candidate[id]=raw.sprites[id];
  const paths=new Map();for(const s of [...Object.values(candidate),...Object.values(ts),...Object.values(ss),...Object.values(overlays)])for(const key of ['src','remapMaskSrc'])if(s?.[key]){const file=path.resolve(original,'.'+s[key].slice('/assets'.length));if(!file.startsWith(path.resolve(original)+path.sep)||!existsSync(file))throw Error('Original art incomplete');paths.set(s[key],file);}
  selected=candidate;terrain=ts;scenery=ss;for(const entry of paths)originalFiles.set(...entry);
 }catch(e){error='原版地形素材不完整，请配置 RA2_ORIGINAL_ASSETS 并安装同目录的 maps 元数据。';console.error(error,e.message);}
 const files=new Map(originalFiles);for(const s of Object.values(sprites.sprites))for(const key of ['src','remapMaskSrc'])if(s[key])files.set(s[key],path.join(art,'sprites',path.basename(s[key])));
 return createServer({configFile:false,root,base,publicDir:false,resolve:{alias:{'@game':repo+'/src','three/addons':threeRoot+'/examples/jsm','three':threeRoot+'/build/three.module.js'}},define:{__BUILD_INFO__:JSON.stringify({hash:'local-hd-preview',committedAt:null})},server:{...(httpServer?{middlewareMode:true,hmr:{server:httpServer}}:{host:'127.0.0.1',port:4177,strictPort:true}),fs:{allow:[root,repo+'/src',repo+'/node_modules']}},plugins:[{name:'local-preview-art',configureServer(server){server.middlewares.use((req,res,next)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;const url=base!=='/'&&pathname.startsWith(base)?'/'+pathname.slice(base.length):pathname;
  if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;res.end();return;}
  if(url==='/original-manifest.json'||url==='/sprites/manifest.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(url==='/sprites/manifest.json'?sprites:{sprites:selected,terrain,scenery,overlays,mapMetadata,terrainMap,error}));return;}
  let file=files.get(url);if(url.startsWith('/models/'))file=models[url.slice(8)];if(!file)return next();
  try{const st=statSync(file);res.setHeader('Content-Length',st.size);res.setHeader('Content-Type',file.endsWith('.glb')?'model/gltf-binary':'image/png');if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);}catch{res.statusCode=404;res.end('Model is not archived locally. Set RA2_MODEL_DIR to the master directory.');}
 });}}]});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const server=await createCanvasPreview();await server.listen();server.printUrls();}
