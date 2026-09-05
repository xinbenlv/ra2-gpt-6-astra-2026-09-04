import { APP_TITLE } from './project';
import { projectNotice } from './project-notice';
import { connectAssetStorage, originalsReady, SOURCE_BYTES, SOURCE_PAGE_URL, SOURCE_URL, type SetupProgress } from './browser-storage';
import { t, getLocale, localizeElement, languageControl, bindLanguageControl } from './i18n';
export class OriginalAssetsError extends Error { constructor(message:string){super(message);this.name='OriginalAssetsError';} }
export async function probeOriginalAssets():Promise<boolean>{await connectAssetStorage();return originalsReady();}
const escape=(value:string)=>value.replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]!));
const copy=(en:string,zh:string)=>getLocale()==='en'?en:zh;
const stages:Record<string,[string,string]>={
  download:['Downloading directly from Internet Archive','正在直接从 Internet Archive 下载'],
  verify:['Verifying the original archive','正在校验原版安装包'],
  'save-archive':['Saving the verified installer in this browser','正在将已校验的安装包保存到浏览器'],
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
  let worker:Worker|undefined,busy=false,last:SetupProgress|undefined,sourceFile:File|undefined;
  function render(){
    app.innerHTML=`<main class="asset-setup-screen"><section class="asset-setup-panel">
      <div class="setup-language">${languageControl()}</div><h1 class="app-title">${APP_TITLE}</h1>
      <p class="eyebrow">${copy('SKIRMISH · FIRST LAUNCH','遭遇战 · 首次启动')}</p>
      <h2>${copy('Bring the battlefield to your browser','将战场载入你的浏览器')}</h2>
      <p class="setup-copy">${copy('Download the original installer, or choose a copy you already have. Your browser unpacks the graphics, maps, voices and music, saves them locally, and starts the game automatically.','在线下载安装包，或选择你已下载的文件。浏览器会解包原版画面、地图、语音和音乐，保存到本机并自动启动游戏。')}</p>
      <p class="setup-copy">${copy('Future visits use your saved browser data, including offline. The Windows installer is never run.','下次直接读取浏览器缓存，支持离线游玩；不会运行 Windows 安装程序。')}</p>
      ${projectNotice()}${reason?`<p class="setup-reason">${escape(t(reason))}</p>`:''}
      <div class="setup-download">
        <a href="${SOURCE_PAGE_URL}" target="_blank" rel="noopener noreferrer">${copy('Direct from Internet Archive','直接从 Internet Archive 获取')}</a><strong>207 MB</strong>
        <small><a href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">${copy('Download Red-Alert-2-Multiplayer.exe manually','手动下载 Red-Alert-2-Multiplayer.exe')}</a></small>
        <small>${copy('Allow about 500 MB of browser storage and a few minutes for preparation.','请预留约 500 MB 浏览器存储空间；首次准备需要几分钟。')}</small>
      </div>
      <p class="setup-consent">${copy('“Agree & download” lets this browser download the installer directly from Internet Archive and store and unpack it locally. This website does not host, proxy or upload original game assets.','点击「同意并下载」，允许浏览器直接从 Internet Archive 下载、存储和解包安装包。本网站不托管、代理传输或上传原版游戏素材。')}</p>
      <button id="setup-download" class="primary" ${busy?'disabled':''}>${busy?copy('Preparing in your browser…','正在浏览器内准备…'):copy('Agree & download','同意并下载')}</button>
      <div class="setup-upload" id="setup-dropzone" aria-busy="${busy}">
        <h3>${copy('Already downloaded it?','已经下载好了？')}</h3>
        <p>${copy('Drop Red-Alert-2-Multiplayer.exe here, or choose the file below.','将 Red-Alert-2-Multiplayer.exe 拖入此处，或点击下方按钮选择文件。')}</p>
        <input id="setup-file" type="file" accept=".exe" hidden ${busy?'disabled':''}/>
        <button id="setup-choose-file" ${busy?'disabled':''}>${copy('Choose file & prepare','选择文件并准备')}</button>
        <p class="setup-file-note">${copy('Choosing or dropping a file allows this browser to verify, save and unpack it locally. Nothing is uploaded. Conversion tools may still download on first use.','选择或拖入文件，即允许浏览器在本机校验、保存和解包。文件不会上传；首次使用仍可能需要下载转换工具。')}</p>
        ${sourceFile?`<p class="setup-selected-file">${copy('Selected: ','已选择：')}${escape(sourceFile.name)}</p>`:''}
      </div>
      <p id="setup-status" role="status" aria-live="polite">${busy?copy('Preparing in your browser…','正在浏览器内准备…'):copy('Nothing is downloaded until you agree or choose a file.','同意下载或选择文件前，不会下载任何素材。')}</p>
      <progress id="setup-progress" max="100" value="0" hidden></progress><pre id="setup-error" role="alert" hidden></pre>
      ${last?.type==='error'&&!last.errorCode&&last.stage!=='selection'?`<button id="setup-retry">${copy('Retry preparation','重试准备')}</button>`:''}
      <div class="setup-manual"><p>${copy('Saved for this browser and website. Clearing site data removes the cache. Your browser may ask to keep storage persistent.','缓存保存在当前浏览器、当前网站下；清除网站数据会删除缓存。浏览器可能会询问是否允许持久保存。')}</p><button id="setup-recheck" ${busy?'disabled':''}>${copy('Check saved assets','检查已有缓存')}</button></div>
    </section></main>`;
    localizeElement(app);
    bindLanguageControl(app,render);
    app.querySelector<HTMLButtonElement>('#setup-download')!.onclick=()=>void start();
    const input=app.querySelector<HTMLInputElement>('#setup-file')!;
    app.querySelector<HTMLButtonElement>('#setup-choose-file')!.onclick=()=>input.click();
    input.onchange=()=>{if(input.files?.length)chooseFiles(Array.from(input.files));};
    app.querySelector<HTMLButtonElement>('#setup-retry')?.addEventListener('click',()=>void start(sourceFile));
    app.querySelector<HTMLButtonElement>('#setup-recheck')!.onclick=async()=>{if(await originalsReady())location.reload();else app.querySelector('#setup-status')!.textContent=copy('No complete asset cache found. Download or choose the installer above.','没有找到完整素材缓存，请在线下载或选择安装包。');};
    const dropzone=app.querySelector<HTMLElement>('#setup-dropzone')!;
    app.ondragover=event=>{
      if(!Array.from(event.dataTransfer?.types??[]).includes('Files'))return;
      event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect=busy?'none':'copy';
      if(!busy)dropzone.classList.add('drag-over');
    };
    app.ondragleave=event=>{if(!event.relatedTarget||!app.contains(event.relatedTarget as Node))dropzone.classList.remove('drag-over');};
    app.ondrop=event=>{
      if(!Array.from(event.dataTransfer?.types??[]).includes('Files'))return;
      event.preventDefault();dropzone.classList.remove('drag-over');
      if(!busy)chooseFiles(Array.from(event.dataTransfer?.files??[]));
    };
    if(last)renderProgress(last);
  }
  function chooseFiles(files:File[]){
    if(busy)return;
    if(files.length!==1){last=undefined;sourceFile=undefined;showProgress({type:'error',stage:'selection',message:copy('Choose one installer file at a time.','请一次选择一个安装包文件。')});return;}
    void start(files[0]);
  }
  function renderProgress(data:SetupProgress){
    const status=app.querySelector('#setup-status')!,progress=app.querySelector<HTMLProgressElement>('#setup-progress')!;
    if(data.type==='error'){
      const error=app.querySelector<HTMLElement>('#setup-error')!;error.hidden=false;
      error.textContent=data.errorCode==='archive-size'
        ?copy('Choose the complete Red-Alert-2-Multiplayer.exe from the linked Internet Archive item (206,530,229 bytes).','请选择上方 Internet Archive 链接中的完整 Red-Alert-2-Multiplayer.exe（206,530,229 字节）。')
        :data.errorCode==='archive-hash'
        ?copy('This file does not match the expected installer. Download Red-Alert-2-Multiplayer.exe from the link above and try again.','此文件与预期安装包不一致。请通过上方链接下载 Red-Alert-2-Multiplayer.exe 后重试。')
        :data.message||copy('Preparation failed. Please retry.','准备失败，请重试。');
      status.textContent=copy('Preparation stopped. Choose another file or retry. Verified cached installers are kept.','准备已停止。请选择其他文件或重试；已校验的安装包缓存会保留。');
      progress.hidden=true;return;
    }
    const label=stages[data.stage]||[data.stage,data.stage];status.textContent=label[getLocale()==='en'?0:1]+(data.message?' · '+data.message:'');progress.hidden=false;progress.value=data.percent||0;
  }
  function showProgress(data:SetupProgress){
    last=data;
    if(data.type==='error'){busy=false;worker?.terminate();worker=undefined;render();return;}
    if(data.type==='complete'){worker?.terminate();app.querySelector('#setup-status')!.textContent=copy('Ready. Starting Red Alert 2…','准备完成，正在启动红色警戒 2…');location.reload();return;}
    renderProgress(data);
  }
  async function start(file?:File){
    if(busy)return;
    sourceFile=file;
    if(file&&file.size!==SOURCE_BYTES){showProgress({type:'error',stage:'error',errorCode:'archive-size'});return;}
    busy=true;last=undefined;render();
    try{
      await connectAssetStorage();
      const estimate=await navigator.storage?.estimate();
      if(estimate?.quota && estimate.quota-(estimate.usage||0)<500*1024*1024)throw new Error(copy('Please free at least 500 MB of browser storage, then retry.','请释放至少 500 MB 浏览器存储空间后重试。'));
      // Request persistence only as a consequence of this explicit user action.
      await navigator.storage?.persist?.().catch(()=>false);
      worker=new Worker(new URL('./asset-worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=event=>showProgress(event.data as SetupProgress);
      worker.onerror=event=>showProgress({type:'error',stage:'error',message:event.message});
      worker.postMessage({type:'install',file});
    }catch(error){showProgress({type:'error',stage:'error',message:error instanceof Error?error.message:String(error)});}
  }
  render();
}
