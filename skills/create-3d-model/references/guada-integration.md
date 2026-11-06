# GuaDa 集成契约

本文档是本插件与 `guada-blender` 运行时的**唯一映射表**。原始技能文本里出现的
BlenderMCP、固定 MCP 工具名、Codex/Claude 指令、外部控制端口**一律作废**，
以本文件与 `blender_helper_catalog` 的输出为准。

## 运行时形态

- 插件注册 **1 个编排技能**（`create-3d-model`）+ **29 个领域模块技能**。
- 每个模块技能通过 `skill_learn` 加载；其 `references/` 资源以插件目录为根。
- 确定性脚本不猜路径，统一用 `blender_helper_catalog` 查名字与参数，再用 `blender_helper_run` 执行。

## 工具映射

| 原文工具 | GuaDa 工具 | 说明 |
|---|---|---|
| `blender_status` | `blender_status` | 同义 |
| `blender_scene_info` | `blender_scene_info` | 同义 |
| `blender_object_info` | `blender_scene_info({ object_name })` | 单对象细节 |
| `blender_import` | `blender_import` | 同义 |
| `blender_python` | `blender_python` | 同义 |
| `blender_preview` | `blender_preview` | 同义 |
| `blender_render` | `blender_render` | 同义 |
| `blender_render_frames` | `blender_render_frames` | 帧号表达式 |
| `blender_export` | `blender_export` | 同义 |
| `blender_validate_scene` | `blender_validate_scene` | 同义 |
| `blender_validate_export` | `blender_validate_export` | 同义 |
| `blender_helper_catalog` | `blender_helper_catalog` | 同义 |
| `blender_helper_run` | `blender_helper_run` | `arguments_json` |
| `read_image` | `image_view` | 看图 |
| `Bash`（跑 Python 脚本） | `blender_helper_run` 或 `blender_run_script` | 优先 helper |

## 路径契约

- 所有 `*_path` 参数相对当前会话 workspace 解析。
- 输入文件必须已存在；输出默认**不允许覆盖**（`allow_overwrite=true` 显式开启）。
- 越界路径（`../`、workspace 外的绝对路径、符号链接逃逸）直接拒绝。
- `blender_run_script` 只校验脚本路径；脚本内部读写由脚本自身决定（与直接运行 Python 同权限）。

## 视觉证据

- `blender_preview` / `blender_render` / `blender_render_frames` / helper 的图片产物会以
  `imageRefs` 返回，聊天里可直接查看；模型侧用 `image_view` 读盘再看。
- 渲染文件存在 ≠ 视觉验收通过。**必须先看图再声明完成**。

## 辅助环境

- 分析 Python（helper）：`blender_status.analysis` 报告可执行文件、版本与包。
- 缺依赖时：`blender_helper_catalog(include_unavailable=true)` 会列出 `missing`；
  `blender_helper_run` 直接拒绝并给出指引，不会静默降级。
- `wireframe-analyzer`、`mask-to-mesh-recipe`、`source-locked-skin-recipe` 依赖 scipy，
  本插件标记为 `requires-scipy`，默认不收录。

## 安全边界

- `blender_python` / `blender_run_script` 与本机 Python 同权限：只运行可信代码。
- 不下载资源、不访问凭据、不安装包、不启动无关进程。
- 每次调用使用独立临时目录，结束后清理。
