---
name: atlas-uv-fitting
description: Detect texture-atlas regions and map each source part to its own UV rectangle or projected UV surface. Use when a texture pack must fit a Blender model 1:1, when textures look off/stretched, when alpha decals or lightmaps are provided, or before exporting a textured GLB for a brand mascot/logo.
when_to_use: Texture atlas region detection, per-part UV mapping, front-projected UVs, decal/lightmap handling, texture validation against source templates.
allowed-tools: Read Bash Glob Grep blender_python blender_scene_info
---

> **本技能运行在 GuaDa Blender 插件上。**
>
> 工具名映射：`blender_python` → `blender_python`；`blender_scene_info` → `blender_scene_info`；
> `blender_object_info` → `blender_scene_info({ object_name })`；`read_image` → `image_view`；
> 确定性脚本一律通过 `blender_helper_catalog` / `blender_helper_run` 调用。
>
> 原文中的 **BlenderMCP、固定 MCP 工具名、外部控制端口、Codex/Claude 专属指令**一律作废。
> 所有 `*_path` 必须在当前会话 workspace 内；输出默认不覆盖（需要时显式 `allow_overwrite=true`）。
> 渲染/预览成功后必须用 `image_view` 真的看图，再判断是否完成。

# Atlas UV Fitting

This skill exists because assigning a texture material is not the same as fitting a texture.

## Supplemental map sanity rule

Do not blindly wire emissive/roughness/bump/lightmap images into every atlas-mapped part. First verify the supplemental map has the same UV layout and semantic region as the basecolor. If it contains aura dots, guide marks, lightmap blobs, or decorations outside the part, leave it disconnected for that mesh and use constant roughness/bump plus explicit edge/glow geometry instead.

## Hard rules

- Atlas textures must be mapped by region; never apply the full atlas to every structural mesh.
- Front-facing hero surfaces use front-projected UVs or a source-region rectangle.
- Side/back surfaces use their own UV islands or procedural/baked fills.
- Roughness, bump, normal, AO, and lightmap images are `Non-Color`.
- Alpha decals must use alpha-connected materials and no black backing planes.
- Base GLB should not include reference planes or optional aura unless explicitly requested.

## Workflow

1. Run `scripts/atlas_region_detector.py` on basecolor/decal/aura atlases.
2. Name regions semantically in `atlas_regions.json`.
3. Create/activate UV map per mesh.
4. Remap local 0-1 UVs into the matching atlas rectangle.
5. Audit the GLB/export material node graph: Principled BSDF + Image Texture nodes.
6. Render texture overlay validation before export.

## Sources distilled

- Blender UV/Image Texture node uses UV maps for rendered/exported texture output.
- Blender baking needs UV maps and active image targets.
- Blender glTF exporter is most reliable with Principled BSDF, UVs, textures, normals.
- Khronos glTF PBR: base color, metallic/roughness, normal maps are standard channels.


## Semantic atlas mapping

Region detection is only a candidate list. For source-locked work, create an `atlas_part_map.json` that binds each structural part name to exactly one atlas region or declares `procedural/no_texture`.

Mapping order:

1. Detect candidate regions from basecolor/decal/lightmap.
2. Reject decorative/aura/composite-preview regions unless the target is context/aura.
3. Match structural parts by role, aspect ratio, and relative size.
4. Manually rename ambiguous regions before automated UV assignment.
5. Verify supplemental maps share the same region layout before connecting roughness/bump/emission/lightmap.

Do not map a full rosette/composite atlas region onto individual petals unless the mesh is a single rosette sheet. Individual meshes need individual source regions.

## Additional script

- `scripts/atlas_region_mapper.py` proposes part→atlas-region mappings using aspect/size similarity. Treat output as a draft; semantic names still win.
