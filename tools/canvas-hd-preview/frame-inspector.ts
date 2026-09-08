import type {Sprite} from '@game/assets';
import type {Entity} from '@game/game/types';
import type {BattlefieldRenderer} from '@game/renderer';

/** Inspect the same source frame on a live battlefield actor and its original mirror. */
export function createFrameInspector(renderer:BattlefieldRenderer,source:()=>Entity,original:Sprite){
 const action=document.querySelector<HTMLSelectElement>('#frame-action')!,facing=document.querySelector<HTMLSelectElement>('#frame-facing')!,slider=document.querySelector<HTMLInputElement>('#frame-step')!,play=document.querySelector<HTMLButtonElement>('#frame-play')!,readout=document.querySelector<HTMLElement>('#frame-readout')!;
 const labels:Record<string,string>={ready:'待命',walk:'跑步',fireup:'站姿开枪',crawl:'匍匐',prone:'卧倒待命',fireprone:'卧姿开枪',down:'卧倒',up:'起身',swim:'游泳划水',tread:'踩水',wetattack:'水中开枪',idle1:'待机 1',idle2:'待机 2',die1:'倒地 1',die2:'倒地 2',wetidle1:'水中待机 1',wetidle2:'水中待机 2',wetdie1:'水中倒地 1',wetdie2:'水中倒地 2',paradrop:'伞降姿势',cheer:'欢呼'};
 const hd=renderer.assets.sprite('tany')!,aligned=hd.animationClock==='source'&&hd.frames===original.frames,catalog=aligned?hd:original;
 action.replaceChildren(new Option('自动（游戏状态）','auto'),...Object.keys(labels).filter(k=>catalog.sequences?.[k]).map(k=>new Option(labels[k],k)),new Option('全部原始帧号','all'));
 facing.replaceChildren(...['北','西北','西','西南','南','东南','东','东北'].map((n,i)=>new Option(n,String(i))));
 let playing=false,epoch=0,step=0,time=0;
 const count=()=>action.value==='all'?catalog.frames:catalog.sequences?.[action.value]?.[1]||1;
 const active=()=>action.value!=='auto';
 const configure=()=>{step=0;slider.max=String(count()-1);slider.value='0';playing=false;play.textContent='循环此动作';if(active()){renderer.setSelection([source().id]);renderer.center(source().x,source().y);renderer.zoom=2;}update(time);};
 action.onchange=configure;facing.onchange=()=>update(time);
 slider.oninput=()=>{playing=false;play.textContent='循环此动作';step=Number(slider.value);update(time);};
 play.onclick=()=>{if(!active())return;playing=!playing;epoch=time-step/12;play.textContent=playing?'停在这一帧':'循环此动作';};
 for(const [id,delta]of [['frame-prev',-1],['frame-next',1]] as const)document.getElementById(id)!.onclick=()=>{playing=false;play.textContent='循环此动作';step=(step+delta+count())%count();update(time);};
 function index(){const seq=catalog.sequences?.[action.value];return action.value==='all'?step:seq?seq[0]+Number(facing.value)*seq[2]+step:0;}
 function update(now:number){time=now;if(playing)step=Math.floor(Math.max(0,time-epoch)*12)%count();slider.value=String(step);readout.textContent=active()?`${labels[action.value]||'源帧'} · ${step+1} / ${count()} · 原始帧号 ${index()} · ${aligned?'高清与原版同步':'完整原版动作参考；高清替换尚未接入'}`:'选择动作后，地图中央的谭雅与右侧原版同步逐帧显示';}
 function install(){const previous=renderer.entityPresentation;renderer.entityPresentation=e=>{const view=previous?.(e),actor=source();if(!active()||(e.id!==actor.id&&e.id!==-actor.id-1))return view;return {...view,sprite:e.id<0||!aligned?original:renderer.assets.sprite('tany'),frame:index(),action:action.value,label:e.id<0?'原版':aligned?'高清':'原版参考'};};}
 return {install,update,get active(){return active();},get frame(){return index();}};
}
