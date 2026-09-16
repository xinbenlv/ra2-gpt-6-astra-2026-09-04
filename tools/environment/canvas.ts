// Candidate-only scene: existing Assets/GameEngine/BattlefieldRenderer with baked scenery.
import {Assets} from '@game/assets';
import {GameEngine} from '@game/game/engine';
import {BattlefieldRenderer} from '@game/renderer';
import {configureMapData,importMap} from '@game/maps';
import {compileCustomTerrain} from '@game/custom-terrain';
import {applyNativeTerrain} from '../canvas-hd-preview/native-terrain';
const original=await(await fetch('/original.json')).json(),hd=await(await fetch('/environment/sprites/manifest.json')).json();configureMapData(original.mapMetadata);
const assets=new Assets();assets.manifest={sprites:{tany:original.sprites.tany},overlays:original.overlays};assets.terrain=original.terrain;assets.scenery={'temperate:tree22':original.scenery['temperate:tree22'],'temperate:tree10':original.scenery['temperate:tree10']};
// Local comparison roots measured from last three opaque source rows; original metadata stays untouched.
for(const [id,x,y] of [['tree22',62.75,60],['tree10',61,50]] as [string,number,number][])assets.scenery['temperate:'+id]={...assets.scenery['temperate:'+id],anchorX:x,anchorY:y};
for(const id of ['tree22','tree10','plateau','ramp'])assets.scenery['temperate:hd-'+id]=hd.sprites[id];
const urls=new Set<string>();for(const s of [...Object.values(assets.terrain),...Object.values(assets.scenery),...Object.values(assets.manifest.sprites),...Object.values(original.overlays)] as any[])if(s?.src)urls.add(s.src);for(const s of Object.values(hd.sprites) as any[])urls.add(s.src);
await Promise.all([...urls].map(src=>new Promise<void>((resolve,reject)=>{const im=new Image();im.onload=()=>{assets.images.set(src,im);resolve();};im.onerror=()=>reject(Error(src));im.src=src;})));
const width=48,height=48,cells:any[]=Array(width*height).fill('land');for(let y=14;y<20;y++)for(let x=15;x<24;x++)cells[y*width+x]='water';
const native=applyNativeTerrain({width,height,cells},compileCustomTerrain({width,height,cells,theater:'temperate'},original.mapMetadata.terrain),importMap(original.terrainMap,'valley.map'),assets);
const terrainObjects=[{x:15,y:24,type:'tree22'},{x:18,y:24,type:'hd-tree22'},{x:21,y:24,type:'tree10'},{x:24,y:24,type:'hd-tree10'}];
for(let x=17;x<=20;x++){terrainObjects.push({x,y:29,type:'hd-ramp'});terrainObjects.push({x,y:30,type:'hd-plateau'});}
const map:any={...native,id:'environment-candidate',name:'环境对照',width,height,cells,theater:'temperate',spawns:[{x:5,y:5},{x:40,y:40}],terrainObjects};
const game=new GameEngine({map,players:[{id:0,name:'观察',country:'russia',team:1,color:'#ff5555',ai:false},{id:1,name:'对照',country:'america',team:2,color:'#55aaff',ai:false}],startingUnits:0,startingCredits:1000,fogOfWar:false,shortGame:false,superweapons:false});for(const e of game.entities)e.hp=0;const tanya=game.spawnEntity('tanya',0,19,25);tanya.holdFire=true;
const renderer=new BattlefieldRenderer(document.querySelector('#battle')!,game,map,assets,{onSelection(){},onCommand(){},onPlace(){return false;},onEntityClick(){return false;},onNotice(){}});renderer.edgeScroll=false;
// This candidate adapter supplies the pixelRatio behavior absent from original scenery drawing.
const painter=(renderer as any).terrainPainter,originalOverlay=painter.drawOverlay.bind(painter);
painter.drawOverlay=(ctx:any,s:any,x:number,y:number,f=0)=>{if(!s.pixelRatio)return originalOverlay(ctx,s,x,y,f);const im=assets.images.get(s.src);if(!im)return false;const r=s.pixelRatio;ctx.drawImage(im,0,0,s.frameWidth,s.frameHeight,x-s.anchorX/r,y-s.anchorY/r,s.frameWidth/r,s.frameHeight/r);return true;};
let high=true;renderer.worldGround=ctx=>{if(!high)return;for(const [id,x0,y0] of [['grass',15,21],['ocean',19,15]] as [string,number,number][]){const s=hd.sprites[id],im=assets.images.get(s.src)!;for(let y=y0;y<y0+3;y++)for(let x=x0;x<x0+4;x++){const p=renderer.project(x,y);ctx.drawImage(im,p.x-s.anchorX/4,p.y-s.anchorY/4,s.frameWidth/4,s.frameHeight/4);}}};
document.querySelector('#toggle')!.addEventListener('click',()=>{high=!high;for(const id of ['tree22','tree10'])assets.scenery['temperate:hd-'+id]=high?hd.sprites[id]:assets.scenery['temperate:'+id];renderer.draw();});
renderer.zoom=1.7;renderer.center(21,23);renderer.draw();document.querySelector('#status')!.textContent='两树原版／HD 并排；谭雅提供尺度参照。上方：草地与海面；下方：HD 高台坡道，右侧为 valley 原版高差。';
(window as any).environmentCanvas={ready:true,renderer,game,assets,map};function frame(){renderer.update(.016);requestAnimationFrame(frame);}requestAnimationFrame(frame);
