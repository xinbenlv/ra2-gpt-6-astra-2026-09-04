import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const $=s=>document.querySelector(s), entries=[],cache=new Map();let serial=0,reference=null,copying=false,pending=false,replaceId=null,chain=Promise.resolve();
const renderer=new T.WebGLRenderer({canvas:$('#canvas'),antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const draco=new DRACOLoader().setDecoderPath('/vendor/examples/jsm/libs/draco/gltf/').setWorkerLimit(2);
const loader=new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
const supported=new Set(['KHR_draco_mesh_compression','EXT_meshopt_compression','EXT_texture_webp','KHR_texture_transform','KHR_mesh_quantization','KHR_materials_unlit','KHR_materials_clearcoat','KHR_materials_transmission','KHR_materials_ior','KHR_materials_specular','KHR_materials_sheen','KHR_materials_volume','KHR_materials_emissive_strength','KHR_materials_iridescence','KHR_materials_anisotropy','KHR_materials_dispersion','KHR_lights_punctual','EXT_mesh_gpu_instancing','KHR_texture_basisu']);
supported.delete('KHR_texture_basisu'); // KTX2 needs a separate transcoder and is explicitly rejected.
function notice(s){$('#notice').textContent=s;}
function invalidate(){if(!pending){pending=true;requestAnimationFrame(render);}}
function render(){pending=false;renderer.setSize(innerWidth,innerHeight,false);renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);for(const e of entries){const r=e.view.getBoundingClientRect();if(!e.asset||r.bottom<0||r.top>innerHeight)continue;e.camera.aspect=r.width/r.height;e.camera.updateProjectionMatrix();renderer.setViewport(r.left,innerHeight-r.bottom,r.width,r.height);renderer.setScissor(Math.max(0,r.left),Math.max(0,innerHeight-r.bottom),Math.min(innerWidth,r.right)-Math.max(0,r.left),Math.min(innerHeight,r.bottom)-Math.max(0,r.top));renderer.setClearColor(0xe9eee4,1);renderer.clear();renderer.render(e.scene,e.camera);}renderer.setClearColor(0,0);}
function syncFrom(e){if(copying)return;copying=true;if($('#sync').checked)for(const other of entries){if(other===e)continue;other.camera.position.copy(e.camera.position);other.camera.quaternion.copy(e.camera.quaternion);other.camera.near=e.camera.near;other.camera.far=e.camera.far;other.controls.target.copy(e.controls.target);other.controls.update();}copying=false;invalidate();}
function refresh(){const select=$('#reference');select.replaceChildren();for(const e of entries){const o=document.createElement('option');o.value=e.id;o.textContent=e.name;if(e.localFile)o.dataset.userText="";select.append(o);e.card.classList.toggle('reference',e.id===reference);e.badge.textContent=e.id===reference?'取景参考 · 原始比例':'原始比例';}select.value=reference??'';$('#count').textContent=`${entries.length} / 6 个模型`;$('#empty').hidden=entries.length>0;invalidate();}
function fit(){const e=entries.find(e=>e.id===reference&&e.asset)||entries.find(e=>e.asset);if(!e)return;reference=e.id;const sphere=e.asset.box.getBoundingSphere(new T.Sphere());const radius=Math.max(sphere.radius,0.001);const aspects=entries.map(x=>{const r=x.view.getBoundingClientRect();return r.width/r.height;});const half=Math.atan(Math.tan(T.MathUtils.degToRad(35/2))*Math.min(1,...aspects));const distance=radius/Math.sin(half)*1.12;copying=true;for(const x of entries){x.controls.target.copy(sphere.center);x.camera.position.copy(sphere.center).add(new T.Vector3(1,0.65,1).normalize().multiplyScalar(distance));x.camera.near=Math.max(radius/10000,0.000001);x.camera.far=radius*1000;x.controls.minDistance=radius*0.005;x.controls.maxDistance=radius*200;x.controls.update();}copying=false;refresh();}
function disposeAsset(asset){const geos=new Set(),mats=new Set(),textures=new Set();asset.gltf.scenes.forEach(s=>s.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){mats.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});}}));geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});}
function release(e){if(!e.asset)return;e.scene.traverse(o=>o.skeleton?.dispose());const c=cache.get(e.key);if(c&&!--c.refs){disposeAsset(c.asset);cache.delete(e.key);}e.asset=null;}
function remove(e){e.removed=true;e.controls.dispose();release(e);e.card.remove();entries.splice(entries.indexOf(e),1);if(reference===e.id){reference=entries.find(x=>x.asset)?.id??null;fit();}refresh();}
function card(name){const id=String(++serial),el=document.createElement('article');el.className='card';el.innerHTML='<div class="card-head"><div><div class="title"></div><div class="meta">等待加载</div></div><div class="card-actions"><button class="replace">替换</button><button class="remove" aria-label="移除模型">×</button></div></div><div class="view" tabindex="0" role="img"><span class="badge"></span><div class="loading">排队加载…</div></div>';el.querySelector('.title').textContent=name;$('#grid').append(el);const scene=new T.Scene();scene.background=new T.Color(0xe9eee4);scene.add(new T.HemisphereLight(0xffffff,0x758770,2.5));const key=new T.DirectionalLight(0xfff6e5,3);key.position.set(3,5,4);scene.add(key);const fill=new T.DirectionalLight(0xe4eeff,1.5);fill.position.set(-4,2,-2);scene.add(fill);const camera=new T.PerspectiveCamera(35,1,.01,10000);camera.position.set(4,3,4);const view=el.querySelector('.view');view.setAttribute('aria-label',`${name}，拖动旋转，双指缩放`);const controls=new OrbitControls(camera,view);controls.enableDamping=false;controls.touches.ONE=T.TOUCH.ROTATE;controls.touches.TWO=T.TOUCH.DOLLY_PAN;controls.enabled=!$('#scroll').checked;
const e={id,name,card:el,view,camera,controls,scene,badge:el.querySelector('.badge'),status:el.querySelector('.loading'),meta:el.querySelector('.meta')};controls.addEventListener('change',()=>syncFrom(e));view.addEventListener('keydown',ev=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(ev.key)){ev.preventDefault();if(ev.key==='0'){fit();return;}const delta=camera.position.clone().sub(controls.target);if(ev.key==='+'||ev.key==='-')camera.position.copy(controls.target).add(delta.multiplyScalar(ev.key==='+'?.9:1.1));else{const direction=new T.Vector3(ev.key==='ArrowLeft'?-.04:ev.key==='ArrowRight'?.04:0,ev.key==='ArrowUp'?.04:ev.key==='ArrowDown'?-.04:0,0).applyQuaternion(camera.quaternion).multiplyScalar(delta.length());camera.position.add(direction);controls.target.add(direction);}controls.update();}});el.querySelector('.remove').onclick=()=>remove(e);el.querySelector('.replace').onclick=()=>{replaceId=id;$('#files').multiple=false;$('#files').click();};entries.push(e);refresh();return e;}
function inspect(buffer){const d=new DataView(buffer);if(buffer.byteLength<20||d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==buffer.byteLength||d.getUint32(16,true)!==0x4e4f534a)throw Error('不是有效的 GLB 2.0 文件');const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,d.getUint32(12,true))));const bad=(json.extensionsRequired||[]).filter(x=>!supported.has(x));if(bad.length)throw Error(`不支持必需扩展：${bad.join(', ')}`);for(const x of [...json.buffers||[],...json.images||[]])if(x.uri&&!x.uri.startsWith('data:'))throw Error('仅支持自包含 GLB：请先嵌入外部贴图和缓冲区');return json;}
async function read(source,e){if(source instanceof File){e.status.textContent='读取本地文件…';return source.arrayBuffer();}const res=await fetch(source);if(!res.ok)throw Error(`示例文件不可用（HTTP ${res.status}）`);const total=Number(res.headers.get('content-length'));const reader=res.body.getReader();let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;e.status.textContent=`读取 ${total?Math.round(size/total*100)+'%':(size/1e6).toFixed(1)+' MB'}`;}const b=new Uint8Array(size);let offset=0;for(const chunk of chunks){b.set(chunk,offset);offset+=chunk.length;}return b.buffer;}
async function load(e,source){try{if(e.removed)return;const buffer=await read(source,e);if(e.removed)return;const json=inspect(buffer);const digest=await hash(buffer);e.key=digest;let c=cache.get(digest);if(!c){e.status.textContent='解码几何与贴图…';await new Promise(requestAnimationFrame);const gltf=await loader.parseAsync(buffer,'');let triangles=0;gltf.scene.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position?.count??0)/3*(o.isInstancedMesh?o.count:1);});gltf.scene.updateMatrixWorld(true);c={refs:0,asset:{gltf,bytes:buffer.byteLength,triangles,extensions:json.extensionsUsed||[],box:new T.Box3().setFromObject(gltf.scene)}};if(e.removed){disposeAsset(c.asset);return;}cache.set(digest,c);}c.refs++;e.asset=c.asset;e.scene.add(clone(c.asset.gltf.scene));e.meta.textContent=`${(c.asset.bytes/1e6).toFixed(2)} MB · ${Math.round(c.asset.triangles).toLocaleString()} 三角面`;e.status.textContent='';if(!reference){reference=e.id;fit();}else{const first=entries.find(x=>x.id===reference);if(first) {copying=true;e.camera.position.copy(first.camera.position);e.camera.near=first.camera.near;e.camera.far=first.camera.far;e.controls.minDistance=first.controls.minDistance;e.controls.maxDistance=first.controls.maxDistance;e.controls.target.copy(first.controls.target);e.controls.update();copying=false;}}refresh();}catch(err){e.status.textContent=`加载失败：${err.message}`;e.meta.textContent='请替换文件重试';notice(`${e.name}：${err.message}`);invalidate();}}
// SHA-256 also works on plain HTTP LAN addresses without Web Crypto.
async function hash(buffer){return globalThis.sha256(buffer);}
function add(source,name){if(entries.length>=6){notice('最多显示 6 个模型，请先移除一个。');return;}const e=card(name);e.localFile=source instanceof File;if(e.localFile)e.card.querySelector(".title").dataset.userText="";refresh();chain=chain.then(()=>load(e,source));}
$('#add').onclick=()=>{replaceId=null;$('#files').multiple=true;$('#files').click();};$('#files').onchange=ev=>{if(replaceId){const old=entries.find(e=>e.id===replaceId);if(old)remove(old);}for(const f of ev.target.files)add(f,f.name);ev.target.value='';replaceId=null;};$('#demo').onclick=()=>{for(const [url,name] of [['low','天启坦克 · 精简版'],['tanya','谭雅 · 精简版'],['yard','盟军建造厂 · 精简版'],['reactor','苏军核电站 · 精简版']])add('/samples/'+url,name);};$('#fit').onclick=fit;$('#reference').onchange=ev=>{reference=ev.target.value;fit();};$('#sync').onchange=()=>{if($('#sync').checked){const e=entries.find(x=>x.id===reference)||entries[0];if(e)syncFrom(e);}};$('#scroll').onchange=()=>{document.body.classList.toggle('scrolling',$('#scroll').checked);for(const e of entries)e.controls.enabled=!$('#scroll').checked;};document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>{e.preventDefault();for(const f of e.dataTransfer.files)add(f,f.name);});addEventListener('resize',invalidate);addEventListener('scroll',invalidate,{passive:true});new ResizeObserver(invalidate).observe($('#grid'));renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();notice('图形上下文丢失，请刷新并减少模型数量。');});
window.__viewer={entries,cache,renderer,add,fit,ready:()=>chain,stats:()=>entries.map(e=>({name:e.name,triangles:e.asset?.triangles,extensions:e.asset?.extensions,position:e.camera.position.toArray(),target:e.controls.target.toArray(),error:e.status.textContent}))};invalidate();

// Match the game's English / 中文 control, browser-language detection and saved key.
// Storage is scoped to the viewer's origin; different ports cannot share preferences.
const english = {
  'Canvas 2D 战场': 'Canvas 2D battlefield',
  'GLB 对比台': 'GLB Compare',
  'WebP · 8 万面': 'WebP · 80K triangles',
  '同一视角，细看差异。': 'One viewpoint. See the difference.',
  '载入模型示例': 'Load model examples',
  '天启坦克 · 精简版': 'Apocalypse tank · optimized',
  '谭雅 · 精简版': 'Tanya · optimized',
  '盟军建造厂 · 精简版': 'Construction yard · optimized',
  '苏军核电站 · 精简版': 'Nuclear reactor · optimized',
  '＋ 添加 GLB': '+ Add GLB',
  '同步视角': 'Sync cameras',
  '重置 / 适配': 'Reset / Fit',
  '取景参考': 'Frame by',
  '首个模型': 'First model',
  '触控滚动页面': 'Touch to scroll page',
  '拖入多个 .glb · 鼠标左键旋转 / 滚轮缩放 / 右键平移 · 手机单指旋转 / 双指缩放与平移': 'Drop .glb files · Mouse: drag to rotate / wheel to zoom / right-drag to pan · Touch: one finger to rotate / two fingers to zoom and pan',
  '把模型放在一起看': 'Compare your models side by side',
  '添加本地 GLB，或载入示例开始对比。': 'Add local GLB files or load examples to start.',
  '文件只在此浏览器中读取，无需上传。': 'Files stay in your browser. No upload needed.',
  '原始坐标与比例 · 统一灯光 · 最多 6 个视口': 'Original coordinates and scale · Shared lighting · Up to 6 views',
  '取景参考 · 原始比例': 'Framing reference · Original scale',
  '原始比例': 'Original scale',
  '等待加载': 'Waiting to load',
  '替换': 'Replace',
  '移除模型': 'Remove model',
  '排队加载…': 'Queued…',
  '读取本地文件…': 'Reading local file…',
  '解码几何与贴图…': 'Decoding geometry and textures…',
  '请替换文件重试': 'Replace the file to try again',
  '不是有效的 GLB 2.0 文件': 'Not a valid GLB 2.0 file',
  '仅支持自包含 GLB：请先嵌入外部贴图和缓冲区': 'Only self-contained GLB is supported: embed external textures and buffers first',
  '最多显示 6 个模型，请先移除一个。': 'Up to 6 models. Remove one before adding another.',
  '图形上下文丢失，请刷新并减少模型数量。': 'Graphics context lost. Reload and use fewer models.',
  '原版 · 192 万面': 'Original · 1.92M triangles',
  'Draco · 20 万面': 'Draco · 200K triangles',
  '精简 · 3 万面': 'Simplified · 30K triangles',
};
let locale;
try { locale = localStorage.getItem('ra2-language'); } catch { /* Optional storage. */ }
if (!['en', 'zh-CN'].includes(locale)) {
  locale = /^zh(?:[-_]|$)/i.test(navigator.languages?.[0] || navigator.language) ? 'zh-CN' : 'en';
}
function translate(source) {
  if (locale === 'zh-CN') return source;
  const trimmed = source.trim();
  if (english[trimmed]) return source.replace(trimmed, english[trimmed]);
  let match;
  if ((match = source.match(/^(\d+ \/ 6) 个模型$/))) return `${match[1]} models`;
  if ((match = source.match(/^(.* MB · [\d,]+) 三角面$/))) return `${match[1]} triangles`;
  if ((match = source.match(/^读取 (.+)$/))) return `Reading ${match[1]}`;
  if ((match = source.match(/^加载失败：(.*)$/s))) return `Loading failed: ${translate(match[1])}`;
  if ((match = source.match(/^不支持必需扩展：(.*)$/s))) return `Unsupported required extensions: ${match[1]}`;
  if ((match = source.match(/^示例文件不可用（HTTP (\d+)）$/))) return `Example unavailable (HTTP ${match[1]})`;
  if ((match = source.match(/^(.*)，拖动旋转，双指缩放$/s))) return `${match[1]}: drag to rotate, pinch to zoom`;
  // Notice prefixes are file names: preserve them verbatim.
  if ((match = source.match(/^(.*?)：(.*)$/s))) return `${match[1]}: ${translate(match[2])}`;
  return source;
}
// Preserve source strings at the presentation boundary, including asynchronous progress.
// Never rebuild controls or scenes when the language changes.
const translatedNodes = new WeakMap();
const translatedAttributes = new WeakMap();
function localizedValue(current, record) {
  const source = record && current === record.output ? record.source : current;
  return { source, output: translate(source) };
}
function localize() {
  document.documentElement.lang = locale;
  document.title = translate('GLB 对比台');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement.closest('script,style,#language,[data-user-text]')) continue;
    const record = localizedValue(node.nodeValue, translatedNodes.get(node));
    translatedNodes.set(node, record);
    if (node.nodeValue !== record.output) node.nodeValue = record.output;
  }
  for (const element of document.querySelectorAll('[aria-label]:not(#language),[title]')) {
    const records = translatedAttributes.get(element) || {};
    for (const attr of ['aria-label', 'title']) {
      if (!element.hasAttribute(attr)) continue;
      const record = localizedValue(element.getAttribute(attr), records[attr]);
      records[attr] = record;
      if (element.getAttribute(attr) !== record.output) element.setAttribute(attr, record.output);
    }
    translatedAttributes.set(element, records);
  }
}
$('#language').value = locale;
$('#language').onchange = () => {
  locale = $('#language').value === 'zh-CN' ? 'zh-CN' : 'en';
  try { localStorage.setItem('ra2-language', locale); } catch { /* Keep switching usable. */ }
  localize();
  invalidate();
};
new MutationObserver(localize).observe(document.body, {
  childList: true, subtree: true, characterData: true,
  attributes: true, attributeFilter: ['aria-label', 'title'],
});
localize();
