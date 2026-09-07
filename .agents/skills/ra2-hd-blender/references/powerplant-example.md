# 苏军电厂：已认可实例

用户在本轮完成后评价“几乎完美”。保留这一视觉基准，不重新启用早期草模。这里记录成功实例与复现边界；它不是所有 RA2 建筑的统一模板。

## 来源和本地文件

以下路径均相对于仓库根目录。图片与模型在 `.cache/` 或其他被忽略的素材目录中，新的 Git checkout 不会自带它们。

| 文件 | 身份与用途 |
| --- | --- |
| `public/assets/sprites/napowr.png` | 210×140 原厂素材的本地转换图，含工作效果，用于身份/轮廓核对 |
| `.cache/prototype-3d/reference/sources.json` | 原始 SHP 文件哈希、帧数和尺寸记录 |
| `.cache/prototype-3d/reference/ngpowr.shp-0.png` 等 | 提取的静态层；最近邻放大仅用于读像素 |
| `.cache/prototype-3d/reference/powerplant-hd-candidate-v1.png` | 第一阶段历史候选，1536×1024 RGB，无 alpha |
| `.cache/prototype-3d/reference/powerplant-user-reference-20260905.jpg` | 后来用户指定的最终高清基准，1280×853 RGB，从附件原样复制 |
| `.cache/prototype-3d/reference-materials/industrial-reference-atlas-v1.png` | 以最终 JPEG 为输入生成的六材质 atlas，1536×1024，每块512² |
| `.cache/prototype-3d/blender-reference/powerplant-reference-authoring.blend` | 当前可编辑建模文件 |
| `.cache/prototype-3d/blender-reference/powerplant-reference-textured-review.blend` | 已打包纹理及参考背景、2560×1706/128 samples 的直接重渲染场景 |
| `.cache/prototype-3d/blender-reference/powerplant-reference-textured-2560.png` | 用户认可的实际 Cycles 图；本次对应 `atlas-v5.png` 的原样副本 |
| `.cache/prototype-3d/blender-reference/atlas-v5-region-audit.json` | 与旧版比较的固定区域颜色差异；无整体相似率 |
| `.cache/prototype-3d/blender-reference/before-atlas/` | 更换专用材质前的模型和渲染快照 |

[输入记录](powerplant-inputs.json) 固定三张实际依赖图片的 SHA-256，并记录认可 PNG 的身份。校验器的 `ready=true` 只表示三张输入就绪；`accepted_output` 是来源记录，不会被该输入检查自动校验，也不保证 PNG 或 blend 已存在。图像生成具有随机性；历史 prompt 留存不意味着重跑能逐字节恢复认可图片。

早期高清调用用原版图及原静态层的最近邻展示作为输入，保存了 [实际提示词](powerplant-hd-prompt-historical.txt)。其中蛋形描述后来已纠正；最终认可的 JPEG 是用户指定输入，不应与该历史候选混同。

材质调用只引用最终 JPEG，使用内置 imagegen，保存了 [实际材质提示词](powerplant-material-atlas-prompt.txt)。它请求的理想尺寸与实际返回尺寸不同。两份实际 prompt 均已复制为可提交文本；不依赖机器上的临时截图或对话记录才能阅读。

## 已确认的本例结构

- 正球形金属导体，基础半径0.92、三轴直径1.84；独立冠板、搭接带和双排铆钉。
- 两个柜体各自只有正面斜罩，背面平直；不再沿前后镜像复制斜罩。
- 柜墙采用钢框内耐火砌体解释，前斜罩为旧漆钢板，粗管有磨损镀层与接头油污。
- 参考视图1280×853，正交方位45°/俯角30°；完整参数在 `prototypes/3d/powerplant-reference-view.json`。
- 原版是依据，高清参考是本轮视觉目标；早期 Three.js 电厂已弃用，不导回它作为建模源头。

## 脚本入口和硬编码边界

| 入口（均在 `prototypes/3d/`） | 功能 | 不应误用的边界 |
| --- | --- | --- |
| `inspect_powerplant_source.py` | 提取 SHP 层与来源哈希 | 固定电厂资源名/帧；缺资源会跳过，须核对报告 |
| `author_reference_powerplant.py` | 创建几何、材质、光照、参考和特效锚点 | 固定电厂资产、尺寸、输出路径；重跑会覆写 authoring 文件 |
| `calibrate_reference_projection.py` | 校准相机及参考平面 | 固定屋顶中心、参考对象名和 Architecture 集合；即使不保存 blend 仍写固定校准报告 |
| `render_reference_review.py` | 从保存模型输出 Cycles PNG，可保存完整review场景 | 虽有 `--blend`，仍调用电厂校准，不能直接拿来渲染任意建筑 |
| `powerplant_pipework.py` | 有切线弯头/内凹开口的真实管网、物理尺度UV | 可参考/抽取算法，接口和调用数据需按新资产调整 |
| `powerplant_reference_textures.py` | six-tile atlas、分材质物理UV和接头油污 | 固定材质名、tile布局、油污位置；不是任意模型自动贴图器 |
| `measure_reference_fit.py` | 实际 mesh 的选定定位点距离 | 固定电厂标注与相机；必须为新资产重选点 |
| `audit_render_regions.py` | 固定区域的全部像素MAE/RMSE和局部变化 | 固定1280×853及电厂区域；必须为新资产重设ROI |
| `bake_reference_model.py` / `prepare.py` | 烘焙与浏览器资源准备 | 当前网页GLB/旧动画未跟随本轮重导出；需要时另做验证 |

新资产应先抽离相机/路径/名称/地标/ROI为其自己的数据，或创建独立作者脚本；仅修改一个文件名并不能泛化这些程序。参考平面重投影残差只说明数学变换自洽，不是模型相似度。

## 环境与输入预检

电厂制作时用的是本地官方 `.cache/blender/Blender.app/Contents/MacOS/Blender`，报告版本5.2.1 LTS。先检查该文件，缺失时选择已有的其他 Blender，不默认下载指定版本。作者/渲染代码使用 `scene.compositing_node_group`、新版 Glare 节点输入和 `Khronos PBR Neutral` 显示变换；选择其他版本时检查这些实际接口，不能只凭可导入 `bpy` 就认定兼容。

Python 分开考虑：提取脚本需要 Pillow/pycryptodome；dense audit 需要 Pillow/NumPy；Blender 自带 `bpy` 和其运行时依赖。不能假设现有素材 venv 已装 NumPy。

提取脚本导入 `scripts/assets/export_assets.py`，需要完整准备过的缓存，包含所需归档/调色板、`raw/art.ini`、`raw/rules.ini` 和 language/cameo 数据，不能只准备几份 MIX。显式指定 `RA2_ASSET_CACHE`；相关脚本默认目录并不全部一致。

本地来源报告验证了 `ngpowr.shp` 的6帧和 `ngpowr_a.shp` 的76帧。未提取到的建造 SHP 不能声称已核对。只查看了哪些帧，就记录哪些帧。

从仓库根目录先做只读检查：

```sh
python3 .agents/skills/ra2-hd-blender/scripts/check_inputs.py
```

作者脚本在缺少 atlas 时可能静默退回程序材质，所以通过运行/保存本身不能证明复现成功。检查失败时停止认可版本的重建，找回缺失资产；若任务允许生成替代品，应另存新候选、更新其输入记录，而不是篡改已认可哈希。

## 本地复现命令

仅看认可版本时直接打开 review blend/PNG。需要重建时，先把当前认可的 authoring、review与PNG保留为独立版本，再执行下面命令；无需起网站。命令用 `&&` 串接：输入检查或建模失败后不会继续渲染旧文件。把 `review-next` 改为本次尚未使用的目录，保留既有版本。

```sh
RA2_BLENDER='.cache/blender/Blender.app/Contents/MacOS/Blender'
RA2_REVIEW_OUT='.cache/prototype-3d/blender-reference/review-next'
python3 .agents/skills/ra2-hd-blender/scripts/check_inputs.py && \
mkdir -p "$RA2_REVIEW_OUT" && \
RA2_SKIP_RENDER=1 RA2_USE_REFERENCE_ATLAS=1 "$RA2_BLENDER" \
  --background --factory-startup --python-exit-code 1 \
  --python prototypes/3d/author_reference_powerplant.py && \
"$RA2_BLENDER" --background --factory-startup --python-exit-code 1 \
  --python prototypes/3d/render_reference_review.py -- \
  --output "$RA2_REVIEW_OUT/render.png" --samples 128 --scale 2 \
  --checker-background --save-review-blend "$RA2_REVIEW_OUT/review.blend"
```

需要定位差异时，用带 Pillow/NumPy 的 Python：

```sh
RA2_AUDIT_PYTHON=python3
"$RA2_AUDIT_PYTHON" -c 'import PIL, numpy' && \
"$RA2_AUDIT_PYTHON" prototypes/3d/audit_render_regions.py \
  --before .cache/prototype-3d/blender-reference/powerplant-reference-textured-2560.png \
  --render "$RA2_REVIEW_OUT/render.png" > "$RA2_REVIEW_OUT/regions.json"
```

报告保存每个区域的绝对颜色误差，不能称为“差几个像素”。本例原先的22点/2.7px和参考平面的近零重投影误差均不是整体验收标准。最终仍需检查真实渲染、局部结构和表面质感。
