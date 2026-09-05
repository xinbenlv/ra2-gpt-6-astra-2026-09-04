import './style.css';
import { APP_TITLE } from './project';
import { projectNotice, sourceCodeLink } from './project-notice';
import { mountDebugPanel } from './debug-panel';
import { appUrl } from './urls';
import { t, registerTranslations, localizeElement, languageControl, bindLanguageControl } from './i18n';
import { probeOriginalAssets, showAssetSetup, OriginalAssetsError } from './asset-setup';
import { Assets, SoundSystem } from './assets';
import { initializeMaps, listMaps, loadMap, importMap, registerImportedMap, isWithinPlayableArea, type MapData, type MapDefinition } from './maps';
import { GameEngine, COUNTRIES, CATALOG, CATEGORY_NAMES, PLAYER_COLORS, countryById, getDefinition, type CountryId, type Difficulty, type PlayerConfig, type ProductionCategory, type Entity } from './game';
import { BattlefieldRenderer, type RenderMap } from './renderer';

const app = document.querySelector<HTMLDivElement>('#app')!;
for (const [name, file] of Object.entries({ 'menu-map':'mnscrnl', 'loading-art':'glsl', 'allied-sidebar':'sidec01-top', 'soviet-sidebar':'sidec02-top' }))
  document.documentElement.style.setProperty(`--${name}`, `url("${appUrl(`/assets/ui/${file}.png`)}")`);
registerTranslations(Object.fromEntries(COUNTRIES.map(country => [country.name, country.nameEn])));
const nameCounts = new Map<string, number>();
for (const definition of Object.values(CATALOG)) nameCounts.set(definition.name, (nameCounts.get(definition.name) ?? 0) + 1);
registerTranslations(Object.fromEntries(Object.values(CATALOG).map(definition => [definition.name, nameCounts.get(definition.name)! > 1 ? definition.nameEn.replace(/^(Allied|Soviet) /, '') : definition.nameEn])));
function translateUI(root: ParentNode = app) { localizeElement(root); }
function bindLanguage() { bindLanguageControl(app, () => { buildSignature='';supportSignature='';if(playing)updateUI(); }); }
const assets = new Assets();
const sound = new SoundSystem(assets);
sound.musicEnabled = true;
const bolts = '<i class="bolt tl"></i><i class="bolt tr"></i><i class="bolt bl"></i><i class="bolt br"></i>';
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]!));
const $ = <T extends HTMLElement = HTMLElement>(selector: string, parent: ParentNode = document): T => parent.querySelector(selector)!;
interface Slot { country: CountryId | 'random'; difficulty: Difficulty | 'closed' | 'human'; color: number; team: number; position: number }
const slots: Slot[] = Array.from({length:8},(_,i)=>({country:i===0?'america':i===1?'russia':'random',difficulty:i===0?'human':i===1?'medium':'closed',color:i,team:0,position:i===0?0:i===1?4:-1}));
let selectedMapId = 'mp22s8';
let selectedMap: MapData;
let credits = 10000, startingUnits = 5, gameSpeed = 1, fog = true, superweapons = true, shortGame = true;
let game: GameEngine | undefined, renderer: BattlefieldRenderer | undefined;
let category: ProductionCategory = 'structure';
let playing = false, animation = 0, lastTick = 0, lastUI = 0, lastEvent = 0, lastComplete = 0;
let modalOpen = false, modalOwnsPause = false;
let supportMode: string | undefined;
let lastSoundEffect = 0;
let notices: {text:string;until:number;warn:boolean}[] = [];
let shownResult = false;
let buildSignature = '';
let supportSignature = '';
const groups = new Map<string, number[]>();

async function init() {
  if(!await probeOriginalAssets()){showAssetSetup(app);return;}
  await initializeMaps();
  registerTranslations(Object.fromEntries(listMaps().map(map => [map.name, map.nameEn])));
  app.innerHTML = `<div class="loading-screen"><div><h1 class="app-title">${APP_TITLE}</h1><p id="loading-label">正在读取原版战场资料</p><div class="loading-bar"><i id="loading-progress" style="width:5%"></i></div></div></div>`;
  translateUI();
  const mapPromise = loadMap(selectedMapId);
  await assets.load(progress => { const el = document.querySelector<HTMLElement>('#loading-progress');if(el)el.style.width=`${5+progress*90}%`; });
  selectedMap = await mapPromise;
  renderLobby();
}
function countryOptions(value: string, random = true) {
  return `${random?`<option value="random" ${value==='random'?'selected':''}>随机国家</option>`:''}${COUNTRIES.map(c=>`<option value="${c.id}" ${value===c.id?'selected':''}>${c.flag} ${c.name}</option>`).join('')}`;
}
function option(value: number | string, text: string, current: number | string) { return `<option value="${value}" ${value===current?'selected':''}>${text}</option>`; }
function renderLobby() {
  playing = false; shownResult = false; cancelAnimationFrame(animation); renderer?.destroy();renderer=undefined;game=undefined;
  const def = listMaps().find(m=>m.id===selectedMapId)!;
  app.innerHTML = `<main class="shell">
    <header class="header"><div class="brand"><h1 class="app-title">${APP_TITLE}</h1><div class="brand-caption"><strong>遭遇战</strong><span class="eyebrow">SKIRMISH OPERATIONS</span></div></div><div class="header-right">${languageControl()}<span class="technical"><i class="status-light"></i>本地战场已就绪</span><button id="sound-toggle" class="icon-button" title="音效">${sound.enabled?'♪':'♩'}</button><button id="help">操作说明</button></div></header>
    <div class="lobby"><section class="map-panel metal">${bolts}<div class="panel-title"><h2>战场情报</h2><span>THEATER / ${escape(def.theater.toUpperCase())}</span></div><div class="map-viewport"><canvas id="map-preview" aria-label="北极圈原版地图预览"></canvas><i class="map-corner tl"></i><i class="map-corner tr"></i><i class="map-corner bl"></i><i class="map-corner br"></i><span class="map-coordinate">SATELLITE RECONNAISSANCE · ${escape(def.id.toUpperCase())}</span></div><div class="map-info"><div><h3>${escape(def.name)}</h3><p>${escape(def.nameEn.toUpperCase())} · ${def.players} PLAYERS</p></div><button id="choose-map">选择地图 ▸</button></div><div class="map-details"><div><label>战场规模</label><strong>${def.width} × ${def.height}</strong></div><div><label>作战地形</label><strong>${({snow:'雪地 · 海岛',temperate:'温带',urban:'城市'} as Record<string,string>)[def.theater] || def.theater}</strong></div><div><label>地图来源</label><strong>${def.official?'Westwood 原版':'本地导入'}</strong></div></div></section>
    <section class="settings-panel metal">${bolts}<div class="panel-title"><h2>作战部署</h2><span>COMBATANTS / ${slots.filter(s=>s.difficulty!=='closed').length}</span></div><table class="player-table"><thead><tr><th></th><th>指挥官</th><th>国家</th><th>颜色</th><th>盟友</th><th>位置</th></tr></thead><tbody>${slots.map((slot,i)=>renderSlot(slot,i,def.players)).join('')}</tbody></table><p class="country-note" id="country-note">${escape(countryById(slots[0].country).name)}：${escape(countryById(slots[0].country).description)}</p>
    <div class="lobby-options"><div class="field"><label for="credits">初始资金</label><select id="credits">${[5000,10000,20000,30000,50000].map(v=>option(v,`$ ${v.toLocaleString()}`,credits)).join('')}</select></div><div class="field"><label for="units">初始部队</label><select id="units">${[0,3,5,10].map(v=>option(v,`${v} 支部队 + 基地车`,startingUnits)).join('')}</select></div><div class="field"><label for="speed">游戏速度</label><select id="speed">${option(.75,'慢速',gameSpeed)}${option(1,'正常',gameSpeed)}${option(1.5,'快速',gameSpeed)}${option(2,'最快',gameSpeed)}</select></div></div><div class="checks"><label><input type="checkbox" id="fog" ${fog?'checked':''}/>战争迷雾</label><label><input type="checkbox" id="superweapons" ${superweapons?'checked':''}/>超级武器</label><label><input type="checkbox" id="short-game" ${shortGame?'checked':''}/>快速游戏</label><label><input type="checkbox" id="music" ${sound.musicEnabled?'checked':''}/>原版音乐</label></div>
    </section></div>
    <div class="lobby-bottom"><div class="transmission"><span class="symbol">▣</span><div><strong>指挥官，等待您的命令。</strong><br>建立基地，开采资源，消灭敌方势力。盟军与苏军 9 国已就绪。</div></div><button id="start" class="primary start-button">开始作战</button></div>${sourceCodeLink()}${projectNotice()}<footer class="footer"><span>WESTWOOD ORIGINAL ASSETS · ${listMaps().length} SKIRMISH MAPS</span>${sourceCodeLink()}</footer>
  </main>`;
  translateUI();bindLanguage();
  drawMapPreview($('#map-preview'), selectedMap);
  $('#choose-map').onclick = openMapChooser;
  $('#help').onclick = showHelp;
  $('#sound-toggle').onclick = () => {sound.enabled=!sound.enabled;$('#sound-toggle').textContent=sound.enabled?'♪':'♩';if(sound.enabled)sound.play('allied_establishingbattlefieldcontrol');};
  $('#start').onclick = startGame;
  $('#credits').onchange = e=>credits=Number((e.target as HTMLSelectElement).value);
  $('#units').onchange = e=>startingUnits=Number((e.target as HTMLSelectElement).value);
  $('#speed').onchange = e=>gameSpeed=Number((e.target as HTMLSelectElement).value);
  $('#fog').onchange = e=>fog=(e.target as HTMLInputElement).checked;
  $('#superweapons').onchange = e=>superweapons=(e.target as HTMLInputElement).checked;
  $('#short-game').onchange=e=>shortGame=(e.target as HTMLInputElement).checked;
  $('#music').onchange = e=>sound.setMusic((e.target as HTMLInputElement).checked);
  document.querySelectorAll<HTMLSelectElement>('[data-slot]').forEach(el=>el.onchange=()=>{
    const index=Number(el.dataset.slot),key=el.dataset.key as keyof Slot;
    const v = key==='color'||key==='team'||key==='position'?Number(el.value):el.value;
    Object.assign(slots[index],{[key]:v});renderLobby();
  });
}
function renderSlot(s:Slot,i:number,maxPlayers:number){
  const disabled=i>=maxPlayers;const closed=s.difficulty==='closed'||disabled;
  return `<tr class="${i===0?'human':closed?'closed-row':''}"><td>${String(i+1).padStart(2,'0')}</td><td>${i===0?'<span class="player-name">玩家</span>':`<select aria-label="玩家 ${i+1} 类型" data-slot="${i}" data-key="difficulty" ${disabled?'disabled':''}>${option('closed','— 关闭 —',closed?'closed':s.difficulty)}${option('easy','简单的电脑',s.difficulty)}${option('medium','中等的电脑',s.difficulty)}${option('hard','冷酷的电脑',s.difficulty)}</select>`}</td><td><select aria-label="玩家 ${i+1} 国家" data-slot="${i}" data-key="country" ${closed?'disabled':''}>${countryOptions(s.country,i!==0)}</select></td><td><select class="color-select" style="--player-color:${PLAYER_COLORS[s.color]}" aria-label="玩家 ${i+1} 颜色" data-slot="${i}" data-key="color" ${closed?'disabled':''}>${['金色','红色','蓝色','绿色','橙色','紫色','青色','粉色'].map((v,k)=>option(k,v,s.color)).join('')}</select></td><td><select aria-label="玩家 ${i+1} 盟友" data-slot="${i}" data-key="team" ${closed?'disabled':''}>${option(0,'—',s.team)}${[1,2,3,4].map(v=>option(v,String.fromCharCode(64+v),s.team)).join('')}</select></td><td><select aria-label="玩家 ${i+1} 位置" data-slot="${i}" data-key="position" ${closed?'disabled':''}>${option(-1,'随机',s.position)}${Array.from({length:maxPlayers},(_,v)=>option(v,String(v+1),s.position)).join('')}</select></td></tr>`;
}
function drawMapPreview(canvas:HTMLCanvasElement,map:MapData){
  const rect=canvas.getBoundingClientRect();const w=Math.max(360,Math.round(rect.width*2)),h=Math.max(240,Math.round(rect.height*2));canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  const draw=(source?:CanvasImageSource,iw=0,ih=0)=>{
    ctx.fillStyle='#071410';ctx.fillRect(0,0,w,h);
    // A native RA2 PreviewPack contains RGB pixels at the map's exact aspect ratio.
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const t of map.tiles){const x=t.x-t.y,y=(t.x+t.y)/2;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    const aspect=(maxX-minX+2)/(maxY-minY+1),dw=w*.88,dh=Math.min(h*.76,dw/aspect);const fw=Math.min(dw,dh*aspect),fh=fw/aspect,ox=(w-fw)/2,oy=(h-fh)/2;
    if(source)ctx.drawImage(source,0,0,iw,ih,ox,oy,fw,fh);
    else for(const t of map.tiles){const c=map.radarColors[t.y*map.width+t.x];ctx.fillStyle=`#${c.toString(16).padStart(6,'0')}`;ctx.fillRect(ox+(t.x-t.y-minX)/(maxX-minX+2)*fw,oy+((t.x+t.y)/2-minY)/(maxY-minY+1)*fh,Math.max(2,fw/(maxX-minX)*2),Math.max(2,fh/(maxY-minY)));}
    ctx.strokeStyle='#70835a6b';ctx.lineWidth=1;ctx.strokeRect(ox-1,oy-1,fw+2,fh+2);
    map.spawns.forEach((p,i)=>{const x=ox+(p.x-p.y-minX)/(maxX-minX+2)*fw,y=oy+((p.x+p.y)/2-minY)/(maxY-minY+1)*fh;const slot=slots.find(s=>s.position===i&&s.difficulty!=='closed');ctx.fillStyle=slot?PLAYER_COLORS[slot.color]:'#16251a';ctx.strokeStyle=slot?'#eee4a8':'#c4cda5';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=slot?'#14201a':'#e1e6b9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 14px Tahoma';ctx.fillText(String(i+1),x,y+1);});
    ctx.fillStyle='#7d9d734c';ctx.font='11px Consolas';ctx.textAlign='left';ctx.fillText('N',w/2-4,25);ctx.beginPath();ctx.moveTo(w/2,34);ctx.lineTo(w/2,47);ctx.stroke();
  };
  if(map.previewData){const {width,height,rgb}=map.previewData;const c=document.createElement('canvas');c.width=width;c.height=height;const cctx=c.getContext('2d')!,data=cctx.createImageData(width,height);for(let i=0;i<rgb.length/3;i++){data.data[i*4]=rgb[i*3];data.data[i*4+1]=rgb[i*3+1];data.data[i*4+2]=rgb[i*3+2];data.data[i*4+3]=255;}cctx.putImageData(data,0,0);draw(c,width,height);}
  else if(map.preview){const image=new Image();image.onload=()=>draw(image,image.width,image.height);image.src=map.preview;draw();}else draw();
}
function showModal(title:string,body:string,actions:string,small=false){
  closeModal();modalOpen=true;
  if(game&&playing&&!game.paused){game.paused=true;modalOwnsPause=true;}
  const el=document.createElement('div');el.className='modal-shade';el.innerHTML=`<section class="modal metal ${small?'small':''}" role="dialog" aria-modal="true" aria-label="${escape(title)}">${bolts}<h2 class="modal-title">${title}<button class="icon-button" id="modal-x" aria-label="关闭">×</button></h2><div class="modal-body">${body}</div><div class="modal-actions">${actions}</div></section>`;document.body.append(el);$('#modal-x').onclick=closeModal;
  translateUI(el);el.querySelector<HTMLButtonElement>('button')?.focus();return el;
}
function closeModal(){document.querySelector('.modal-shade')?.remove();modalOpen=false;if(game&&modalOwnsPause){game.paused=false;modalOwnsPause=false;}}
function openMapChooser(){
  let candidate=selectedMapId,current=selectedMap,request=0,loading=false;const maps=listMaps();
  showModal('选择战场',`<div class="map-browser"><div><input id="map-search" class="map-search" placeholder="搜索地图名称…" aria-label="搜索地图"/><div class="map-list inset" id="map-list"></div></div><div class="preview-column"><canvas id="map-modal-preview" class="map-modal-preview"></canvas><h3 id="candidate-name">${escape(selectedMap.name)}</h3><p id="candidate-meta" class="muted">${selectedMap.players} 人 · 原版地图</p></div></div>`,`<input id="map-file" type="file" accept=".map,.mpr" hidden/><button id="import-map">导入 .map / .mpr</button><span class="spacer"></span><button id="map-cancel">取消</button><button id="map-confirm" class="primary">确认战场</button>`);
  const renderList=(query='')=>{$('#map-list').innerHTML=maps.filter(m=>(m.name+' '+m.nameEn).toLowerCase().includes(query.toLowerCase())).map(m=>`<button data-map-id="${m.id}" class="${m.id===candidate?'active':''}">${escape(m.name)}<span>${m.players} 人${m.specialMode==='megawealth'?' · 巨富':m.specialMode==='unfinished'?' · 草稿':''}</span></button>`).join('');translateUI($('#map-list'));document.querySelectorAll<HTMLButtonElement>('[data-map-id]').forEach(b=>b.onclick=async()=>{try{const token=++request,id=b.dataset.mapId!;loading=true;$<HTMLButtonElement>('#map-confirm').disabled=true;const loaded=await loadMap(id);if(token!==request||!modalOpen)return;candidate=id;current=loaded;loading=false;$<HTMLButtonElement>('#map-confirm').disabled=false;renderList($<HTMLInputElement>('#map-search').value);drawMapPreview($('#map-modal-preview'),current);$('#candidate-name').textContent=current.name;$('#candidate-meta').textContent=`${current.players} 人 · ${current.theater.toUpperCase()} · ${current.originalSize[2]} × ${current.originalSize[3]}${current.notes?' · '+current.notes:''}`;translateUI($('.preview-column'));}catch(e){loading=false;if(document.querySelector('#map-confirm'))$<HTMLButtonElement>('#map-confirm').disabled=false;toast(String(e));}});};
  renderList();drawMapPreview($('#map-modal-preview'),current);$('#map-search').oninput=e=>renderList((e.target as HTMLInputElement).value);
  $('#map-cancel').onclick=closeModal;$('#map-confirm').onclick=()=>{if(loading)return;selectedMapId=candidate;selectedMap=current;slots.forEach((s,i)=>{if(i>=current.players)s.difficulty='closed';if(s.position>=current.players)s.position=-1;});closeModal();renderLobby();};
  $('#import-map').onclick=()=>$('#map-file').click();$('#map-file').onchange=async e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;try{const data=importMap(await file.text(),file.name);const def=registerImportedMap(data);selectedMapId=def.id;selectedMap=data;slots.forEach((s,i)=>{if(i>=data.players)s.difficulty='closed';if(s.position>=data.players)s.position=-1;});closeModal();renderLobby();toast(`已导入 ${data.name}`);}catch(error){toast(`导入失败：${error instanceof Error?error.message:String(error)}`);}};
}
function showHelp(){
  showModal('作战操作',`<div class="help-grid"><kbd>左键 / 框选</kbd><span>选中己方单位；按住 Shift 增减选择。</span><kbd>右键</kbd><span>移动部队，点击敌军发动攻击；取消建筑放置。</span><kbd>双击基地车 / D</kbd><span>部署基地车。大兵与辐射工兵也可部署。</span><kbd>建造图标</kbd><span>点击开始生产，建筑就绪后点击图标并放置。</span><kbd>右击建造图标</kbd><span>取消该类生产队列中的一个项目。</span><kbd>方向键 / 鼠标边缘</kbd><span>移动视角。也可中键拖动或按住空格拖动。</span><kbd>滚轮</kbd><span>缩放战场。</span><kbd>H / 雷达点击</kbd><span>返回基地 / 快速移动视角。</span><kbd>A → 左键</kbd><span>攻击移动，沿途交战。</span><kbd>S / G</kbd><span>停止 / 警戒。</span><kbd>Ctrl + 1–9</kbd><span>建立编队，数字键选择编队。</span><kbd>Tab</kbd><span>切换建造分类。</span><kbd>Esc / P</kbd><span>取消当前命令 / 暂停与选项。</span></div>`,`<button id="help-close" class="primary">收到</button>`);$('#help-close').onclick=closeModal;
}
async function startGame(){
  try{
    if(selectedMap.specialMode==='unfinished'){toast(selectedMap.notes || '此文件是原包附带的未完成草稿，无法作为完整遭遇战启动。');return;}
    const active=slots.map((s,i)=>({...s,index:i})).filter((s,i)=>s.difficulty!=='closed'&&i<selectedMap.players);
    if(active.length<2){toast('至少需要一名电脑对手。');return;}
    const teams=new Set(active.map(s=>s.team||s.index+10));if(teams.size<2){toast('至少需要两个敌对阵营，请调整盟友。');return;}
    const assigned=new Set<number>();for(const s of active){if(s.position>=0){if(assigned.has(s.position)){toast('玩家的起始位置不能重复。');return;}assigned.add(s.position);}}
    const available=selectedMap.spawns.map((_,i)=>i).filter(i=>!assigned.has(i)).sort(()=>Math.random()-.5);
    const configs:PlayerConfig[]=active.map((s,i)=>({id:i,name:i===0?'玩家':`${s.difficulty==='hard'?'冷酷':s.difficulty==='easy'?'简单':'中等'}的电脑 ${i}`,country:s.country==='random'?COUNTRIES[Math.floor(Math.random()*COUNTRIES.length)].id:s.country,team:s.team||s.index+10,ai:i!==0,difficulty:s.difficulty==='human'||s.difficulty==='closed'?'medium':s.difficulty,color:PLAYER_COLORS[s.color]}));
    const map:RenderMap={...selectedMap,cells:selectedMap.cells.map((t,i)=>selectedMap.valid[i]&&isWithinPlayableArea(selectedMap,i%selectedMap.width,Math.floor(i/selectedMap.width))?t:'void'),spawns:active.map(s=>selectedMap.spawns[s.position>=0?s.position:available.shift()!]),terrainObjects:selectedMap.scenery,structures:[]};
    const neutralStructures=selectedMap.structures.filter(s=>isWithinPlayableArea(selectedMap,s.x,s.y)).map(s=>{const sprite=assets.scenery[`${selectedMap.theater}:${s.type.toLowerCase()}`];const foundation: [number,number]=sprite?.foundation||[1,1];return {nativeType:s.type,x:s.x+foundation[0]/2,y:s.y+foundation[1]/2,health:s.health,foundation};});
    game=new GameEngine({map,players:configs,startingCredits:credits,startingUnits,fogOfWar:fog,superweapons,shortGame,neutralStructures,localPlayerId:0,seed:Date.now()});game.speed=gameSpeed;
    category='structure';lastSoundEffect=0;buildSignature='';supportSignature='';lastEvent=0;lastComplete=0;notices=[];groups.clear();supportMode=undefined;
    sound.setMusic(sound.musicEnabled);renderGame(map);playing=true;lastTick=performance.now();lastUI=0;shownResult=false;
    sound.play(`${configs[0].country==='russia'||countryById(configs[0].country).faction==='soviet'?'soviet':'allied'}_establishingbattlefieldcontrol`);
    const mcv=game.entities.find(e=>e.owner===0&&e.type.includes('mcv'));if(mcv)renderer!.setSelection([mcv.id]);
    notice('战场控制已建立。双击基地车或按 D 展开基地。');if(selectedMap.notes)notice(selectedMap.notes);animation=requestAnimationFrame(frame);
  }catch(error){toast(`无法启动战场：${error instanceof Error?error.message:String(error)}`);console.error(error);}
}
function renderGame(map:RenderMap){
  const faction=game!.players[0].faction;
  app.innerHTML=`<main class="game-screen"><header class="game-top"><div class="left"><button id="game-options">选项 <small>Esc</small></button><div class="game-heading"><h1 class="app-title">${APP_TITLE}</h1><span class="game-title">${escape(selectedMap.name)} · 遭遇战</span></div></div><div class="right">${languageControl()}<span class="game-time" id="game-time">00:00</span><span class="speed-label">速度</span><button id="game-speed">${gameSpeed}×</button><button id="game-help" title="操作说明">?</button></div></header><div class="game-body"><section class="battlefield" id="battlefield"><canvas id="battlefield-canvas" tabindex="0" aria-label="即时战略战场"></canvas><div class="hud-message" id="hud-message"></div><div class="battlefield-tools" id="battlefield-tools"><div class="hud-objective" id="hud-objective"></div></div><div class="selection-info" id="selection-info"></div></section><aside class="sidebar ${faction}"><div class="sidebar-brand"><span class="faction-symbol">${faction==='soviet'?'★':'◆'}</span>${faction==='soviet'?'SOVIET':'ALLIED'}<span class="eyebrow">COMMAND</span></div><div class="credits"><small>$</small><span id="money">${credits.toLocaleString()}</span></div><div class="radar"><canvas id="radar" aria-label="战场雷达"></canvas><span class="radar-label">TACTICAL RADAR</span></div><div class="power-line"><span>ϟ</span><div class="power-bar" id="power-bar"><i></i></div><span class="power-readout" id="power-readout">0 / 0</span></div><div class="sidebar-tools"><button id="repair" title="修理建筑">维修</button><button id="sell" title="出售建筑">出售</button><button id="deploy" title="部署选中单位（D）">部署</button><button id="home" title="返回基地（H）">基地</button></div><nav class="build-tabs" aria-label="建造分类"><button data-category="structure" class="active" title="建筑"><span>▥</span><small>建筑</small></button><button data-category="defense" title="防御"><span>⌖</span><small>防御</small></button><button data-category="infantry" title="步兵"><span>♟</span><small>步兵</small></button><button data-category="vehicle" title="战车 / 飞机 / 舰艇"><span>▰</span><small>载具</small></button></nav><div class="build-list" id="build-list"></div><div id="support-list" class="support-list"></div><div class="build-detail" id="build-detail"><strong>建造面板</strong><br>选择建筑或部队开始生产。</div></aside></div><footer class="game-bottom"><span id="selection-label">没有选中单位</span><span class="hotkeys">左键选择 · 右键命令 · D 部署 · H 基地 · 滚轮缩放</span><span id="battle-status">战场控制在线</span></footer></main>`;
  renderer=new BattlefieldRenderer($('#battlefield-canvas'),game!,map,assets,{
    onSelection:()=>{updateSelection();const selected=game!.entities.find(e=>renderer?.selection.has(e.id));if(selected)sound.voice(selected.type,'select');},onCommand:(kind)=>{const selected=game!.entities.find(e=>renderer?.selection.has(e.id));if(kind==='deploy')sound.play('uplace');else if(selected)sound.voice(selected.type,kind==='attack'?'attack':'move');if(renderer&&!renderer.attackMove)$('#battlefield').classList.remove('attack-mode');},onNotice:text=>{notice(text);clearTools();},
    onPlace:(x,y)=>{
      if(supportMode){const success=game!.support(0,supportMode,x,y,[...renderer!.selection]);if(success){supportMode=undefined;renderer!.tool='select';notice('支援命令已下达。');}return success;}
      const def=renderer!.placement;if(!def)return false;
      const success=game!.place(0,def.id,x,y);if(success){renderer!.placement=undefined;$('#battlefield').classList.remove('build-mode');sound.play(`${game!.players[0].faction}_constructioncomplete`);renderBuildList();}else{notice('无法在此建造。请选择已探明、平坦且靠近基地的区域。',true);sound.play(`${game!.players[0].faction}_cannotdeployhere`);}return success;
    },
    onEntityClick:e=>{
      if(renderer!.tool==='repair'){if(e.owner===0)game!.repair(e.id);return true;}
      if(renderer!.tool==='sell'){if(e.owner===0)game!.sell(e.id);return true;}
      return false;
    }
  });renderer.attachMinimap($('#radar'));
  $('#game-options').onclick=showPause;$('#game-help').onclick=showHelp;
  $('#game-speed').onclick=()=>{gameSpeed=gameSpeed===.75?1:gameSpeed===1?1.5:gameSpeed===1.5?2:.75;game!.speed=gameSpeed;$('#game-speed').textContent=`${gameSpeed}×`;};
  $('#repair').onclick=()=>setTool('repair');$('#sell').onclick=()=>setTool('sell');$('#home').onclick=()=>renderer!.home();$('#deploy').onclick=deploySelection;
  document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(el=>el.onclick=()=>{category=el.dataset.category as ProductionCategory;renderBuildList();});
  mountDebugPanel($('#battlefield-tools'),game!,sound,()=>{updateUI();renderer!.draw();});
  renderBuildList();updateUI();bindLanguage();
}
function setTool(tool:'repair'|'sell'){if(!renderer)return;const next=renderer.tool===tool?'select':tool;clearTools();renderer.tool=next;renderer.placement=undefined;renderer.attackMove=false;$('#repair').classList.toggle('active',renderer.tool==='repair');$('#sell').classList.toggle('active',renderer.tool==='sell');$('#battlefield').className='battlefield '+(renderer.tool==='select'?'':`${renderer.tool}-mode`);}
function clearTools(){if(!renderer)return;renderer.tool='select';renderer.placement=undefined;renderer.attackMove=false;supportMode=undefined;$('#repair')?.classList.remove('active');$('#sell')?.classList.remove('active');$('#battlefield').className='battlefield';}
function deploySelection(){if(!game||!renderer)return;game.deploy([...renderer.selection]);game.unload([...renderer.selection]);renderBuildList();updateSelection();sound.play(`${game.players[0].faction}_newconstructionoptions`);}
function cameoUrl(cameo:string,sprite:string){const key=cameo.replace(/icon$/,'');const item=assets.manifest.cameos?.[key]||assets.manifest.cameos?.[sprite];return typeof item==='string'?item:item?.src;}
function renderBuildList(){
  if(!game||!renderer)return;if(document.querySelector('.build-item:active'))return;const p=game.players[0];
  document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(el=>el.classList.toggle('active',el.dataset.category===category));
  const all=Object.values(CATALOG).filter(d=>!d.neutral&&(category==='vehicle'?['vehicle','aircraft','naval'].includes(d.category):d.category===category)&&(d.faction===p.faction||d.faction==='both')&&(!d.country||d.country===p.country)&&!d.id.includes('construction_yard'));
  const hasYard=game.entities.some(e=>e.owner===0&&e.type.includes('construction_yard')&&e.hp>0);
  if(!hasYard&&(category==='structure'||category==='defense')){buildSignature='';$('#build-list').innerHTML='<div class="empty-production"><span>⌘</span><strong>等待基地部署</strong><p>选中基地车<br>双击或按 D 展开</p></div>';translateUI($('#build-list'));return;}
  const unlocked = new Set(game.getAvailable(0).map(d=>d.id));
  const canSee=all.filter(d=>unlocked.has(d.id)||p.queues[d.category].some(q=>q.type===d.id)||d.category==='structure'||d.category==='defense').filter(d=>superweapons||!['chronosphere','weather_control','iron_curtain','nuclear_silo'].includes(d.id));
  const signature=category+canSee.map(d=>`${d.id}:${game!.canBuild(0,d.id)}:${p.queues[d.category].map(q=>q.type+q.ready).join(',')}`).join('|');
  if(signature===buildSignature){document.querySelectorAll<HTMLElement>('[data-build]').forEach(el=>{const def=CATALOG[el.dataset.build!],first=p.queues[def.category][0],mask=el.querySelector<HTMLElement>('.progress-mask');if(mask&&first?.type===def.id)mask.style.setProperty('--progress',`${Math.round(first.progress*100)}%`);});return;}buildSignature=signature;
  $('#build-list').innerHTML=canSee.map(d=>{const q=p.queues[d.category],items=q.filter(v=>v.type===d.id),first=q[0]?.type===d.id?q[0]:undefined;const ready=items.some(v=>v.ready),can=game!.canBuild(0,d.id)||items.length>0;const url=cameoUrl(d.cameo,d.sprite);return `<button class="build-item ${can?'':'locked'} ${items.length?'queued':''}" data-build="${d.id}" aria-label="${escape(d.name)}，${d.cost} 资金${ready?'，就绪':''}" title="${escape(d.name)} — $${d.cost}\n${escape(d.description)}\n${escape(game!.getBuildReason(0,d.id))}">${url?`<img src="${url}" alt="${escape(d.name)}" draggable="false"/>`:`<div class="placeholder-cameo">${d.name.slice(0,2)}</div>`}<span class="cost">${d.cost}</span>${first&&!ready?`<span class="progress-mask" style="--progress:${Math.round(first.progress*100)}%"></span>`:''}${items.length>1?`<span class="queue-count">${items.length}</span>`:''}${ready?'<span class="ready-text">就 绪</span>':''}<span class="item-name">${escape(d.name)}</span></button>`;}).join('');
  if(!canSee.length)$('#build-list').innerHTML='<div class="empty-production"><strong>尚无生产设施</strong><p>先在建筑页建造对应的兵营、战车工厂或船坞。</p></div>';
  document.querySelectorAll<HTMLButtonElement>('[data-build]').forEach(el=>{
    const id=el.dataset.build!,d=CATALOG[id];
    el.onclick=()=>{const item=game!.players[0].queues[d.category].find(q=>q.type===id&&q.ready);if(item){clearTools();renderer!.placement=d;renderer!.tool='select';$('#battlefield').className='battlefield build-mode';notice(`选择 ${d.name} 的建造位置。右键取消。`);}else{if(!game!.build(0,id)){notice(game!.getBuildReason(0,id)||'当前无法生产。',true);}else sound.play(`${p.faction}_${d.kind==='building'?'building':d.category==='infantry'?'training':'unitready'}`);renderBuildList();}};
    el.oncontextmenu=e=>{e.preventDefault();game!.cancelBuild(0,d.category);renderBuildList();};
    el.onmouseenter=()=>{$('#build-detail').innerHTML=`<strong>${escape(d.name)} · $${d.cost}</strong><br>${escape(d.description)}`;translateUI($('#build-detail'));};
  });
  translateUI($('#build-list'));
}
function updateSelection(){
  if(!game||!renderer)return;const entities=game.entities.filter(e=>renderer!.selection.has(e.id)&&e.hp>0);
  $('#selection-label').textContent=entities.length===0?'没有选中单位':entities.length===1?`${getDefinition(entities[0].type).name} · ${Math.ceil(entities[0].hp)} / ${entities[0].maxHp}`:`已选择 ${entities.length} 支部队`;
  $('#selection-info').innerHTML=entities.slice(0,24).map(e=>`<div class="selected-card">${escape(getDefinition(e.type).name)}<i style="width:${Math.max(1,e.hp/e.maxHp*90)}%"></i></div>`).join('');
  translateUI($('#selection-info'));translateUI($('#selection-label'));
}
function updateUI(){
  if(!game||!renderer)return;const p=game.players[0];$('#money').textContent=Math.floor(p.credits).toLocaleString();
  $('#power-readout').textContent=`${p.powerConsumed} / ${p.powerProduced}`;$('#power-bar').classList.toggle('low',p.powerConsumed>p.powerProduced);$('#power-bar i').style.width=`${Math.min(100,p.powerProduced?100*p.powerConsumed/p.powerProduced:0)}%`;
  const mins=Math.floor(game.time/60),secs=Math.floor(game.time%60);$('#game-time').textContent=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  $('#battle-status').textContent=game.paused?'已暂停':p.powerConsumed>p.powerProduced?'电力不足':`剩余阵营 ${new Set(game.players.filter(v=>!v.defeated).map(v=>v.team)).size}`;
  const hasYard=game.entities.some(e=>e.owner===0&&e.type.includes('construction_yard')&&e.hp>0),hasRefinery=game.entities.some(e=>e.owner===0&&e.type.includes('refinery')&&e.hp>0);
  $('#hud-objective').innerHTML=!hasYard?'<strong>基地尚未部署</strong>　选中基地车，双击或按 D 展开。':selectedMap.specialMode==='megawealth'?'<strong>巨富地图</strong>　训练工程师，占领钻油井取得持续收入。':!hasRefinery?'<strong>发展基地</strong>　建造发电厂和矿石精炼厂，开始采矿。':`<strong>作战目标</strong>　${shortGame?'摧毁所有敌方建筑及基地车。':'消灭所有敌方建筑和部队。'}`;
  const events=game.events.filter(e=>e.id>lastEvent&&(e.owner===undefined||e.owner===0));for(const ev of events){notice(ev.text,ev.kind==='warning');if(ev.kind==='complete'){sound.play(`${p.faction}_${ev.text.includes('单位')||ev.text.includes('训练')?'unitready':'constructioncomplete'}`);lastComplete=ev.id;}}lastEvent=game.events.at(-1)?.id||lastEvent;
  notices=notices.filter(n=>n.until>performance.now());$('#hud-message').innerHTML=notices.slice(-3).map(n=>`<div class="notice ${n.warn?'warn':''}">${escape(n.text)}</div>`).join('');
  renderer.drawMinimap();updateSelection();renderBuildList();updateSupport();
   $<HTMLButtonElement>('#deploy').disabled=!game.entities.some(e=>renderer!.selection.has(e.id)&&(getDefinition(e.type).kind==='unit'||e.type.includes('construction_yard')));
  translateUI();
  if(game.status!=='playing'&&!shownResult){shownResult=true;showResult();}
}
function updateSupport(){
  if(!game)return;const p=game.players[0],owned=game.entities.filter(e=>e.owner===0&&e.hp>0),has=(id:string)=>owned.some(e=>e.type===id);
  const supports=game.getSupport(0);
  const signature=JSON.stringify(supports.map(a=>[a.id,a.ready,Math.ceil(a.remaining)]));if(signature===supportSignature)return;supportSignature=signature;
  $('#support-list').innerHTML=supports.map(a=>`<button data-support="${a.id}" ${a.ready?'':'disabled'}>${a.name}<small>${a.ready?'就绪':`${Math.ceil(a.remaining)}s`}</small></button>`).join('');document.querySelectorAll<HTMLButtonElement>('[data-support]').forEach(b=>b.onclick=()=>{clearTools();supportMode=b.dataset.support;renderer!.tool='support';renderer!.placement=undefined;notice('在战场上选择支援目标。');});
}
function frame(now:number){
  if(!playing||!game||!renderer)return;const dt=Math.min((now-lastTick)/1000,.08);lastTick=now;
  if(!modalOpen){game.step(dt);renderer.update(dt);playBattleSounds();}else renderer.draw();
  if(now-lastUI>220){updateUI();lastUI=now;}
  animation=requestAnimationFrame(frame);
}
function playBattleSounds(){
  if(!game||!renderer)return;
  for(const effect of game.effects){if(effect.id<=lastSoundEffect)continue;lastSoundEffect=effect.id;if(!game.visible(0,effect.x,effect.y))continue;const p=renderer.toScreen(effect.x,effect.y);if(p.x<0||p.x>renderer.width||p.y<0||p.y>renderer.height)continue;
    if(effect.kind==='shot')sound.playEvent(effect.weapon==='tesla'?'TeslaTankAttack':effect.weapon==='bullet'?'GIAttack':effect.weapon==='radiation'?'DesolatorAttack':'GrizzlyTankAttack');
    else if(effect.kind==='explosion')sound.playEvent('Explosion01');else if(effect.kind==='nuke')sound.playEvent('NukeExplosion');
  }
}
function notice(text:string,warn=false){notices.push({text,until:performance.now()+6500,warn});}
function toast(text:string){document.querySelector('.error-toast')?.remove();const el=document.createElement('div');el.className='error-toast';el.textContent=t(text);document.body.append(el);setTimeout(()=>el.remove(),5000);}
function showPause(){
  if(!game||shownResult)return;
  showModal('游戏暂停',`<div class="pause-items"><button id="resume" class="primary">返回战场</button><button id="pause-help">操作说明</button><button id="pause-music">${sound.musicEnabled?'关闭':'开启'}原版音乐</button><button id="pause-sound">${sound.enabled?'关闭':'开启'}游戏音效</button><button id="surrender">投降并结束战斗</button><button id="leave">退出到遭遇战设置</button></div>${sourceCodeLink()}${projectNotice()}`,'',true);
  $('#resume').onclick=closeModal;$('#pause-help').onclick=showHelp;$('#pause-music').onclick=()=>{sound.setMusic(!sound.musicEnabled);$('#pause-music').textContent=t(`${sound.musicEnabled?'关闭':'开启'}原版音乐`);};$('#pause-sound').onclick=()=>{sound.enabled=!sound.enabled;$('#pause-sound').textContent=t(`${sound.enabled?'关闭':'开启'}游戏音效`);};$('#surrender').onclick=()=>{closeModal();game!.surrender(0);updateUI();};$('#leave').onclick=()=>{closeModal();renderLobby();};
}
function showResult(){
  if(!game)return;const won=game.winnerTeam===game.players[0].team;sound.play(`${game.players[0].faction}_${won?'victorious':'defeated'}`);
  showModal('战斗报告',`<div class="result-title">${won?'MISSION ACCOMPLISHED':'MISSION FAILED'}</div><div class="result-subtitle">${won?'胜利':'战败'}</div><table class="score-table"><thead><tr><th>指挥官</th><th>国家</th><th>击杀</th><th>损失</th><th>建造</th></tr></thead><tbody>${game.players.map(p=>`<tr><td style="color:${p.color}">${escape(p.name)}</td><td>${countryById(p.country).name}</td><td>${p.kills}</td><td>${p.losses}</td><td>${p.buildingsBuilt}</td></tr>`).join('')}</tbody></table>`,`<button id="result-back" class="primary">返回遭遇战</button>`);$('#result-back').onclick=()=>{closeModal();renderLobby();};$('#modal-x').onclick=()=>{closeModal();renderLobby();};
}
window.addEventListener('keydown',e=>{
  const target=e.target as HTMLElement;if(['INPUT','SELECT','TEXTAREA'].includes(target.tagName))return;
  if(e.key==='Escape'){e.preventDefault();if(modalOpen){closeModal();if(shownResult)renderLobby();return;}if(renderer&&(renderer.placement||renderer.tool!=='select'||renderer.attackMove)){clearTools();return;}if(playing)showPause();return;}
  if(!playing||!game||!renderer||modalOpen)return;
  const key=e.key.toLowerCase();renderer.keys.add(key);
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','tab'].includes(key))e.preventDefault();
  if(e.repeat)return;
  if(key==='h')renderer.home();else if(key==='d')deploySelection();else if(key==='a'){clearTools();renderer.attackMove=true;renderer.placement=undefined;$('#battlefield').classList.add('attack-mode');notice('攻击移动：左键选择目的地。');}
  else if(key==='s'||key==='g')game.commandStop([...renderer.selection]);
  else if(key==='p')showPause();
  else if(key==='tab'){const tabs:ProductionCategory[]=['structure','defense','infantry','vehicle'];category=tabs[(tabs.indexOf(category)+1)%4];renderBuildList();}
  else if(/^[1-9]$/.test(key)){if(e.ctrlKey||e.metaKey){e.preventDefault();groups.set(key,[...renderer.selection]);notice(`编队 ${key} 已建立。`);}else renderer.setSelection((groups.get(key)||[]).filter(id=>game!.entities.some(v=>v.id===id&&v.hp>0)));}
});
window.addEventListener('keyup',e=>renderer?.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{renderer?.keys.clear();if(playing&&!modalOpen&&!shownResult)showPause();});
// Integration handle for deterministic browser verification and inspection.
Object.defineProperty(window,'ra2',{get:()=>({game,renderer,map:selectedMap,assets,slots})});
init().catch(error=>{if(error instanceof OriginalAssetsError || /素材|地图|资源/.test(error instanceof Error?error.message:String(error))){showAssetSetup(app,error instanceof Error?error.message:String(error));return;}console.error(error);app.innerHTML=`<div class="fatal"><h1>战场载入失败</h1><pre>${escape(error instanceof Error?error.message:String(error))}</pre><button onclick="location.reload()">重新载入</button></div>`;translateUI();});
