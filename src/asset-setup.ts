import { connectAssetStorage, localOriginalsAvailable, originalsReady, type SetupProgress } from './browser-storage';
import { t, getLocale, languageControl, bindLanguageControl } from './i18n';
export class OriginalAssetsError extends Error { constructor(message:string){super(message);this.name='OriginalAssetsError';} }
export async function probeOriginalAssets():Promise<boolean>{
  if (await localOriginalsAvailable()) {
    // Update an older cache-only worker before it can hide the local files.
    if (navigator.serviceWorker?.controller) await connectAssetStorage();
    return true;
  }
  await connectAssetStorage();return originalsReady();
}
const escape=(value:string)=>value.replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]!));
const copy=(en:string,zh:string)=>getLocale()==='en'?en:zh;
const stages:Record<string,[string,string]>={
  download:['Downloading directly from Internet Archive','正在直接从 Internet Archive 下载'],
  verify:['Verifying the original archive','正在校验原版安装包'],
  runtime:['Loading browser conversion tools','正在加载浏览器转换工具'],
  extract:['Unpacking originals in your browser','正在浏览器内解包原版素材'],
  maps:['Reading original skirmish maps','正在读取原版遭遇战地图'],
  sprites:['Preparing buildings and unit images','正在转换建筑和单位图像'],
  voxels:['Rendering vehicles, ships and aircraft','正在转换车辆、舰船和飞机'],
  audio:['Decoding original speech, sounds and music','正在解码原版语音、音效和音乐'],
  infantry:['Preparing infantry animations','正在转换步兵动画'],
  overlays:['Preparing ore, bridges and walls','正在转换矿石、桥梁和围墙'],
  sidebar:['Preparing the original interface','正在转换原版界面'],
  terrain:['Preparing snow, temperate and urban terrain','正在转换雪地、温带和城市地形'],
  scenery:['Preparing map scenery','正在转换地图场景'],
  previews:['Decoding original map previews','正在解码原版地图预览'],
  storage:['Saving assets in this browser','正在存入本机浏览器缓存'],
};

export function showAssetSetup(app:HTMLElement,reason?:string):void {
  let worker:Worker|undefined,busy=false,last:SetupProgress|undefined;
  function render(){
    app.innerHTML=`<main class="asset-setup-screen"><section class="asset-setup-panel"><div class="setup-language">${languageControl()}</div><div class="setup-brand"><small>COMMAND &amp; CONQUER</small>RED ALERT <b>2</b></div><p class="eyebrow">${copy('SKIRMISH · FIRST LAUNCH','遭遇战 · 首次启动')}</p><h1>${copy('Bring the battlefield to your browser','将战场载入你的浏览器')}</h1><p class="setup-copy">${copy('One download. Original graphics, maps, voices and music. Your browser unpacks the original archive and saves the assets locally, then starts the game automatically.','下载一次，即可使用原版画面、地图、语音和音乐。浏览器会自动解包、保存到本机，并启动游戏。')}</p><p class="setup-copy">${copy('Future visits use your saved browser data, including offline. No installer or command line is needed.','下次直接读取浏览器缓存，支持离线游玩；无需运行安装程序或命令行。')}</p>${reason?`<p class="setup-reason">${escape(t(reason))}</p>`:''}<div class="setup-download"><span>${copy('Direct from Internet Archive','直接从 Internet Archive 获取')}</span><strong>207 MB</strong><small>${copy('Allow about 500 MB of browser storage and a few minutes for preparation.','请预留约 500 MB 浏览器存储空间；首次准备需要几分钟。')}</small></div><p class="setup-consent">${copy('By choosing “Agree & download”, you authorize this browser to download the original archive directly from Internet Archive, unpack it locally and keep the resulting assets in your browser storage. This website does not host, proxy or upload original game assets.','点击「同意并下载」，表示你允许此浏览器直接从 Internet Archive 下载原版资源包，在本机解包并保存在浏览器存储中。本网站不托管、代理传输或上传原版游戏素材。')}</p><button id="setup-download" class="primary" ${busy?'disabled':''}>${busy?copy('Preparing in your browser…','正在浏览器内准备…'):copy('Agree & download','同意并下载')}</button><p id="setup-status" role="status" aria-live="polite">${copy('Nothing is downloaded until you agree.','在你同意之前，不会下载原版素材。')}</p><progress id="setup-progress" max="100" value="0" ${busy?'':'hidden'}></progress><pre id="setup-error" hidden></pre><div class="setup-manual"><p>${copy('Saved for this browser and website. Clearing site data removes the cache. Your browser may ask to keep storage persistent.','缓存保存在当前浏览器、当前网站下；清除网站数据会删除缓存。浏览器可能会询问是否允许持久保存。')}</p><button id="setup-recheck">${copy('Check saved assets','检查已有缓存')}</button></div></section></main>`;
    bindLanguageControl(app,render);
    app.querySelector<HTMLButtonElement>('#setup-download')!.onclick=()=>void start();
    app.querySelector<HTMLButtonElement>('#setup-recheck')!.onclick=async()=>{if(await originalsReady())location.reload();else app.querySelector('#setup-status')!.textContent=copy('No complete asset cache found. Agree above to prepare it.','没有找到完整素材缓存，请同意下载后准备。');};
    if(last)showProgress(last);
  }
  function showProgress(data:SetupProgress){
    last=data;const status=app.querySelector('#setup-status')!,progress=app.querySelector<HTMLProgressElement>('#setup-progress')!;
    if(data.type==='error'){
      busy=false;worker?.terminate();worker=undefined;
      const error=app.querySelector<HTMLElement>('#setup-error')!;error.hidden=false;error.textContent=data.message||copy('Preparation failed. Please retry.','准备失败，请重试。');
      status.textContent=copy('The verified download is kept when possible. Retry to continue.','已校验的安装包会尽量保留，重试即可继续。');
      const button=app.querySelector<HTMLButtonElement>('#setup-download')!;button.disabled=false;button.textContent=copy('Retry preparation','重试准备');progress.hidden=true;return;
    }
    if(data.type==='complete'){worker?.terminate();status.textContent=copy('Ready. Starting Red Alert 2…','准备完成，正在启动红色警戒 2…');location.reload();return;}
    const label=stages[data.stage]||[data.stage,data.stage];status.textContent=label[getLocale()==='en'?0:1]+(data.message?' · '+data.message:'');progress.hidden=false;progress.value=data.percent||0;
  }
  async function start(){
    if(busy)return;busy=true;last=undefined;render();
    try{
      await connectAssetStorage();
      const estimate=await navigator.storage?.estimate();
      if(estimate?.quota && estimate.quota-(estimate.usage||0)<500*1024*1024)throw new Error(copy('Please free at least 500 MB of browser storage, then retry.','请释放至少 500 MB 浏览器存储空间后重试。'));
      // Request persistence only as a consequence of this explicit user action.
      await navigator.storage?.persist?.().catch(()=>false);
      worker=new Worker(new URL('./asset-worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=event=>showProgress(event.data as SetupProgress);
      worker.onerror=event=>showProgress({type:'error',stage:'error',message:event.message});
      worker.postMessage({type:'install'});
    }catch(error){showProgress({type:'error',stage:'error',message:error instanceof Error?error.message:String(error)});}
  }
  render();
}
