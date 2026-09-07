# 第一步：从低清原图生成保真参考

默认用内置 ImageGen 生成一张供 Meshy 使用的参考，保持原图 vibe 与结构；不默认追求最高质量或反复生成。已有认可参考时直接送往 Meshy。

## 原素材核对

从明确的资产身份开始，记录源归档、资源名、帧号、调色板、尺寸、文件哈希和本地路径。RA2 的显示名、INI Image 名和实际 SHP 名可能不同；先读配置/已提取记录再挑文件。

- 建筑 SHP 可能拆分静态底座、工作动画、建造帧、损坏帧与阴影。按需要分别看相关层，避免把阴影、光晕或动画瞬间当作实体轮廓。
- 最近邻放大适合观察原始像素，但它不是高清重建；保留原分辨率文件作为来源。
- VXL/HVA 若已有可恢复的原厂体素形状，优先保留它，按需要补材质和细节，不必重造已知几何。
- 不为本步骤执行原游戏安装器/游戏程序。仓库的提取器读取本地文件；完整素材准备流程另见仓库 `scripts/assets/README.md`。

原厂身份与高清目标分别留档。生成模型可能补错隐藏细节，不能把补画内容回写成“EA 的原始设计”。用户提供新参考或修正时，保存新版本及选择理由，保留旧记录。

## 通用参考图提示词

从本仓库盟军建造厂的实际成功提示词（`prototypes/3d/allied-construction-yard/hd-prompt.txt`）抽取通用约束。保留轮廓、投影、比例、组件位置与负空间、阵营配色、可信材质、适度磨损、完整取景和保守补全；把具体建筑身份及构件换成输入中真正观察到的内容。适用于建筑、兵种、车辆、船只等单位，不需要逐类另写流程。

替换方括号后再提交；只列对该单位辨识度重要、且源图支持的结构。不要沿用盟军基地的起重机、屋顶、地基，也不要默认每个单位都是金属机械或带有基座。以实际姿态、方向和可见部件为准，不臆造对称性或被遮挡结构。

```text
Use case: style-transfer. Create a faithful high-definition modeling reference
of the original Red Alert 2 [unit identity and asset ID, if known].

Input image: [actual original game sprite / voxel reference, with the relevant
frame, layers, pose and facing]. [Describe any additional input and its role.]
Use this source as the evidence for the unit's design.

Preserve precisely the source silhouette, projection, proportions, component
count, placements, pose, orientation and negative spaces. Preserve the original
palette, faction/team-color regions and overall visual character.
Observed defining structures: [brief list grounded in the supplied image].
Confirmed corrections, if any: [actual user decisions; otherwise omit].

Do not redesign, add unsupported parts, enlarge dominant forms or add a display
base absent from the source. Preserve the source projection and parallel edges
where present. Match the original view and framing: full subject, modest margin.

Use physically plausible materials appropriate to the observed subject:
[material assignments supported by the image]. Keep surface detail restrained
and readable. Where wear is appropriate, use localized edge wear and joint grime;
preserve clean regions and the original finish. No toy-plastic appearance,
excessive rust or uniform noise. Do not let added detail change the silhouette
or the appearance when reduced to the source size.

Neutral charcoal background, unless another background is requested.
No added text, scenery or watermark. Hidden surfaces remain conservative.
Output a clear reference at [requested/available image size], with faithful
structure and visual character taking priority over extra detail.
```

“缩小后匹配源图”是视觉目标，不是 ImageGen 能保证的像素一致性。输入可能有阴影、烟雾、光效或水面痕迹，应标明其角色，避免 Meshy 把它们当成实体。输出尺寸与 API quality 是不同设置；内置工具未暴露的参数不虚构。

## 生成、检查和冻结

用真正的源图作为图像输入，记录实际发送的 prompt 和生成方式。实际输出的尺寸、色彩模式、透明通道应另行检查：提示词写了“透明”并不代表文件有 alpha，棋盘格可能已经画进 RGB 图像里。

先与源图核对轮廓、组件数量和大比例，再检查质感。未获认可的候选不能替换已认可基准。不要为适应后续工具而反向拉伸、旋转或重画认可的参考图。

记录至少包含：asset id、各输入路径/哈希及角色、实际输出路径/尺寸、prompt 路径、工具方式、选择依据、已确认修正和待推断区域。当前环境给出的输出路径才是真实来源；不要虚构 seed、模型版本或可完全复现的生成承诺。

对本仓库，把图片与生成物保存到 `.cache/` 下资产专属目录；文本 prompt 和参数可以进入版本管理。冻结一份认可参考，后续颜色/材质/结构比较都指向它。

新资产可从下面的输入清单开始，只列本阶段真实存在的文件：

```json
{
  "version": 1,
  "asset": "allied-barracks",
  "inputs": {
    "original_sprite": {
      "path": ".cache/prototype-3d/allied-barracks/reference/source.png"
    }
  }
}
```

以 `check_inputs.py --manifest 清单路径 --root 仓库根目录` 检查；未填写期望 `sha256` 时只报告存在性与实际指纹。冻结输入后填写其真实 `sha256`，在高清图/材质图实际保存后再添加对应角色。不要预填虚构的哈希或把尚未生成的输入标为就绪。


## 可选：手工 Blender 编辑的辅助表面材质

仅在用户要求手工材质编辑时使用；默认由 Meshy 生成 texture/PBR，不另行生成材质 atlas。

当纯程序噪声仍像塑料、石头或均匀脏点，可另生成表面颜色纹理作为第二步的辅助输入。它不是新的建筑外形基准。

请求正对表面、均匀照明、无透视、无反光、无阴影、无构件的 albedo 样本。明确材质和磨损方式；不要把管道、球体、铆钉或大块灯光画进贴图。法线、凹凸和粗糙度需由可靠的表面信息分别设定，不能把所有暗色油污都压成坑。

电厂采用六格 atlas 的 [实际生成提示词](powerplant-material-atlas-prompt.txt) 可作为材质样本布局参考。六种材质及布局仅属于本例；下一件资产按自身需要选择。检查返回图片的实际尺寸，不能把 prompt 中期望的 3072×2048 当成已获得的分辨率。

## 历史电厂提示词的边界

[早期电厂高清候选提示词原文](powerplant-hd-prompt-historical.txt) 是真实调用的保存记录，**不是当前推荐模板**：它曾写 `EGG-SHAPED`，后来用户明确要求正球体；它要求透明背景，实际候选为无 alpha 的 RGB PNG。最终目标是用户另行指定的 JPEG，不能把旧候选直接当成最终基准。具体文件见实例记录。
