import { Assets } from '@game/assets';
import { GameEngine } from '@game/game/engine';
import { spriteAnimation } from '@game/sprite-animation';
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
const map={id:'hd-local-field',name:'高清精灵集结区',width,height,spawns:[{x:6,y:6},{x:40,y:40}],cells,theater:'temperate',tiles,terrainObjects};
const placements:[string,number,number,number][]=[['construction_yard',15,18,0],['nuclear_reactor',23,14,0],['apocalypse',19,23,0],['apocalypse',22,23,Math.PI/4],['apocalypse',25,23,Math.PI/2],['tanya',18,19,0],['tanya',20,20,Math.PI/2],['tanya',22,19,Math.PI]];
const targetPlacements:[string,number,number][]=[['apocalypse',29,20],['tanya',27,17],['construction_yard',31,12]];
function makeScenario(){
 const game=new GameEngine({map,players:[{id:0,name:'我方',country:'russia',team:1,color:($('own-color') as HTMLInputElement).value,ai:false},{id:1,name:'训练靶标',country:'america',team:2,color:($('enemy-color') as HTMLInputElement).value,ai:false}],startingUnits:0,startingCredits:50000,fogOfWar:false,shortGame:false,superweapons:false});
 for(const e of game.entities)e.hp=0;
 const actors=placements.map(([type,x,y,angle])=>{const e=game.spawnEntity(type,0,x,y);e.angle=angle;e.holdFire=true;return e;});
 const targets=targetPlacements.map(([type,x,y])=>{const e=game.spawnEntity(type,1,x,y);e.holdFire=true;return e;});
 return {game,actors,targets};
}
let {game,actors,targets}=makeScenario();
const renderer=new BattlefieldRenderer($('battle') as HTMLCanvasElement,game,map,assets,{onSelection(){updateSelection();},onCommand(kind){$('status').textContent=kind==='attack'?'攻击指令已下达 · 靶标默认不还击':'移动指令已下达';},onPlace(){return false;},onEntityClick(){return false;},onNotice(text){$('status').textContent=text;}});renderer.edgeScroll=false;renderer.hdEffects=true;
let high=true,paused=false,speed=1,retaliating=false;
function home(){renderer.zoom=1.15;renderer.center(23,18);renderer.draw();}
function updateSelection(){
 const selected=[...renderer.selection].map(id=>game.getEntity(id)).filter(Boolean);
 $('selection').textContent=selected.length?selected.map(e=>`${CATALOG[e!.type].name} · ${Math.ceil(e!.hp)}/${e!.maxHp}`).join('、'):'点击单位或框选一组';
 const e=selected[0],sprite=e&&assets.sprite(CATALOG[e.type].sprite);
 const action=e&&sprite?spriteAnimation(sprite,e,game.time).action:'ready';
 const labels:Record<string,string>={ready:'待命',walk:'移动',fireup:'开火',hit:'受击',deployed:'部署'};
 $('action').textContent=e?(e.repairing?'维修中':labels[action]||action):'等待选择';
 const canvas=$('pose-preview') as HTMLCanvasElement,ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,canvas.width,canvas.height);
 if(e&&sprite){const image=(renderer as any).coloredSprite(sprite,game.getPlayer(e.owner)?.color||'#aaaaaa');if(image){const frame=spriteAnimation(sprite,e,game.time).frame,w=sprite.frameWidth,h=sprite.frameHeight,scale=Math.min((canvas.width-24)/w,(canvas.height-16)/h);ctx.drawImage(image,frame%sprite.columns*w,Math.floor(frame/sprite.columns)*h,w,h,(canvas.width-w*scale)/2,(canvas.height-h*scale)/2,w*scale,h*scale);}}

}
$('toggle').onclick=()=>{if(!hasOriginal)return;high=!high;assets.manifest.sprites=high?hd.sprites:original.sprites;renderer.hdEffects=high;$('toggle').textContent=high?'切换原版素材':'切换高清素材';$('mode').textContent=high?'高清动作 / 阵营换色':'原版精灵 / 原始尺寸';renderer.draw();};
$('fit').onclick=home;$('zoom').onclick=()=>{renderer.zoom=2;renderer.center(23,20);renderer.draw();};
$('rotate').onclick=()=>{for(const a of actors)if(a.kind==='unit')a.angle+=Math.PI/4;renderer.draw();};
$('stop').onclick=()=>game.commandStop([...renderer.selection]);
$('retaliate').onclick=()=>{retaliating=!retaliating;const target=[...renderer.selection].map(id=>game.getEntity(id)).find(e=>e&&e.owner===0)||actors.find(e=>e.hp>0&&e.kind==='unit');const ids=targets.filter(e=>e.hp>0&&e.kind==='unit').map(e=>e.id);if(retaliating&&target)game.commandAttack(ids,target.id);else game.commandStop(ids);$('retaliate').textContent=retaliating?'停止靶标还击':'靶标向选中单位还击';};
$('repair').onclick=()=>{const selected=[...renderer.selection].map(id=>game.getEntity(id)).filter(e=>e?.kind==='building'&&e.owner===0);for(const e of selected)game.repair(e!.id);$('status').textContent=selected.length?'已切换建筑维修 · 消耗实际游戏资金':'先选择受损的我方建筑';};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'继续':'暂停';};
$('speed').onchange=()=>speed=Number(($('speed') as HTMLSelectElement).value);
for(const [id,player]of [['own-color',0],['enemy-color',1]] as const)$(id).oninput=()=>{game.players[player].color=($(id) as HTMLInputElement).value;renderer.clearSpriteColors();renderer.draw();updateSelection();};
$('reset').onclick=()=>{({game,actors,targets}=makeScenario());renderer.game=game;renderer.setSelection([]);retaliating=false;$('retaliate').textContent='靶标向选中单位还击';home();};
home();let last=performance.now(),ui=0;function frame(now:number){const dt=paused?0:Math.min((now-last)/1000,.05)*speed;last=now;game.step(dt);renderer.update(dt);ui+=dt;if(ui>.1){ui=0;updateSelection();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
$('status').textContent='已就绪 · 左键选择，右键地面移动／靶标攻击 · 高清程序动作预览';
(window as any).__hd={get game(){return game;},renderer,assets,get actors(){return actors;},get targets(){return targets;},hd,original,ready:true,animation:(id:number)=>{const e=game.getEntity(id);return e?spriteAnimation(assets.sprite(CATALOG[e.type].sprite)!,e,game.time):undefined;}};
