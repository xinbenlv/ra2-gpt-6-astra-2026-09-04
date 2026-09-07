# Meshy 调用与交付

## 本仓库已成功的实例

2026-09-06 盟军建造厂的 Meshy 结果已由用户在 Blender 中手动审阅并认可。输入实际来自 OpenAI Image API 的 `quality=low` 候选，而非内置 ImageGen 的低质量参数。用户随后指定今后的默认入口为内置 ImageGen；不要把两者的调用记录混写。

- 输入：`.cache/prototype-3d/allied-construction-yard/reference/openai-image2-low.png`，1410×1116。
- SHA-256：`96dba2afcc1370f82e1e903f18e2ca40fa2e44ed6e5d819d1651151fb866135a`。
- 提示词原文：仓库 `prototypes/3d/allied-construction-yard/hd-prompt.txt`；其他单位使用 [通用模板](source-to-hd.md#通用参考图提示词)。
- 结果目录：`.cache/prototype-3d/allied-construction-yard/meshy-low-v1/`。
- 实际消费 30 credits，约 197 秒；这是本次记录，不是后续价格或时长承诺。

该次请求在图片输入之外使用：

```json
{
  "model_type": "standard",
  "ai_model": "meshy-7",
  "ultra_mode": false,
  "should_texture": true,
  "enable_pbr": true,
  "texture_resolution": "2k",
  "should_remesh": false,
  "image_enhancement": false,
  "target_formats": ["glb", "fbx"]
}
```

以上包含 FBX 的参数是历史调用记录，不是默认保留清单。新请求在当前 API 支持时仅请求 GLB，额外导出格式按需选择。下一次调用前核对 [Meshy 官方文档](https://docs.meshy.ai/) 的当前 schema、模型和账户限制，不盲目照搬已失效的参数。默认关闭额外图片增强，沿用已选参考。上面的 should_remesh=false 是历史母版生成参数；当前默认交付还要进行约 3 万面本地优化，见 [轻量 GLB 流程](runtime-optimization.md)。不要把该高模下载结果直接作为游戏完成品。

## 提交与恢复

该次使用 `https://api.meshy.ai/openapi/v1/image-to-3d`：POST 创建任务，GET `/<task_id>` 查询状态。图片以该 API 支持的 data URI 或图片 URL 提供；认证只送往 Meshy 官方 API。

提交前查找本次输出目录已有的 task ID 和状态；成功任务直接下载，进行中的任务继续查询。保存不含凭据的输入指纹、实际参数和 task ID，以便连接中断后恢复。一次任务授权不代表无限重试；创建响应不明确时先找回任务，避免重复扣费。

终态成功后按实际返回 URL 下载资源。失败时保留错误码与消息并报告；不要将失败标为完成。下载失败优先重下同一任务的结果，链接过期则重新查询该任务，不重新生成模型。

## 文件检查与输出

- GLB：检查 glTF 中的 mesh、primitive 和材质引用；base color、metallic/roughness、normal 的图片必须内嵌或有可用外部文件。
- 自包含 GLB 已满足材质需求时，不默认下载重复的独立纹理、FBX、预览或 ZIP；仅在缺失贴图、独立编辑或用户要求时补取，并验证实际格式与尺寸。
- 默认发布高清参考图、生成记录与约 3 万面的轻量 GLB；原始 GLB 仅作本地优化输入和按需留存的母版。保存输入图顺序、路径、哈希以及实际提示词、模型版本、参数、task ID；已有缺失信息标为未知，不虚构。具体留存规则见 [主技能](../SKILL.md#2-meshy-生成与精简留存)。
- 保存文件清单、哈希、实际面数和纹理尺寸，提供实际保留文件的入口。不默认制作额外模型 ZIP 或 Blender 文件。

本例 GLB 实测为 1 个 mesh、1 个材质、1,943,266 个三角面，3 张内嵌图片；另下载了 base color、metallic、roughness、normal 四张 2048×2048 PNG。高面数是未 remesh 的本次输出，不应当成所有资产的目标。

模型下载完成只代表取得优化输入；默认还须完成约 3 万面游戏 GLB 的本地优化、真实加载与画质检查。用户明确只要生成原件时遵循其范围。只有用户提出时才额外保存或打开 Blender 审阅文件。
