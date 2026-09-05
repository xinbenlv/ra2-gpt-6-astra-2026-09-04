import './map-editor.css';
import { bindLanguageControl, languageControl, localizeElement, registerTranslations, t } from './i18n';
import { createCustomMap, parseCustomMap, parseCustomMapDraft, serializeCustomMap, validateCustomMap, CUSTOM_MAP_EXTENSION, MAX_CUSTOM_MAP_BYTES, TERRAIN_COLORS, type CustomMapDocument } from './custom-maps';
import type { Terrain } from './maps';

registerTranslations({
  '地图编辑器': 'Map Editor', '战场制图室': 'BATTLEFIELD CARTOGRAPHY',
  '绘制地形、部署出生点，把你的战场分享给其他指挥官。': 'Shape the terrain, place starting positions, and share your battlefield.',
  '下载地图': 'Download Map', '用于遭遇战': 'Use in Skirmish', '导入地图文件': 'Import Map File',
  '绘制工具': 'Terrain Tools', '地面': 'Ground', '水域': 'Water', '矿石': 'Ore', '宝石': 'Gems', '悬崖': 'Cliff', '道路': 'Road', '雪地': 'Snow',
  '笔刷大小': 'Brush Size', '起始位置': 'Starting Positions', '出生点': 'Start', '选择出生点后，点击地图移动。': 'Select a start, then click the map to move it.',
  '地图信息': 'Map Details', '地图名称': 'Map Name', '地形': 'Terrain', '地图尺寸': 'Map Dimensions',
  '格': 'cells', '新建地图': 'New Map', '新地图模板': 'New Map Template', '地图大小': 'Map Size', '玩家数量': 'Player Count',
  '新模板会在各出生点附近放置矿区，并保留建造空地。': 'Templates include ore near each start and open ground for building.',
  '创建新地图': 'Create New Map', '替换当前地图？': 'Replace the current map?',
  '替换后可以点击撤销，回到当前地图。': 'After replacing, use Undo to return to your current map.', '确认替换': 'Replace Map',
  '撤销': 'Undo', '重做': 'Redo', '缩小': 'Zoom Out', '放大': 'Zoom In', '适应窗口': 'Fit Map',
  '地图绘图区': 'Map Drawing Area', '坐标': 'Cell', '在地图上移动指针开始绘制': 'Move over the map to begin drawing',
  '拖动绘制 · 方向键移动光标 · 空格绘制 · Ctrl/⌘ Z 撤销': 'Drag to paint · Arrow keys move cursor · Space paints · Ctrl/⌘ Z undoes',
  '出生点周围需要平坦空地；水域和悬崖会阻挡地面单位。': 'Keep flat ground around starting positions. Water and cliffs block ground units.',
  '地图检查': 'Map Check', '地图已就绪，可以下载或用于遭遇战。': 'Map ready to download or use in a skirmish.',
  '请先修复以下问题：': 'Resolve these issues first:', '已保存本地草稿': 'Draft saved on this device',
  '已恢复本地草稿': 'Local draft restored', '正在保存草稿…': 'Saving draft…',
  '无法保存本地草稿，请及时下载地图。': 'Draft storage is unavailable. Download your map to keep it.',
  '本地草稿无法读取，已保留原始数据；请导入备份地图。': 'The local draft could not be read. Its stored data has been preserved; import a backup map.',
  '地图已下载，可以把文件分享给其他玩家。': 'Map downloaded. Share the file with other players.',
  '地图已导入，可继续编辑。': 'Map imported and ready to edit.', '已创建新地图。': 'New map created.',
  '无法读取地图文件。': 'Unable to read the map file.', '地图文件超过 2 MB。': 'Map file exceeds 2 MB.',
  '只支持 .ra2map 地图文件。': 'Choose a .ra2map map file.', '地图文件': 'Map file',
  '分享方法': 'Share Your Battlefield',
  '下载 .ra2map 文件并发送给朋友。对方在遭遇战的地图选择中上传，即可使用同一张地图。': 'Download the .ra2map file and send it to a friend. They can upload it in the skirmish map selector and play the same battlefield.',
  '草稿仅保存在当前浏览器。下载文件才能跨设备保存和分享。': 'Drafts stay in this browser. Download a file to save or share across devices.',
  '显示网格': 'Show Grid', '绘制': 'Paint', '移动出生点': 'Move Start', '读取地图中…': 'Reading map…',
  '未命名地图': 'Untitled Map',
  '地图内容必须是一个 JSON 对象。': 'Map contents must be a JSON object.',
  '地图包含不支持的字段，请使用本编辑器导出的 .ra2map 文件。': 'The map contains unsupported fields. Use a .ra2map file exported by this editor.',
  '地图格式不正确，应为 ra2-web-map；请上传 .ra2map 文件。': 'The map format must be ra2-web-map. Upload a .ra2map file.',
  '不支持此地图版本，目前只支持版本 1。': 'Unsupported map version. Only version 1 is supported.',
  '地图名称需要 1–60 个字符，且不能包含换行或控制字符。': 'Use a map name of 1–60 characters without line breaks or control characters.',
  '地图宽度必须是 24–96 之间的整数。': 'Map width must be a whole number from 24 to 96.',
  '地图高度必须是 24–96 之间的整数。': 'Map height must be a whole number from 24 to 96.',
  '战区必须为 temperate（温带）、snow（雪地）或 urban（城市）。': 'The theater must be temperate, snow, or urban.',
  '地形 cells 必须是数组。': 'Terrain cells must be an array.',
  '地形数量必须为 ': 'Terrain cell count must be ', '，与地图宽度 × 高度一致。': ', matching map width × height.',
  '第 ': 'Cell ', ' 个地块无效，只支持陆地、水域、矿石、宝石、悬崖、道路和雪地。': ' is invalid. Supported terrain: ground, water, ore, gems, cliffs, roads, and snow.',
  '地图需要 2–8 个玩家起点。': 'A map needs 2–8 starting positions.',
  '请读取并上传 .ra2map 文本文件。': 'Upload a .ra2map text file.',
  '地图文件不能超过 2 MB。': 'Map files cannot exceed 2 MB.',
  '地图文件不是有效的 JSON，请重新下载 .ra2map 文件后上传。': 'The map is not valid JSON. Download the .ra2map file again and upload it.',
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => i + 1).flatMap(i => [
    [`起点 ${i} 必须只包含整数坐标 x 和 y。`, `Start ${i} must contain only whole-number x and y coordinates.`],
    [`起点 ${i} 的坐标必须位于地图内。`, `Start ${i} must be inside the map.`],
    [`起点 ${i} 必须在地图内，并距边缘至少 2 格，为基地预留空间。`, `Start ${i} needs at least 2 cells of space from each map edge for its base.`],
    [`起点 ${i} 周围的 5×5 区域必须为陆地、雪地或道路，请移除水域、悬崖和矿产以部署基地。`, `The 5×5 area around start ${i} must be ground, snow, or road. Clear water, cliffs, and resources so a base can deploy.`],
    ...Array.from({ length: 8 }, (_, j) => [`起点 ${i} 与起点 ${j + 1} 太近，两者至少需要相距 8 格。`, `Starts ${i} and ${j + 1} are too close. Keep them at least 8 cells apart.`]),
  ])),
});

const DRAFT_KEY = 'ra2-map-editor-draft-v1';
const HISTORY_LIMIT = 60;
const PAINT_TERRAINS: { terrain: Terrain; label: string; symbol: string }[] = [
  { terrain: 'land', label: '地面', symbol: '▰' }, { terrain: 'water', label: '水域', symbol: '≈' },
  { terrain: 'ore', label: '矿石', symbol: '◆' }, { terrain: 'gem', label: '宝石', symbol: '✦' },
  { terrain: 'cliff', label: '悬崖', symbol: '▲' }, { terrain: 'road', label: '道路', symbol: '═' },
  { terrain: 'snow', label: '雪地', symbol: '❄' },
];
const SPAWN_COLORS = ['#f0d372', '#ee775d', '#78b9ff', '#8dce85', '#e5a76b', '#c3a1f1', '#76d4cd', '#eda5c4'];
const clone = (value: CustomMapDocument): CustomMapDocument => ({ ...value, cells: [...value.cells], spawns: value.spawns.map(point => ({ ...point })) });
type Point = { x: number; y: number };

export function mountMapEditor(container: HTMLElement, options: { onBack: () => void; onUse: (doc: CustomMapDocument) => void }): () => void {
  const screen = document.createElement('section');
  screen.className = 'map-editor';
  screen.innerHTML = `<header class="editor-header">
    <div class="editor-heading"><button type="button" class="editor-back" data-action="back">← 返回遭遇战</button><p class="editor-eyebrow">战场制图室</p><h1>地图编辑器</h1><p class="editor-intro">绘制地形、部署出生点，把你的战场分享给其他指挥官。</p></div>
    <div class="editor-header-actions"><div class="editor-language">${languageControl()}</div><button type="button" data-action="import">导入地图文件</button><button type="button" data-action="download">↓ 下载地图</button><button type="button" class="primary" data-action="use">用于遭遇战 ▸</button></div>
  </header>
  <div class="editor-message" data-message role="status" hidden></div>
  <div class="editor-confirm" data-confirm hidden><div><strong>替换当前地图？</strong><p>替换后可以点击撤销，回到当前地图。</p><p data-replacement></p></div><button type="button" class="primary" data-action="confirm">确认替换</button><button type="button" data-action="cancel">取消</button></div>
  <div class="editor-workspace">
    <aside class="editor-tools editor-panel" aria-label="绘制工具"><h2><span>01</span> 绘制工具</h2>
      <div class="editor-palette" role="group" aria-label="地形">${PAINT_TERRAINS.map(item => `<button type="button" data-terrain="${item.terrain}" aria-pressed="${item.terrain === 'land'}"><i class="editor-swatch" style="--swatch:${TERRAIN_COLORS[item.terrain]}">${item.symbol}</i><span>${item.label}</span></button>`).join('')}</div>
      <fieldset class="editor-brush"><legend>笔刷大小</legend><div>${[1, 3, 5].map(size => `<button type="button" data-brush="${size}" aria-pressed="${size === 1}" aria-label="${size} × ${size}">${size} × ${size}</button>`).join('')}</div></fieldset>
      <div class="editor-spawn-tools"><h2><span>02</span> 起始位置</h2><div data-spawns class="editor-spawns" role="group" aria-label="起始位置"></div><p>选择出生点后，点击地图移动。</p></div>
      <p class="editor-terrain-note">出生点周围需要平坦空地；水域和悬崖会阻挡地面单位。</p>
    </aside>
    <main class="editor-drawing editor-panel"><div class="editor-drawing-toolbar"><div class="editor-history"><button type="button" data-action="undo" title="撤销 (Ctrl/⌘ Z)">↶ <span>撤销</span></button><button type="button" data-action="redo" title="重做 (Ctrl/⌘ Shift Z)">↷ <span>重做</span></button></div><div class="editor-view-tools"><label><input type="checkbox" data-grid checked>显示网格</label><button type="button" data-action="zoom-out" aria-label="缩小">−</button><button type="button" data-action="fit">适应窗口</button><button type="button" data-action="zoom-in" aria-label="放大">+</button></div></div>
      <div class="editor-canvas-scroll" data-canvas-scroll><div class="editor-canvas-mat"><canvas data-editor-canvas tabindex="0" aria-label="地图绘图区" aria-describedby="editor-canvas-help">地图绘图区</canvas></div></div>
      <div class="editor-coordinate-bar"><span data-coordinates>在地图上移动指针开始绘制</span><span data-tool-status></span></div>
      <p class="editor-canvas-help" id="editor-canvas-help">拖动绘制 · 方向键移动光标 · 空格绘制 · Ctrl/⌘ Z 撤销</p>
    </main>
    <aside class="editor-inspector editor-panel"><h2><span>03</span> 地图信息</h2>
      <label class="editor-field"><span>地图名称</span><input type="text" data-name maxlength="60" autocomplete="off" spellcheck="false"></label>
      <dl class="editor-facts"><div><dt>地图尺寸</dt><dd data-size></dd></div><div><dt>作战地形</dt><dd data-theater></dd></div><div><dt>玩家数量</dt><dd data-players></dd></div></dl>
      <div class="editor-validation" data-validation><h3>地图检查</h3><p data-validation-summary></p><ul data-errors></ul></div>
      <details class="editor-template"><summary>新地图模板</summary><div class="editor-template-fields"><label class="editor-field"><span>地图大小</span><select data-new-size>${[32, 48, 64, 96].map(size => `<option value="${size}" ${size === 48 ? 'selected' : ''}>${size} × ${size}</option>`).join('')}</select></label><label class="editor-field"><span>作战地形</span><select data-new-theater><option value="temperate">温带</option><option value="snow">雪地</option><option value="urban">城市</option></select></label><label class="editor-field"><span>玩家数量</span><select data-new-players>${[2, 3, 4, 5, 6, 7, 8].map(players => `<option value="${players}">${players}</option>`).join('')}</select></label><p>新模板会在各出生点附近放置矿区，并保留建造空地。</p><button type="button" data-action="new">创建新地图</button></div></details>
      <div class="editor-share-note"><h3>分享方法</h3><p>下载 .ra2map 文件并发送给朋友。对方在遭遇战的地图选择中上传，即可使用同一张地图。</p><code>.ra2map</code></div>
    </aside>
  </div><footer class="editor-footer"><span class="editor-draft-status" data-draft-status role="status"></span><span>草稿仅保存在当前浏览器。下载文件才能跨设备保存和分享。</span></footer><input type="file" accept=".ra2map,application/json" data-file hidden>`;
  container.append(screen);

  const find = <T extends HTMLElement>(selector: string) => screen.querySelector<T>(selector)!;
  const canvas = find<HTMLCanvasElement>('[data-editor-canvas]');
  const context = canvas.getContext('2d')!;
  const scroll = find<HTMLDivElement>('[data-canvas-scroll]');
  const nameInput = find<HTMLInputElement>('[data-name]');
  const fileInput = find<HTMLInputElement>('[data-file]');
  const draftStatus = find<HTMLSpanElement>('[data-draft-status]');
  const errorList = find<HTMLUListElement>('[data-errors]');
  const controller = new AbortController();
  const signal = controller.signal;
  let doc = createCustomMap();
  doc.name = t(doc.name);
  let storageBlocked = false;
  let draftMessage = '已保存本地草稿';
  // Drafts may temporarily fail gameplay validation while being edited. Validate
  // their bounded shape before restoring, without discarding unfinished work.
  let savedDraft: string | null = null;
  try { savedDraft = localStorage.getItem(DRAFT_KEY); }
  catch {
    storageBlocked = true;
    draftMessage = '无法保存本地草稿，请及时下载地图。';
  }
  if (savedDraft) {
    try { doc = parseCustomMapDraft(savedDraft); draftMessage = '已恢复本地草稿'; }
    catch {
      storageBlocked = true;
      draftMessage = '本地草稿无法读取，已保留原始数据；请导入备份地图。';
    }
  }
  let undoStack: CustomMapDocument[] = [];
  let redoStack: CustomMapDocument[] = [];
  let tool: Terrain | 'spawn' = 'land';
  let brushSize = 1;
  let selectedSpawn = 0;
  let hover: Point | null = null;
  let cursor: Point = { x: 0, y: 0 };
  let activePointer: number | null = null;
  let strokeBefore: CustomMapDocument | null = null;
  let previousPoint: Point | null = null;
  let nameBefore: CustomMapDocument | null = null;
  let pending: { doc: CustomMapDocument; message: string } | null = null;
  let zoom = 1;
  let cellSize = 8;
  let showGrid = true;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let readingFile = false;
  const downloadUrls = new Set<string>();

  function announce(message: string, error = false): void {
    const el = find<HTMLDivElement>('[data-message]');
    el.hidden = false;
    el.classList.toggle('is-error', error);
    el.textContent = message;
    localizeElement(el);
  }
  function updateDraftStatus(): void {
    draftStatus.textContent = draftMessage;
    draftStatus.classList.toggle('is-warning', storageBlocked);
    localizeElement(draftStatus);
  }
  function saveDraft(): void {
    clearTimeout(saveTimer);
    // A corrupt pre-existing draft is not silently overwritten by opening the editor.
    if (storageBlocked) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(doc)); draftMessage = '已保存本地草稿'; }
    catch { draftMessage = '无法保存本地草稿，请及时下载地图。'; storageBlocked = true; }
    updateDraftStatus();
  }
  function scheduleSave(): void {
    if (storageBlocked) return;
    draftMessage = '正在保存草稿…';
    updateDraftStatus();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 250);
  }
  function remember(before: CustomMapDocument): void {
    undoStack.push(before);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
  }
  function finishName(): void {
    if (nameBefore && nameBefore.name !== doc.name) remember(nameBefore);
    nameBefore = null;
    updateHistory();
  }
  function updateHistory(): void {
    find<HTMLButtonElement>('[data-action="undo"]').disabled = undoStack.length === 0;
    find<HTMLButtonElement>('[data-action="redo"]').disabled = redoStack.length === 0;
  }
  function updateValidation(): void {
    const errors = validateCustomMap(doc);
    find('[data-validation]').classList.toggle('is-invalid', errors.length > 0);
    find('[data-validation-summary]').textContent = errors.length ? '请先修复以下问题：' : '地图已就绪，可以下载或用于遭遇战。';
    errorList.replaceChildren(...errors.map(error => { const li = document.createElement('li'); li.textContent = error; return li; }));
    errorList.hidden = errors.length === 0;
    find<HTMLButtonElement>('[data-action="download"]').disabled = errors.length > 0;
    find<HTMLButtonElement>('[data-action="use"]').disabled = errors.length > 0;
    localizeElement(find('[data-validation]'));
  }
  function updateTools(): void {
    screen.querySelectorAll<HTMLButtonElement>('[data-terrain]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.terrain === tool)));
    screen.querySelectorAll<HTMLButtonElement>('[data-brush]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.brush) === brushSize)));
    screen.querySelectorAll<HTMLButtonElement>('[data-spawn]').forEach(button => button.setAttribute('aria-pressed', String(tool === 'spawn' && Number(button.dataset.spawn) === selectedSpawn)));
    find('[data-tool-status]').textContent = tool === 'spawn' ? `移动出生点 ${selectedSpawn + 1}` : `${PAINT_TERRAINS.find(item => item.terrain === tool)!.label} · ${brushSize} × ${brushSize}`;
    localizeElement(find('[data-tool-status]'));
    draw();
  }
  function syncDocument(): void {
    nameInput.value = doc.name;
    selectedSpawn = Math.min(selectedSpawn, doc.spawns.length - 1);
    find('[data-size]').textContent = `${doc.width} × ${doc.height}`;
    find('[data-theater]').textContent = { temperate: '温带', snow: '雪地', urban: '城市' }[doc.theater];
    find('[data-players]').textContent = String(doc.spawns.length);
    find('[data-spawns]').replaceChildren(...doc.spawns.map((_, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.spawn = String(index);
      button.style.setProperty('--spawn-color', SPAWN_COLORS[index]);
      button.textContent = String(index + 1); button.setAttribute('aria-label', `出生点 ${index + 1}`);
      return button;
    }));
    cursor = { x: Math.min(cursor.x, doc.width - 1), y: Math.min(cursor.y, doc.height - 1) };
    hover = null;
    updateHistory(); updateValidation(); updateTools(); resizeCanvas(); localizeElement(screen);
  }
  function coordinates(point: Point | null): void {
    find('[data-coordinates]').textContent = point ? `${t('坐标')} ${String(point.x + 1).padStart(2, '0')}, ${String(point.y + 1).padStart(2, '0')}` : t('在地图上移动指针开始绘制');
  }
  function resizeCanvas(): void {
    if (disposed) return;
    const availableWidth = Math.max(120, scroll.clientWidth - 36);
    const availableHeight = Math.max(120, scroll.clientHeight - 36);
    cellSize = Math.max(3, Math.min(availableWidth / doc.width, availableHeight / doc.height)) * zoom;
    const width = Math.round(doc.width * cellSize), height = Math.round(doc.height * cellSize);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    context.setTransform(canvas.width / (doc.width * cellSize), 0, 0, canvas.height / (doc.height * cellSize), 0, 0);
    draw();
  }
  function draw(): void {
    if (disposed) return;
    const width = doc.width * cellSize, height = doc.height * cellSize;
    context.clearRect(0, 0, width, height);
    for (let y = 0; y < doc.height; y++) for (let x = 0; x < doc.width; x++) {
      const terrain = doc.cells[y * doc.width + x];
      context.fillStyle = TERRAIN_COLORS[terrain];
      context.fillRect(x * cellSize, y * cellSize, cellSize + .5, cellSize + .5);
      if ((terrain === 'ore' || terrain === 'gem') && cellSize >= 5) {
        context.fillStyle = terrain === 'ore' ? '#f7da8b' : '#e0b0eb';
        context.fillRect((x + .34) * cellSize, (y + .34) * cellSize, cellSize * .32, cellSize * .32);
      }
      if (terrain === 'water' && cellSize >= 7 && (x + y) % 3 === 0) {
        context.fillStyle = '#7eb6bd44'; context.fillRect((x + .18) * cellSize, (y + .5) * cellSize, cellSize * .55, 1);
      }
    }
    if (showGrid && cellSize >= 5) {
      context.lineWidth = .6;
      for (let x = 0; x <= doc.width; x++) { context.strokeStyle = x % 8 === 0 ? '#050e0f66' : '#050e0f24'; context.beginPath(); context.moveTo(x * cellSize, 0); context.lineTo(x * cellSize, height); context.stroke(); }
      for (let y = 0; y <= doc.height; y++) { context.strokeStyle = y % 8 === 0 ? '#050e0f66' : '#050e0f24'; context.beginPath(); context.moveTo(0, y * cellSize); context.lineTo(width, y * cellSize); context.stroke(); }
    }
    doc.spawns.forEach((point, index) => {
      const x = (point.x + .5) * cellSize, y = (point.y + .5) * cellSize;
      const selected = tool === 'spawn' && selectedSpawn === index;
      context.save();
      context.strokeStyle = SPAWN_COLORS[index]; context.lineWidth = selected ? 2 : 1; context.setLineDash([4, 3]);
      context.strokeRect((point.x - 2) * cellSize, (point.y - 2) * cellSize, cellSize * 5, cellSize * 5);
      context.setLineDash([]); context.fillStyle = '#101612e8'; context.beginPath();
      context.arc(x, y, Math.max(9, Math.min(cellSize * 1.1, 16)), 0, Math.PI * 2); context.fill(); context.stroke();
      context.fillStyle = SPAWN_COLORS[index]; context.font = `bold ${Math.max(11, Math.min(cellSize * 1.3, 17))}px Consolas, monospace`;
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(index + 1), x, y + .5); context.restore();
    });
    if (hover) {
      const size = tool === 'spawn' ? 1 : brushSize, radius = Math.floor(size / 2);
      context.save(); context.strokeStyle = '#fff6c9'; context.fillStyle = '#fff3ba22'; context.lineWidth = 1.5;
      context.fillRect((hover.x - radius) * cellSize, (hover.y - radius) * cellSize, size * cellSize, size * cellSize);
      context.strokeRect((hover.x - radius) * cellSize + .75, (hover.y - radius) * cellSize + .75, size * cellSize - 1.5, size * cellSize - 1.5); context.restore();
    }
  }
  function eventPoint(event: PointerEvent): Point | null {
    const bounds = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - bounds.left) / bounds.width * doc.width), y = Math.floor((event.clientY - bounds.top) / bounds.height * doc.height);
    return x < 0 || y < 0 || x >= doc.width || y >= doc.height ? null : { x, y };
  }
  function paint(point: Point): void {
    if (tool === 'spawn') { doc.spawns[selectedSpawn] = { ...point }; return; }
    const radius = Math.floor(brushSize / 2);
    for (let y = Math.max(0, point.y - radius); y <= Math.min(doc.height - 1, point.y + radius); y++)
      for (let x = Math.max(0, point.x - radius); x <= Math.min(doc.width - 1, point.x + radius); x++) doc.cells[y * doc.width + x] = tool;
  }
  function strokeTo(point: Point): void {
    if (previousPoint && tool !== 'spawn') {
      const steps = Math.max(Math.abs(point.x - previousPoint.x), Math.abs(point.y - previousPoint.y));
      for (let i = 1; i <= steps; i++) paint({ x: Math.round(previousPoint.x + (point.x - previousPoint.x) * i / steps), y: Math.round(previousPoint.y + (point.y - previousPoint.y) * i / steps) });
    } else paint(point);
    previousPoint = point; cursor = point; hover = point; coordinates(point); draw();
  }
  function finishStroke(): void {
    if (!strokeBefore) return;
    const before = strokeBefore;
    strokeBefore = null; previousPoint = null;
    if (activePointer !== null && canvas.hasPointerCapture(activePointer)) canvas.releasePointerCapture(activePointer);
    activePointer = null;
    if (JSON.stringify(before) !== JSON.stringify(doc)) { remember(before); updateValidation(); scheduleSave(); }
    updateHistory();
  }
  function history(direction: 'undo' | 'redo'): void {
    finishStroke(); finishName();
    const from = direction === 'undo' ? undoStack : redoStack;
    const to = direction === 'undo' ? redoStack : undoStack;
    const snapshot = from.pop();
    if (!snapshot) return;
    to.push(clone(doc)); doc = snapshot; dismissReplacement(); syncDocument(); scheduleSave();
  }
  function dismissReplacement(): void { pending = null; find('[data-confirm]').hidden = true; }
  function requestReplacement(next: CustomMapDocument, message: string): void {
    finishName(); finishStroke();
    pending = { doc: next, message };
    find('[data-confirm]').hidden = false;
    find('[data-replacement]').textContent = next.name;
    find<HTMLButtonElement>('[data-action="confirm"]').focus();
  }
  function replaceDocument(): void {
    if (!pending) return;
    remember(clone(doc)); doc = clone(pending.doc);
    // Confirming a new/imported map also replaces an unreadable stored draft.
    // If storage itself remains unavailable, saveDraft reports that failure again.
    storageBlocked = false;
    const message = pending.message;
    dismissReplacement(); zoom = 1; syncDocument(); scheduleSave(); announce(message);
  }
  async function importFile(file: File): Promise<void> {
    if (readingFile) return;
    if (!file.name.toLowerCase().endsWith(CUSTOM_MAP_EXTENSION)) { announce('只支持 .ra2map 地图文件。', true); return; }
    if (file.size > MAX_CUSTOM_MAP_BYTES) { announce('地图文件超过 2 MB。', true); return; }
    readingFile = true; find<HTMLButtonElement>('[data-action="import"]').disabled = true;
    announce('读取地图中…');
    try {
      const imported = parseCustomMap(await file.text());
      if (!disposed) { requestReplacement(imported, '地图已导入，可继续编辑。'); find('[data-message]').hidden = true; }
    } catch (error) { if (!disposed) announce(`${t('导入失败：')}${error instanceof Error ? error.message : t('无法读取地图文件。')}`, true); }
    finally { readingFile = false; if (!disposed) find<HTMLButtonElement>('[data-action="import"]').disabled = false; }
  }
  function validatedDocument(): CustomMapDocument | null {
    finishName(); finishStroke();
    const errors = validateCustomMap(doc);
    if (errors.length) { updateValidation(); announce(errors.join(' '), true); return null; }
    saveDraft(); return clone(doc);
  }
  function download(): void {
    const valid = validatedDocument(); if (!valid) return;
    const blob = new Blob([serializeCustomMap(valid)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); downloadUrls.add(url);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${valid.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').slice(0, 80) || 'battlefield'}${CUSTOM_MAP_EXTENSION}`;
    screen.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 1000);
    announce('地图已下载，可以把文件分享给其他玩家。');
  }

  screen.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button.dataset.terrain) { finishStroke(); tool = button.dataset.terrain as Terrain; updateTools(); }
    if (button.dataset.brush) { finishStroke(); brushSize = Number(button.dataset.brush); updateTools(); }
    if (button.dataset.spawn) { finishStroke(); tool = 'spawn'; selectedSpawn = Number(button.dataset.spawn); updateTools(); }
    switch (button.dataset.action) {
      case 'back': finishName(); finishStroke(); saveDraft(); options.onBack(); break;
      case 'import': fileInput.click(); break;
      case 'download': download(); break;
      case 'use': { const valid = validatedDocument(); if (valid) options.onUse(valid); break; }
      case 'undo': history('undo'); break;
      case 'redo': history('redo'); break;
      case 'new': {
        const size = Number(find<HTMLSelectElement>('[data-new-size]').value);
        const next = createCustomMap(size, size, find<HTMLSelectElement>('[data-new-theater]').value as CustomMapDocument['theater'], Number(find<HTMLSelectElement>('[data-new-players]').value));
        next.name = t(next.name); requestReplacement(next, '已创建新地图。'); break;
      }
      case 'confirm': replaceDocument(); break;
      case 'cancel': dismissReplacement(); break;
      case 'zoom-out': zoom = Math.max(1, zoom / 1.5); resizeCanvas(); break;
      case 'zoom-in': zoom = Math.min(4, zoom * 1.5); resizeCanvas(); break;
      case 'fit': zoom = 1; resizeCanvas(); break;
    }
  }, { signal });
  nameInput.addEventListener('focus', () => { nameBefore = clone(doc); }, { signal });
  nameInput.addEventListener('input', () => {
    if (!nameBefore) nameBefore = clone(doc);
    doc.name = nameInput.value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 60);
    if (nameInput.value !== doc.name) nameInput.value = doc.name;
    updateValidation(); scheduleSave();
  }, { signal });
  nameInput.addEventListener('blur', finishName, { signal });
  fileInput.addEventListener('change', () => { const file = fileInput.files?.[0]; fileInput.value = ''; if (file) void importFile(file); }, { signal });
  find<HTMLInputElement>('[data-grid]').addEventListener('change', event => { showGrid = (event.target as HTMLInputElement).checked; draw(); }, { signal });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || activePointer !== null) return;
    const point = eventPoint(event); if (!point) return;
    event.preventDefault(); canvas.focus({ preventScroll: true }); finishName();
    activePointer = event.pointerId; strokeBefore = clone(doc); previousPoint = null;
    canvas.setPointerCapture(event.pointerId); strokeTo(point);
  }, { signal });
  canvas.addEventListener('pointermove', event => {
    if (activePointer !== null && event.pointerId !== activePointer) return;
    const point = eventPoint(event); hover = point; coordinates(point);
    if (activePointer !== null && point) strokeTo(point);
    else { if (!point) previousPoint = null; draw(); }
  }, { signal });
  canvas.addEventListener('pointerup', event => { if (event.pointerId === activePointer) finishStroke(); }, { signal });
  canvas.addEventListener('pointercancel', event => { if (event.pointerId === activePointer) finishStroke(); }, { signal });
  canvas.addEventListener('lostpointercapture', finishStroke, { signal });
  canvas.addEventListener('pointerleave', () => { if (activePointer === null) { hover = null; coordinates(null); draw(); } }, { signal });
  canvas.addEventListener('focus', () => { hover = cursor; coordinates(cursor); draw(); }, { signal });
  canvas.addEventListener('blur', () => { finishStroke(); hover = null; coordinates(null); draw(); }, { signal });
  screen.addEventListener('keydown', event => {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
    if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
      event.preventDefault(); history(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo'); return;
    }
    if (event.key === 'Escape' && pending) { event.preventDefault(); dismissReplacement(); return; }
    if (target !== canvas) return;
    const steps: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    if (steps[event.key]) {
      event.preventDefault(); const delta = steps[event.key]; cursor = { x: Math.max(0, Math.min(doc.width - 1, cursor.x + delta.x)), y: Math.max(0, Math.min(doc.height - 1, cursor.y + delta.y)) };
      hover = cursor; coordinates(cursor); draw();
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault(); if (event.repeat) return;
      strokeBefore = clone(doc); paint(cursor); hover = cursor; finishStroke(); draw();
    }
  }, { signal });
  screen.addEventListener('keyup', event => event.stopPropagation(), { signal });
  window.addEventListener('beforeunload', saveDraft, { signal });
  window.addEventListener('blur', finishStroke, { signal });
  bindLanguageControl(screen, () => { updateTools(); updateDraftStatus(); updateValidation(); coordinates(hover); });
  const observer = new ResizeObserver(resizeCanvas); observer.observe(scroll);
  syncDocument(); updateDraftStatus();
  if (!savedDraft && !storageBlocked) saveDraft();

  return () => {
    finishStroke(); finishName(); saveDraft(); disposed = true;
    controller.abort(); observer.disconnect(); clearTimeout(saveTimer);
    screen.querySelectorAll<HTMLSelectElement>('[data-language-select]').forEach(select => { select.onchange = null; });
    downloadUrls.forEach(url => URL.revokeObjectURL(url)); downloadUrls.clear(); screen.remove();
  };
}
