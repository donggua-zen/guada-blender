# 端到端角色用例（E2E）

脚本：`scripts/e2e-character.mjs`
用途：按 `create-3d-model` 技能里写的顺序，用真实工具跑一遍完整链路，产出可复现的证据。
CI 不跑（需要本机 Blender + 分析 Python）。

## 运行

```bash
node scripts/e2e-character.mjs

# 覆盖输入
E2E_WORKSPACE=D:/AI/ai_chat \
E2E_BLEND=tmp/taila/taila-retarget.blend \
E2E_REF=tmp/taila/preview-front.png \
E2E_OUT=tmp/e2e-character \
node scripts/e2e-character.mjs
```

环境变量：

| 变量 | 默认 | 说明 |
|---|---|---|
| `E2E_WORKSPACE` | `D:/AI/ai_chat` | 会话 workspace（所有相对路径的根） |
| `E2E_BLEND` | `tmp/taila/taila-retarget.blend` | 被测 `.blend` |
| `E2E_REF` | `tmp/taila/preview-front.png` | 参考图 |
| `E2E_OUT` | `tmp/e2e-character` | 产物目录（相对 workspace） |
| `E2E_BLENDER` | 本机便携版路径 | Blender 可执行文件 |
| `E2E_PYTHON` | Python 3.13 | 分析 Python |

## 步骤

| # | 步骤 | 验证什么 |
|---|---|---|
| 1 | `blender_status` | 环境探测（Blender/分析 Python/helper 数/技能数） |
| 2 | `reference-manifest-compiler` | 参考图度量（尺寸/组件/bbox） |
| 3 | `segment-source-parts` | 部件分割 + 掩码 |
| 4 | `blender_scene_info` | 场景只读检查 |
| 5 | `blender_preview` | 临时相机预览（blockout 证据） |
| 6 | `blender_render` | 正式渲染 |
| 7 | `silhouette-validator` | 参考 vs 渲染的轮廓指标 |
| 8 | `blender_validate_scene(web)` | 结构审计 |
| 9 | `blender_export → GLB` | 导出 |
| 10 | `blender_validate_export(web)` | 干净进程回读审计 |
| 11 | `blender_render_frames("1,5,10")` | 多帧渲染 |

## 参考运行记录（2026-11-06）

环境：Windows 11 / Blender 4.5.15 LTS / Python 3.13.6（numpy 2.4.6、opencv 5.0、Pillow 12.2、scipy 1.18）
资产：`tmp/taila/taila-retarget.blend`（47MB，28 objects / 15 materials）、`tmp/taila/preview-front.png`

| 步骤 | 结果 | 耗时 |
|---|---|---|
| `blender_status` | available，Blender 4.5.15 LTS，analysis 3.13.6，**helpers 17**，**skills 30** | 1.2s |
| `reference-manifest-compiler` | `reference_manifest.v1` | 1.1s |
| `segment-source-parts` | 5 个部件 + 5 张掩码 | 0.8s |
| `blender_scene_info` | Scene / 28 objects / 15 materials | 3.1s |
| `blender_preview` | 293,606 bytes，`imageRefs=1` | 4.8s |
| `blender_render` | 441,148 bytes，`imageRefs=1` | 4.6s |
| `silhouette-validator` | `iou=0.131`，`centroidDistance=19.34px` | 0.5s |
| `blender_validate_scene(web)` | `passed=true`，0 errors / 0 warnings | 2.8s |
| `blender_export` | `model.glb` 3,454,892 bytes | 28.7s |
| `blender_validate_export(web)` | `passed=true`，导入 26 objects | 4.7s |
| `blender_render_frames` | 3 张 PNG，`imageRefs=3` | 5.2s |

**11/11 全绿，failed=0。**

报告：`tmp/e2e-character/e2e-report.json`
图片：`tmp/e2e-character/{preview.png,render.png,frames/*.png}`

### 关于 `iou=0.131`

参考图是**立绘**（透明背景、正面正交），渲染是**3D 预览**（等距视角、深色背景）。
两者前景比例差 7 倍，`iou` 低是**模态不一致**导致，不是模型错误——`render-overlay-validator`
的报告里也有同样的 warning。正确做法是对同模态图比较（渲染 vs 渲染，或线稿 vs 线稿）。

## 判定

- 所有步骤 `ok=true` → E2E 通过。
- 任一步失败 → 退出码 1，`e2e-report.json` 里保留错误摘要。
- 视觉证据（preview/render/frames）必须人工用 `image_view` 看过再声明完成。
