import { Assets } from '@game/assets';
import { GameEngine } from '@game/game/engine';
import { CATALOG } from '@game/game/data';
import { BattlefieldRenderer } from '@game/renderer';
import type { Terrain } from '@game/game/types';
const $=(id:string)=>document.getElementById(id)!;
const base=import.meta.env.BASE_URL;
const original=await (await fetch(base+'original-manifest.json')).json();
const hd=await (await fetch(base+'sprites/manifest.json')).json();
function resolveImages(value:any){if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){if((key==='src'||key==='remapMaskSrc')&&typeof child==='string'&&child.startsWith('/'))value[key]=base+child.slice(1);else resolveImages(child);}}
resolveImages(original);resolveImages(hd);
const assets=new Assets();assets.manifest={sprites:hd.sprites};
// Use actual extracted terrain artwork. Road/resource cells use the engine's existing fallback.
if(original.terrain['temperate:0:0'])assets.terrain={'temperate:0:0':original.terrain['temperate:0:0']};
const hasOriginal=Object.keys(hd.sprites).every(id=>original.sprites[id]);
if(!hasOriginal){($('toggle') as HTMLButtonElement).disabled=true;$('toggle').textContent='原版美术未安装';}
const sceneryKeys=Object.keys(original.scenery).filter(k=>k.startsWith('temperate:')&&/tree0[1-6]$/.test(k));
for(const key of sceneryKeys)assets.scenery[key]=original.scenery[key];
const urls=new Set<string>();for(const sprite of [...Object.values(hd.sprites),...Object.values(original.sprites),...Object.values(assets.terrain),...Object.values(assets.scenery)] as any[])for(const key of ['src','remapMaskSrc'])if(sprite[key])urls.add(sprite[key]);
await Promise.all([...urls].map(src=>new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>{assets.images.set(src,img);resolve();};img.onerror=()=>reject(Error('Cannot load '+src));img.src=src;})));
const width=48,height=48,cells:Terrain[]=Array(width*height).fill('land'),tiles:any[]=[],terrainObjects:any[]=[];
for(let y=0;y<height;y++)for(let x=0;x<width;x++){if((x===28||x===29)||(y===26||y===27))cells[y*width+x]='road';else if(x>33&&x<39&&y>14&&y<20)cells[y*width+x]='ore';else tiles.push({x,y,tileId:0,subTile:0});}
for(let i=0;i<16&&sceneryKeys.length;i++)terrainObjects.push({x:10+i%4*3,y:28+Math.floor(i/4)*2,type:sceneryKeys[i%sceneryKeys.length].split(':')[1]});
const map={id:'hd-local-field',name:'高清精灵集结区',width,height,spawns:[{x:6,y:6}],cells,theater:'temperate',tiles,terrainObjects};
const game=new GameEngine({map,players:[{id:0,name:'素材测试',country:'russia',team:1,color:'#ef494c',ai:false}],startingUnits:0,fogOfWar:false,shortGame:false,superweapons:false});
const initial=game.entities[0];initial.hp=0;
const placements:[string,number,number,number][]=[['construction_yard',15,18,0],['nuclear_reactor',23,14,0],['apocalypse',19,23,0],['apocalypse',22,23,Math.PI/4],['apocalypse',25,23,Math.PI/2],['tanya',18,19,0],['tanya',20,20,Math.PI/2],['tanya',22,19,Math.PI]];
const actors=placements.map(([type,x,y,angle])=>{const e=game.spawnEntity(type,0,x,y);e.angle=angle;return e;});
const renderer=new BattlefieldRenderer($('battle') as HTMLCanvasElement,game,map,assets,{onSelection(ids){$('selection').textContent=ids.length?ids.map(id=>CATALOG[game.getEntity(id)!.type].name).join('、'):'点击单位或框选一组';},onCommand(){},onPlace(){return false;},onEntityClick(){return false;},onNotice(text){$('status').textContent=text;}});renderer.edgeScroll=false;
function home(){renderer.zoom=1.35;renderer.center(20,19);renderer.draw();}
let high=true;
$('toggle').onclick=()=>{if(!hasOriginal)return;high=!high;assets.manifest.sprites=high?hd.sprites:original.sprites;$('toggle').textContent=high?'切换原版素材':'切换高清素材';$('mode').textContent=high?'高清精灵 / 4× 像素密度':'原版精灵 / 原始尺寸';renderer.draw();};
$('fit').onclick=home;$('zoom').onclick=()=>{renderer.zoom=1.7;renderer.center(20,19);renderer.draw();};
$('rotate').onclick=()=>{for(const a of actors)if(a.kind==='unit')a.angle+=Math.PI/4;renderer.draw();};
$('reset').onclick=()=>{actors.forEach((e,i)=>{e.x=placements[i][1];e.y=placements[i][2];e.angle=placements[i][3];e.path=[];e.order={kind:'idle'};});renderer.setSelection([]);home();};
home();let last=performance.now();function frame(now:number){const dt=Math.min((now-last)/1000,.05);last=now;game.step(dt);renderer.update(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);
$('status').textContent='已就绪 · 4 种高清素材 / 8 个实体 · 主游戏 Canvas 2D 渲染器';
(window as any).__hd={game,renderer,assets,actors,hd,original,ready:true};
