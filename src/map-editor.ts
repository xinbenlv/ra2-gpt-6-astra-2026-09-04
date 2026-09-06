import './map-editor.css';
import { bindLanguageControl, languageControl, localizeElement, registerTranslations, t } from './i18n';
import { createCustomMap, parseCustomMap, parseCustomMapDraft, serializeCustomMap, validateCustomMap, CUSTOM_MAP_EXTENSION, MAX_CUSTOM_MAP_BYTES, TERRAIN_COLORS, type CustomMapDocument } from './custom-maps';
import { nativeTerrainCatalog, type Terrain } from './maps';
import type { Assets } from './assets';
import { compileCustomTerrain, type ResolvedTerrainCell } from './custom-terrain';
import { TerrainPainter, projectTile, unprojectPoint } from './terrain-painter';
import { expandMapForBrush, paintCustomMap, resizeCustomMap, type MapBounds, type ResizeResult } from './map-editing';

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
  '缩放比例': 'Zoom Level', '单指绘制 · 双指缩放或平移': 'One finger to paint · Two fingers to zoom or pan',
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
  '地图编辑器缺少原版地形图像。请重新安装原版素材。': 'Original terrain artwork is missing from the map editor. Reinstall the original assets.',
  '地图编辑器缺少原版矿产图像。请重新安装原版素材。': 'Original resource artwork is missing from the map editor. Reinstall the original assets.',
  '自动扩展地图': 'Auto-expand Map', '画笔越过边缘时自动扩展，最大 96×96 格。': 'Painting past an edge expands the map, up to 96×96 cells.',
  '调整地图边界': 'Adjust Map Bounds', '拖动边或角调整范围；松开应用，可撤销。': 'Drag an edge or corner to resize. Release to apply; Undo restores it.',
  '完成边界调整': 'Finish Bounds', '显示出生点': 'Show Starts', '待放置': 'Unplaced', '需要重新放置的出生点：': 'Starting positions to replace: ',
  '范围': 'Bounds', '保留全部出生点': 'All starting positions retained', '地图边界已调整。': 'Map bounds updated.',
  '空格＋拖动或中键平移 · 滚轮缩放 · 方向键移动光标 · 空格绘制': 'Space + drag or middle drag to pan · Wheel to zoom · Arrows move cursor · Space paints',
  '地图最大为 96×96 格，请缩小画笔或先裁剪空白边缘。': 'Maps can be up to 96×96 cells. Use a smaller brush or trim an unused edge first.',
  '地图坐标必须是有效的整数格。': 'Use valid whole-number map coordinates.',
  '画笔大小必须为 1、3、5、7 或 9 格。': 'Brush size must be 1, 3, 5, 7, or 9 cells.',
  '地图边界坐标过大，请使用地图附近的范围。': 'Choose bounds near the existing map.',
  '地图尺寸和地形数量无效，请重新打开地图草稿。': 'Map dimensions and terrain counts are invalid. Reopen the draft.',
  '请选择有效的地图地形。': 'Choose a supported terrain.',
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
    [`起点 ${i} 尚未放置，请在地图内重新设置该玩家起点。`, `Start ${i} is unplaced. Place this player's start inside the map.`],
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
type EditorSnapshot = { doc: CustomMapDocument; origin: Point };
type HandleName = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type CropDrag = { handle: HandleName; before: EditorSnapshot; bounds: MapBounds; start: Point };

export function mountMapEditor(container: HTMLElement, options: { assets: Assets; onBack: () => void; onUse: (doc: CustomMapDocument) => void }): () => void {
  const screen = document.createElement('section');
  screen.className = 'map-editor';
  screen.innerHTML = `<header class="editor-header">
    <div class="editor-heading"><button type="button" class="editor-back" data-action="back">← 返回遭遇战</button><p class="editor-eyebrow">战场制图室</p><h1>地图编辑器</h1><p class="editor-intro">绘制地形、部署出生点，把你的战场分享给其他指挥官。</p></div>
    <div class="editor-header-actions"><div class="editor-language">${languageControl()}</div><button type="button" data-action="import">导入地图文件</button><button type="button" data-action="download">↓ 下载地图</button><button type="button" class="primary" data-action="use">用于遭遇战 ▸</button></div>
  </header>
  <div class="editor-message" data-message role="status" hidden><span data-message-text></span><button type="button" data-action="dismiss-message" aria-label="关闭">×</button></div>
  <div class="editor-confirm" data-confirm hidden><div><strong>替换当前地图？</strong><p>替换后可以点击撤销，回到当前地图。</p><p data-replacement></p></div><button type="button" class="primary" data-action="confirm">确认替换</button><button type="button" data-action="cancel">取消</button></div>
  <div class="editor-workspace">
    <aside class="editor-tools editor-panel" aria-label="绘制工具"><h2><span>01</span> 绘制工具</h2>
      <div class="editor-palette" role="group" aria-label="地形">${PAINT_TERRAINS.map(item => `<button type="button" data-terrain="${item.terrain}" aria-pressed="${item.terrain === 'land'}"><i class="editor-swatch" style="--swatch:${TERRAIN_COLORS[item.terrain]}">${item.symbol}</i><span>${item.label}</span></button>`).join('')}</div>
      <fieldset class="editor-brush"><legend>笔刷大小</legend><div>${[1, 3, 5, 7, 9].map(size => `<button type="button" data-brush="${size}" aria-pressed="${size === 1}" aria-label="${size} × ${size}">${size} × ${size}</button>`).join('')}</div></fieldset>
      <div class="editor-bound-tools"><label><input type="checkbox" data-auto-expand checked>自动扩展地图</label><p>画笔越过边缘时自动扩展，最大 96×96 格。</p><button type="button" data-action="crop" aria-pressed="false">调整地图边界</button></div><div class="editor-spawn-tools"><h2><span>02</span> 起始位置</h2><div data-spawns class="editor-spawns" role="group" aria-label="起始位置"></div><p>选择出生点后，点击地图移动。</p></div>
      <p class="editor-terrain-note">出生点周围需要平坦空地；水域和悬崖会阻挡地面单位。</p>
    </aside>
    <main class="editor-drawing editor-panel"><div class="editor-drawing-toolbar"><div class="editor-history"><button type="button" data-action="undo" title="撤销 (Ctrl/⌘ Z)">↶ <span>撤销</span></button><button type="button" data-action="redo" title="重做 (Ctrl/⌘ Shift Z)">↷ <span>重做</span></button></div><div class="editor-view-tools"><div class="editor-view-options"><label><input type="checkbox" data-grid>显示网格</label><label><input type="checkbox" data-markers checked>显示出生点</label></div><div class="editor-zoom-tools" role="group" aria-label="缩放比例"><button type="button" data-action="zoom-out" aria-label="缩小">−</button><span data-zoom-level aria-label="缩放比例">100%</span><button type="button" data-action="zoom-in" aria-label="放大">+</button><button type="button" data-action="fit">适应窗口</button></div></div></div>
      <div class="editor-canvas-scroll" data-canvas-scroll><canvas data-editor-canvas tabindex="0" aria-label="地图绘图区" aria-describedby="editor-canvas-help">地图绘图区</canvas><div data-crop-status class="editor-crop-status" role="status" hidden></div></div>
      <div class="editor-coordinate-bar"><span data-coordinates>在地图上移动指针开始绘制</span><span data-tool-status></span></div>
      <p class="editor-canvas-help" id="editor-canvas-help"><span class="editor-touch-help">单指绘制 · 双指缩放或平移</span><span class="editor-desktop-help">空格＋拖动或中键平移 · 滚轮缩放 · 方向键移动光标 · 空格绘制</span></p>
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
  let undoStack: EditorSnapshot[] = [];
  let redoStack: EditorSnapshot[] = [];
  let tool: Terrain | 'spawn' = 'land';
  let brushSize = 1;
  let selectedSpawn = 0;
  let hover: Point | null = null;
  let cursor: Point = { x: 0, y: 0 };
  let activePointer: number | null = null;
  const touchPointers = new Map<number, Point>();
  let touchBaseline: { state: EditorSnapshot; cursor: Point; notice: { hidden: boolean; text: string; error: boolean } } | null = null;
  let touchNavigation = false;
  let touchInterrupted = false;
  let pinch: { ids: [number, number]; distance: number; zoom: number; anchor: Point } | null = null;
  let strokeBefore: EditorSnapshot | null = null;
  let previousPoint: Point | null = null;
  let nameBefore: EditorSnapshot | null = null;
  let pending: { doc: CustomMapDocument; message: string } | null = null;
  let zoom = 1;
  let origin: Point = { x: 0, y: 0 };
  let camera: Point = { x: 0, y: 0 };
  let viewport: Point = { x: 0, y: 0 };
  let pixelRatio = 1;
  let fitted = false;
  let showGrid = false;
  let showMarkers = true;
  let autoExpand = true;
  let cropMode = false;
  let cropDrag: CropDrag | null = null;
  let panDrag: { start: Point; camera: Point } | null = null;
  let spaceHeld = false;
  let spaceUsedForPan = false;
  let strokeLimitReported = false;
  const painter = new TerrainPainter(options.assets);
  let terrainRevision = 0;
  let compiledRevision = -1;
  let compiledDocument: CustomMapDocument | null = null;
  let compiledTerrain: ResolvedTerrainCell[] = [];
  let compiledTransitions = 0;
  let compiledResources = 0;
  function nativeTerrain(): ResolvedTerrainCell[] {
    if (compiledDocument !== doc || compiledRevision !== terrainRevision) {
      compiledTerrain = compileCustomTerrain(doc, nativeTerrainCatalog());
      compiledTransitions = compiledTerrain.filter(cell => cell.layers.length > 1).length;
      compiledResources = compiledTerrain.filter(cell => cell.overlayKey).length;
      compiledDocument = doc; compiledRevision = terrainRevision;
    }
    return compiledTerrain;
  }
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let readingFile = false;
  const downloadUrls = new Set<string>();

  function announce(message: string, error = false): void {
    const el = find<HTMLDivElement>('[data-message]');
    el.hidden = false;
    el.classList.toggle('is-error', error);
    find('[data-message-text]').textContent = message;
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
    // A first finger may become a pinch. Never persist its tentative brush marks.
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(touchBaseline?.state.doc ?? doc)); draftMessage = '已保存本地草稿'; }
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
  function remember(before: EditorSnapshot): void {
    undoStack.push(before);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
  }
  function snapshot(): EditorSnapshot { return { doc: clone(doc), origin: { ...origin } }; }
  function finishName(): void {
    if (nameBefore && nameBefore.doc.name !== doc.name) remember(nameBefore);
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
    screen.querySelectorAll<HTMLButtonElement>('[data-terrain]').forEach(button => button.setAttribute('aria-pressed', String(!cropMode && button.dataset.terrain === tool)));
    screen.querySelectorAll<HTMLButtonElement>('[data-brush]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.brush) === brushSize)));
    screen.querySelectorAll<HTMLButtonElement>('[data-spawn]').forEach(button => button.setAttribute('aria-pressed', String(!cropMode && tool === 'spawn' && Number(button.dataset.spawn) === selectedSpawn)));
    find('[data-action="crop"]').setAttribute('aria-pressed', String(cropMode));
    find('[data-action="crop"]').textContent = cropMode ? '完成边界调整' : '调整地图边界';
    localizeElement(find('[data-action="crop"]'));
    find('[data-tool-status]').textContent = cropMode ? '调整地图边界' : tool === 'spawn' ? `移动出生点 ${selectedSpawn + 1}` : `${PAINT_TERRAINS.find(item => item.terrain === tool)!.label} · ${brushSize} × ${brushSize}`;
    localizeElement(find('[data-tool-status]'));
    draw();
  }
  function syncDocument(): void {
    nameInput.value = doc.name;
    selectedSpawn = Math.min(selectedSpawn, doc.spawns.length - 1);
    find('[data-size]').textContent = `${doc.width} × ${doc.height}`;
    find('[data-theater]').textContent = { temperate: '温带', snow: '雪地', urban: '城市' }[doc.theater];
    find('[data-players]').textContent = String(doc.spawns.length);
    find('[data-spawns]').replaceChildren(...doc.spawns.map((point, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.spawn = String(index);
      button.style.setProperty('--spawn-color', SPAWN_COLORS[index]);
      button.textContent = String(index + 1); button.setAttribute('aria-label', `出生点 ${index + 1}${point.x < 0 ? ' · 待放置' : ''}`);
      if (point.x < 0) { button.classList.add('is-unplaced'); const label = document.createElement('small'); label.textContent = '待放置'; button.append(label); }
      return button;
    }));
    cursor = { x: Math.min(cursor.x, doc.width - 1), y: Math.min(cursor.y, doc.height - 1) };
    hover = null;
    updateHistory(); updateValidation(); updateTools(); localizeElement(screen);
  }
  function coordinates(point: Point | null): void {
    find('[data-coordinates]').textContent = point ? `${t('坐标')} ${String(point.x + 1).padStart(2, '0')}, ${String(point.y + 1).padStart(2, '0')}` : t('在地图上移动指针开始绘制');
  }
  function localToScreen(point: Point): Point {
    const p = projectTile(point.x + origin.x, point.y + origin.y);
    return { x: camera.x + p.x * zoom, y: camera.y + p.y * zoom };
  }
  function screenToLocal(point: Point): Point {
    const p = unprojectPoint((point.x - camera.x) / zoom, (point.y - camera.y) / zoom);
    return { x: p.x - origin.x, y: p.y - origin.y };
  }
  function clientPoint(event: { clientX: number; clientY: number }): Point {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function eventPoint(event: { clientX: number; clientY: number }): Point {
    const point = screenToLocal(clientPoint(event));
    return { x: Math.round(point.x), y: Math.round(point.y) };
  }
  function currentBounds(): MapBounds { return { x: 0, y: 0, width: doc.width, height: doc.height }; }
  function boundsPoints(bounds: MapBounds): Point[] {
    const left = bounds.x - .5, top = bounds.y - .5, right = left + bounds.width, bottom = top + bounds.height;
    return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }].map(localToScreen);
  }
  function polygon(points: Point[]): void {
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y);
    context.closePath();
  }
  function cropHandles(bounds = cropDrag?.bounds ?? currentBounds()): { name: HandleName; x: number; y: number }[] {
    const [nw, ne, se, sw] = boundsPoints(bounds), mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    return [{ name: 'nw', ...nw }, { name: 'n', ...mid(nw, ne) }, { name: 'ne', ...ne }, { name: 'e', ...mid(ne, se) },
      { name: 'se', ...se }, { name: 's', ...mid(sw, se) }, { name: 'sw', ...sw }, { name: 'w', ...mid(nw, sw) }];
  }
  function fitMap(): void {
    if (!viewport.x || !viewport.y) return;
    const pad = Math.min(70, viewport.x * .12, viewport.y * .13);
    zoom = Math.max(.055, Math.min(1.4, (viewport.x - pad * 2) / ((doc.width + doc.height) * 30), (viewport.y - pad * 2) / ((doc.width + doc.height) * 15)));
    const center = projectTile(origin.x + (doc.width - 1) / 2, origin.y + (doc.height - 1) / 2);
    camera = { x: viewport.x / 2 - center.x * zoom, y: viewport.y / 2 - center.y * zoom };
    fitted = true; draw();
  }
  function zoomAt(factor: number, anchor: Point = { x: viewport.x / 2, y: viewport.y / 2 }): void {
    const next = Math.max(.055, Math.min(3, zoom * factor));
    camera = { x: anchor.x - (anchor.x - camera.x) * next / zoom, y: anchor.y - (anchor.y - camera.y) * next / zoom };
    zoom = next; draw();
  }
  function resizeCanvas(): void {
    if (disposed) return;
    const next = { x: Math.max(1, scroll.clientWidth), y: Math.max(1, scroll.clientHeight) };
    if (fitted) camera = { x: camera.x + (next.x - viewport.x) / 2, y: camera.y + (next.y - viewport.y) / 2 };
    viewport = next; pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewport.x * pixelRatio); canvas.height = Math.round(viewport.y * pixelRatio);
    context.imageSmoothingEnabled = false;
    canvas.style.width = `${viewport.x}px`; canvas.style.height = `${viewport.y}px`;
    if (!fitted) fitMap(); else draw();
  }
  function draw(): void {
    if (disposed || !viewport.x || !viewport.y) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, viewport.x, viewport.y);
    context.fillStyle = '#0c1512'; context.fillRect(0, 0, viewport.x, viewport.y);
    context.strokeStyle = '#78958015'; context.lineWidth = 1;
    for (let x = camera.x % 32; x < viewport.x; x += 32) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, viewport.y); context.stroke(); }
    for (let y = camera.y % 32; y < viewport.y; y += 32) { context.beginPath(); context.moveTo(0, y); context.lineTo(viewport.x, y); context.stroke(); }
    context.save(); context.translate(camera.x, camera.y); context.scale(zoom, zoom);
    const resolved = nativeTerrain();
    const visible: { px: number; py: number; cell: ResolvedTerrainCell }[] = [];
    const drawBounds = painter.getDrawBounds();
    // Match battlefield depth order, including native tile extras: x ascends within each diagonal.
    for (let depth = 0; depth <= doc.width + doc.height - 2; depth++) {
      for (let x = Math.max(0, depth - doc.height + 1); x <= Math.min(doc.width - 1, depth); x++) {
        const y = depth - x, p = projectTile(x + origin.x, y + origin.y);
        if (camera.x + (p.x + drawBounds.right) * zoom < 0 || camera.x + (p.x - drawBounds.left) * zoom > viewport.x || camera.y + (p.y + drawBounds.bottom) * zoom < 0 || camera.y + (p.y - drawBounds.top) * zoom > viewport.y) continue;
        const cell = resolved[y * doc.width + x];
        if (!painter.drawResolvedGround(context, cell, p.x, p.y)) throw new Error(t('地图编辑器缺少原版地形图像。请重新安装原版素材。'));
        visible.push({ px: p.x, py: p.y, cell });
      }
    }
    for (const tile of visible) if (tile.cell.overlayKey && !painter.drawResolvedResources(context, tile.cell, tile.px, tile.py)) throw new Error(t('地图编辑器缺少原版矿产图像。请重新安装原版素材。'));
    context.restore();
    if (showGrid && zoom > .09) {
      context.strokeStyle = '#17241b60'; context.lineWidth = .65;
      for (let x = 0; x <= doc.width; x++) { const a = localToScreen({ x: x - .5, y: -.5 }), b = localToScreen({ x: x - .5, y: doc.height - .5 }); context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke(); }
      for (let y = 0; y <= doc.height; y++) { const a = localToScreen({ x: -.5, y: y - .5 }), b = localToScreen({ x: doc.width - .5, y: y - .5 }); context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke(); }
    }
    context.strokeStyle = '#c0c59285'; context.lineWidth = 1; context.beginPath(); polygon(boundsPoints(currentBounds())); context.stroke();
    if (showMarkers || tool === 'spawn') doc.spawns.forEach((point, index) => {
      if (point.x < 0 || point.y < 0) return;
      const p = localToScreen(point), selected = !cropMode && tool === 'spawn' && selectedSpawn === index;
      context.save(); context.strokeStyle = SPAWN_COLORS[index]; context.lineWidth = selected ? 2 : 1; context.setLineDash([4, 3]);
      context.beginPath(); polygon(boundsPoints({ x: point.x - 2, y: point.y - 2, width: 5, height: 5 })); context.stroke(); context.setLineDash([]);
      context.fillStyle = '#101612e8'; context.beginPath(); context.arc(p.x, p.y, 11, 0, Math.PI * 2); context.fill(); context.stroke();
      context.fillStyle = SPAWN_COLORS[index]; context.font = 'bold 12px Consolas, monospace'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(index + 1), p.x, p.y + .5); context.restore();
    });
    if (cropMode) {
      const bounds = cropDrag?.bounds ?? currentBounds();
      if (cropDrag) {
        context.save(); context.beginPath(); polygon(boundsPoints(currentBounds())); context.clip();
        context.fillStyle = '#8f281d99'; context.beginPath(); context.rect(0, 0, viewport.x, viewport.y); polygon(boundsPoints(bounds)); context.fill('evenodd'); context.restore();
      }
      context.strokeStyle = '#f2d08d'; context.lineWidth = 2; context.setLineDash([6, 4]); context.beginPath(); polygon(boundsPoints(bounds)); context.stroke(); context.setLineDash([]);
      for (const handle of cropHandles(bounds)) { context.fillStyle = '#efdb9b'; context.strokeStyle = '#161f13'; context.lineWidth = 2; context.fillRect(handle.x - 5, handle.y - 5, 10, 10); context.strokeRect(handle.x - 5, handle.y - 5, 10, 10); }
    } else if (hover && !panDrag && !spaceHeld) {
      const size = tool === 'spawn' ? 1 : brushSize, radius = Math.floor(size / 2);
      context.fillStyle = '#fff3b92b'; context.strokeStyle = '#ffedb6'; context.lineWidth = 1.5;
      context.beginPath(); polygon(boundsPoints({ x: hover.x - radius, y: hover.y - radius, width: size, height: size })); context.fill(); context.stroke();
    }
    Object.assign(canvas.dataset, { zoom: String(zoom), cameraX: String(camera.x), cameraY: String(camera.y), originX: String(origin.x), originY: String(origin.y), mapWidth: String(doc.width), mapHeight: String(doc.height), cropMode: String(cropMode), cropHandles: JSON.stringify(cropMode ? cropHandles() : []), nativeTileCount: String(resolved.length), transitionCount: String(compiledTransitions), resourceCount: String(compiledResources) });
    find('[data-zoom-level]').textContent = `${Math.round(zoom * 100)}%`;
    find<HTMLButtonElement>('[data-action="zoom-out"]').disabled = zoom <= .055;
    find<HTMLButtonElement>('[data-action="zoom-in"]').disabled = zoom >= 3;
    canvas.style.cursor = panDrag ? 'grabbing' : spaceHeld ? 'grab' : cropMode ? 'crosshair' : 'crosshair';
  }
  function applyResize(result: ResizeResult): void {
    doc = result.document;
    origin = { x: origin.x - result.offset.x, y: origin.y - result.offset.y };
    cursor = { x: cursor.x + result.offset.x, y: cursor.y + result.offset.y };
    if (hover) hover = { x: hover.x + result.offset.x, y: hover.y + result.offset.y };
    find('[data-size]').textContent = `${doc.width} × ${doc.height}`;
  }
  function paintWorld(point: Point): void {
    const local = { x: point.x - origin.x, y: point.y - origin.y };
    if (tool === 'spawn') {
      if (local.x >= 0 && local.y >= 0 && local.x < doc.width && local.y < doc.height) doc.spawns[selectedSpawn] = local;
    } else { paintCustomMap(doc, local, tool, brushSize); terrainRevision++; }
  }
  function strokeTo(point: Point): void {
    const world = { x: point.x + origin.x, y: point.y + origin.y };
    const previous = previousPoint ?? world;
    try {
      if (autoExpand && tool !== 'spawn') {
        // Compute the whole segment's expansion before committing either resize.
        // A rejected 96-cell limit leaves this pointer sample entirely unchanged.
        const first = expandMapForBrush(doc, { x: previous.x - origin.x, y: previous.y - origin.y }, brushSize);
        const intermediateOrigin = { x: origin.x - first.offset.x, y: origin.y - first.offset.y };
        const second = expandMapForBrush(first.document, { x: world.x - intermediateOrigin.x, y: world.y - intermediateOrigin.y }, brushSize);
        applyResize({ document: second.document, offset: { x: first.offset.x + second.offset.x, y: first.offset.y + second.offset.y }, removedSpawns: [] });
      }
      const steps = tool === 'spawn' ? 0 : Math.max(Math.abs(world.x - previous.x), Math.abs(world.y - previous.y));
      if (steps) for (let i = 1; i <= steps; i++) paintWorld({ x: Math.round(previous.x + (world.x - previous.x) * i / steps), y: Math.round(previous.y + (world.y - previous.y) * i / steps) });
      else paintWorld(world);
      previousPoint = world;
    } catch (error) {
      if (!strokeLimitReported) { announce(error instanceof Error ? error.message : '地图最大为 96×96 格，请缩小画笔或先裁剪空白边缘。', true); strokeLimitReported = true; }
      previousPoint = null;
    }
    cursor = { x: world.x - origin.x, y: world.y - origin.y }; hover = cursor; coordinates(cursor); draw();
  }
  function finishStroke(): void {
    if (!strokeBefore) return;
    const before = strokeBefore; strokeBefore = null; previousPoint = null;
    if (JSON.stringify(before) !== JSON.stringify(snapshot())) { remember(before); syncDocument(); scheduleSave(); }
    updateHistory();
  }
  function updateCropPreview(point: Point): void {
    if (!cropDrag) return;
    const drag = cropDrag, width = drag.before.doc.width, height = drag.before.doc.height;
    const dx = Math.round(point.x - drag.start.x), dy = Math.round(point.y - drag.start.y);
    let left = 0, top = 0, right = width, bottom = height;
    if (drag.handle.includes('w')) left = Math.max(right - 96, Math.min(right - 24, dx));
    if (drag.handle.includes('e')) right = Math.max(24, Math.min(96, width + dx));
    if (drag.handle.includes('n')) top = Math.max(bottom - 96, Math.min(bottom - 24, dy));
    if (drag.handle.includes('s')) bottom = Math.max(24, Math.min(96, height + dy));
    drag.bounds = { x: left, y: top, width: right - left, height: bottom - top };
    cropStatus(); draw();
  }
  function cropStatus(): void {
    const status = find('[data-crop-status]'); status.hidden = !cropMode;
    if (!cropMode) return;
    const bounds = cropDrag?.bounds ?? currentBounds();
    const removed = doc.spawns.flatMap((p, i) => p.x < 0 || p.x < bounds.x || p.y < bounds.y || p.x >= bounds.x + bounds.width || p.y >= bounds.y + bounds.height ? [i + 1] : []);
    status.textContent = `${t('范围')} ${bounds.width} × ${bounds.height} · ${removed.length ? t('需要重新放置的出生点：') + removed.join(', ') : t('保留全部出生点')}\n${t('拖动边或角调整范围；松开应用，可撤销。')}`;
  }
  function finishPointer(cancelCrop = false): void {
    if (touchPointers.size) interruptTouchGesture();
    const pointer = activePointer; activePointer = null;
    if (cropDrag) {
      const drag = cropDrag; cropDrag = null;
      if (!cancelCrop && (drag.bounds.x || drag.bounds.y || drag.bounds.width !== doc.width || drag.bounds.height !== doc.height)) {
        try {
          const result = resizeCustomMap(doc, drag.bounds); remember(drag.before); applyResize(result); syncDocument(); scheduleSave();
          announce(result.removedSpawns.length ? `${t('需要重新放置的出生点：')}${result.removedSpawns.map(i => i + 1).join(', ')}` : '地图边界已调整。');
        } catch (error) { announce(error instanceof Error ? error.message : '地图边界坐标过大，请使用地图附近的范围。', true); }
      }
    }
    panDrag = null; finishStroke();
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    cropStatus(); draw();
  }
  function rollbackTouchEdit(): void {
    if (touchBaseline) {
      doc = touchBaseline.state.doc; origin = { ...touchBaseline.state.origin }; cursor = { ...touchBaseline.cursor };
      const notice = find('[data-message]');
      notice.hidden = touchBaseline.notice.hidden; notice.classList.toggle('is-error', touchBaseline.notice.error);
      find('[data-message-text]').textContent = touchBaseline.notice.text;
    }
    touchBaseline = null; strokeBefore = null; previousPoint = null; cropDrag = null; panDrag = null; activePointer = null;
    hover = null; strokeLimitReported = false; syncDocument(); cropStatus(); coordinates(null);
  }
  function touchPair(ids: [number, number]): { center: Point; distance: number } | null {
    const a = touchPointers.get(ids[0]), b = touchPointers.get(ids[1]);
    if (!a || !b) return null;
    const rect = canvas.getBoundingClientRect();
    return { center: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  function rebasePinch(): void {
    pinch = null;
    if (touchInterrupted || touchPointers.size < 2) return;
    const ids = [...touchPointers.keys()].slice(0, 2) as [number, number], pair = touchPair(ids);
    if (!pair || pair.distance < 2) return;
    pinch = { ids, distance: pair.distance, zoom, anchor: { x: (pair.center.x - camera.x) / zoom, y: (pair.center.y - camera.y) / zoom } };
  }
  function movePinch(): void {
    if (touchInterrupted || touchPointers.size < 2) return;
    if (!pinch) { rebasePinch(); return; }
    const pair = touchPair(pinch.ids); if (!pair) { rebasePinch(); return; }
    zoom = Math.max(.055, Math.min(3, pinch.zoom * pair.distance / pinch.distance));
    camera = { x: pair.center.x - pinch.anchor.x * zoom, y: pair.center.y - pinch.anchor.y * zoom };
    draw();
  }
  function interruptTouchGesture(clear = false): void {
    if (!touchPointers.size) return;
    rollbackTouchEdit(); pinch = null; touchNavigation = true; touchInterrupted = true;
    if (clear) {
      const ids = [...touchPointers.keys()]; touchPointers.clear(); touchNavigation = false; touchInterrupted = false;
      for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
  }
  function endTouch(event: PointerEvent, canceled: boolean): boolean {
    if (!touchPointers.has(event.pointerId)) return false;
    touchPointers.delete(event.pointerId);
    if (touchNavigation) {
      if (canceled) touchInterrupted = true;
      rebasePinch();
    } else {
      if (canceled) rollbackTouchEdit(); else touchBaseline = null;
      finishPointer(canceled);
    }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!touchPointers.size) { touchNavigation = false; touchInterrupted = false; pinch = null; touchBaseline = null; }
    hover = null; coordinates(null); draw(); return true;
  }
  function history(direction: 'undo' | 'redo'): void {
    finishPointer(); finishName();
    const from = direction === 'undo' ? undoStack : redoStack;
    const to = direction === 'undo' ? redoStack : undoStack;
    const snapshot = from.pop();
    if (!snapshot) return;
    to.push({ doc: clone(doc), origin: { ...origin } }); doc = snapshot.doc; origin = { ...snapshot.origin }; dismissReplacement(); syncDocument(); scheduleSave();
  }
  function dismissReplacement(): void { pending = null; find('[data-confirm]').hidden = true; }
  function requestReplacement(next: CustomMapDocument, message: string): void {
    finishName(); finishPointer();
    pending = { doc: next, message };
    find('[data-confirm]').hidden = false;
    find('[data-replacement]').textContent = next.name;
    find<HTMLButtonElement>('[data-action="confirm"]').focus();
  }
  function replaceDocument(): void {
    if (!pending) return;
    remember(snapshot()); doc = clone(pending.doc); origin = { x: 0, y: 0 };
    // Confirming a new/imported map also replaces an unreadable stored draft.
    // If storage itself remains unavailable, saveDraft reports that failure again.
    storageBlocked = false;
    const message = pending.message;
    dismissReplacement(); syncDocument(); fitMap(); scheduleSave(); announce(message);
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
    finishName(); finishPointer();
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
    if (button.dataset.terrain) { finishPointer(); cropMode = false; cropStatus(); tool = button.dataset.terrain as Terrain; updateTools(); }
    if (button.dataset.brush) { finishPointer(); cropMode = false; cropStatus(); brushSize = Number(button.dataset.brush); updateTools(); }
    if (button.dataset.spawn) { finishPointer(); cropMode = false; cropStatus(); tool = 'spawn'; selectedSpawn = Number(button.dataset.spawn); updateTools(); }
    switch (button.dataset.action) {
      case 'back': finishName(); finishPointer(); saveDraft(); options.onBack(); break;
      case 'import': fileInput.click(); break;
      case 'dismiss-message': find('[data-message]').hidden = true; break;
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
      case 'zoom-out': zoomAt(1 / 1.3); break;
      case 'zoom-in': zoomAt(1.3); break;
      case 'fit': fitMap(); break;
      case 'crop': finishPointer(); cropMode = !cropMode; hover = null; cropStatus(); updateTools(); break;
    }
  }, { signal });
  nameInput.addEventListener('focus', () => { nameBefore = snapshot(); }, { signal });
  nameInput.addEventListener('input', () => {
    if (!nameBefore) nameBefore = snapshot();
    doc.name = nameInput.value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 60);
    if (nameInput.value !== doc.name) nameInput.value = doc.name;
    updateValidation(); scheduleSave();
  }, { signal });
  nameInput.addEventListener('blur', finishName, { signal });
  fileInput.addEventListener('change', () => { const file = fileInput.files?.[0]; fileInput.value = ''; if (file) void importFile(file); }, { signal });
  find<HTMLInputElement>('[data-grid]').addEventListener('change', event => { showGrid = (event.target as HTMLInputElement).checked; draw(); }, { signal });
  find<HTMLInputElement>('[data-markers]').addEventListener('change', event => { showMarkers = (event.target as HTMLInputElement).checked; draw(); }, { signal });
  find<HTMLInputElement>('[data-auto-expand]').addEventListener('change', event => { autoExpand = (event.target as HTMLInputElement).checked; }, { signal });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.button !== 1) return;
    const touch = event.pointerType === 'touch';
    if (touch ? touchPointers.has(event.pointerId) || (activePointer !== null && !touchPointers.size) : activePointer !== null || touchPointers.size > 0) return;
    event.preventDefault(); canvas.focus({ preventScroll: true }); finishName();
    if (touch) {
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      if (touchPointers.size > 1 || touchNavigation) {
        if (!touchNavigation) { rollbackTouchEdit(); touchNavigation = true; }
        rebasePinch(); draw(); return;
      }
      const notice = find('[data-message]');
      touchBaseline = { state: snapshot(), cursor: { ...cursor }, notice: { hidden: notice.hidden, text: find('[data-message-text]').textContent ?? '', error: notice.classList.contains('is-error') } };
    }
    activePointer = event.pointerId; canvas.setPointerCapture(event.pointerId);
    if (event.button === 1 || spaceHeld) {
      spaceUsedForPan = true; panDrag = { start: clientPoint(event), camera: { ...camera } }; draw(); return;
    }
    if (cropMode) {
      const p = clientPoint(event), handle = cropHandles().find(h => Math.hypot(h.x - p.x, h.y - p.y) <= 15);
      if (handle) cropDrag = { handle: handle.name, before: snapshot(), bounds: currentBounds(), start: screenToLocal(p) };
      cropStatus(); draw(); return;
    }
    strokeBefore = snapshot(); previousPoint = null; strokeLimitReported = false; strokeTo(eventPoint(event));
  }, { signal });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') {
      if (!touchPointers.has(event.pointerId)) return;
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touchNavigation) { event.preventDefault(); movePinch(); return; }
    } else if (touchPointers.size) return;
    if (activePointer !== null && event.pointerId !== activePointer) return;
    const screenPoint = clientPoint(event);
    if (panDrag) { camera = { x: panDrag.camera.x + screenPoint.x - panDrag.start.x, y: panDrag.camera.y + screenPoint.y - panDrag.start.y }; draw(); return; }
    if (cropDrag) { updateCropPreview(screenToLocal(screenPoint)); return; }
    const point = eventPoint(event); hover = point; coordinates(point);
    if (activePointer !== null && strokeBefore) strokeTo(point); else draw();
  }, { signal });
  canvas.addEventListener('pointerup', event => { if (!endTouch(event, false) && event.pointerId === activePointer) finishPointer(); }, { signal });
  canvas.addEventListener('pointercancel', event => { if (!endTouch(event, true) && event.pointerId === activePointer) finishPointer(true); }, { signal });
  canvas.addEventListener('lostpointercapture', event => {
    if (touchPointers.has(event.pointerId)) { interruptTouchGesture(); draw(); }
    else if (event.pointerId === activePointer) finishPointer(true);
  }, { signal });
  // Lost capture can send the final lift outside the canvas. Keep the navigation
  // latch until those contacts actually end, without turning their moves into paint.
  window.addEventListener('pointerup', event => { endTouch(event, false); }, { signal });
  window.addEventListener('pointercancel', event => { endTouch(event, true); }, { signal });
  canvas.addEventListener('pointerleave', () => { if (activePointer === null) { hover = null; coordinates(null); draw(); } }, { signal });
  canvas.addEventListener('focus', () => { hover = touchNavigation ? null : cursor; coordinates(hover); draw(); }, { signal });
  canvas.addEventListener('blur', () => { interruptTouchGesture(true); finishPointer(true); spaceHeld = false; spaceUsedForPan = false; hover = null; coordinates(null); draw(); }, { signal });
  canvas.addEventListener('wheel', event => {
    event.preventDefault(); if (activePointer !== null || touchPointers.size) return;
    zoomAt(Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) * .002), clientPoint(event));
  }, { signal, passive: false });
  canvas.addEventListener('auxclick', event => event.preventDefault(), { signal });
  canvas.addEventListener('contextmenu', event => event.preventDefault(), { signal });
  function keyboardPaint(): void {
    if (cropMode || activePointer !== null || touchPointers.size) return;
    strokeBefore = snapshot(); previousPoint = null; strokeLimitReported = false; strokeTo(cursor); finishStroke(); draw();
  }
  screen.addEventListener('keydown', event => {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
    if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
      event.preventDefault(); history(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo'); return;
    }
    if (event.key === 'Escape') {
      if (pending) { event.preventDefault(); dismissReplacement(); }
      else if (touchPointers.size) { event.preventDefault(); interruptTouchGesture(); draw(); }
      else if (activePointer !== null) {
        event.preventDefault();
        if (strokeBefore) { doc = strokeBefore.doc; origin = { ...strokeBefore.origin }; strokeBefore = null; previousPoint = null; syncDocument(); scheduleSave(); }
        finishPointer(true);
      } else if (cropMode) { event.preventDefault(); cropMode = false; cropStatus(); updateTools(); }
      return;
    }
    if (target !== canvas) return;
    const steps: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    if (steps[event.key]) {
      event.preventDefault(); const delta = steps[event.key]; cursor = { x: Math.max(0, Math.min(doc.width - 1, cursor.x + delta.x)), y: Math.max(0, Math.min(doc.height - 1, cursor.y + delta.y)) };
      hover = cursor; coordinates(cursor); draw();
    } else if (event.key === ' ') {
      event.preventDefault(); if (!event.repeat) { spaceHeld = true; spaceUsedForPan = false; draw(); }
    } else if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) keyboardPaint(); }
  }, { signal });
  screen.addEventListener('keyup', event => {
    event.stopPropagation();
    if (event.key === ' ' && spaceHeld) {
      event.preventDefault(); const shouldPaint = !spaceUsedForPan && activePointer === null && event.target === canvas;
      spaceHeld = false; spaceUsedForPan = false; if (shouldPaint) keyboardPaint(); else draw();
    }
  }, { signal });
  window.addEventListener('beforeunload', saveDraft, { signal });
  window.addEventListener('blur', () => { interruptTouchGesture(true); finishPointer(true); spaceHeld = false; spaceUsedForPan = false; draw(); }, { signal });
  bindLanguageControl(screen, () => { updateTools(); updateDraftStatus(); updateValidation(); coordinates(hover); cropStatus(); });
  const observer = new ResizeObserver(resizeCanvas); observer.observe(scroll);
  syncDocument(); resizeCanvas(); updateDraftStatus();
  if (!savedDraft && !storageBlocked) saveDraft();

  return () => {
    interruptTouchGesture(true); finishPointer(); finishName(); saveDraft(); disposed = true;
    controller.abort(); observer.disconnect(); clearTimeout(saveTimer); painter.clear();
    screen.querySelectorAll<HTMLSelectElement>('[data-language-select]').forEach(select => { select.onchange = null; });
    downloadUrls.forEach(url => URL.revokeObjectURL(url)); downloadUrls.clear(); screen.remove();
  };
}
