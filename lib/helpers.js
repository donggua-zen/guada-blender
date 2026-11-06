'use strict';

/**
 * Helper 白名单目录（Phase 3）
 *
 * 只收录本机 Python 3.13 已具备依赖（numpy / opencv / Pillow）的确定性 helper。
 * 需要 scipy 的 helper（wireframe-analyzer、contour-to-mesh）暂不收录。
 */

const HELPERS = [
  {
    name: 'animation-contact-sheet',
    module: 'animation-quality-gate',
    description:
      '把动画帧拼成带标签的 contact sheet，并标记帧间视觉跳变。',
    runtime: 'python',
    dependencies: ['Pillow'],
    script: 'animation-quality-gate/scripts/animation_contact_sheet.py',
    arguments: [
      { name: 'frames', flag: '--frames', type: 'path-array', pathKind: 'input-file', required: true },
      { name: 'out_image', flag: '--out-image', type: 'path', pathKind: 'output-file', required: true },
      { name: 'out_report', flag: '--out-report', type: 'path', pathKind: 'output-file', required: true },
      { name: 'cols', flag: '--cols', type: 'integer' },
    ],
  },
  {
    name: 'reference-manifest-compiler',
    module: 'reference-analysis-validator',
    description:
      '分类参考图并编译尺寸、掩码、连通域、bbox、质心等机器可读证据。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'reference-analysis-validator/scripts/reference_manifest_compiler.py',
    arguments: [
      { name: 'inputs', positional: true, type: 'path-array', pathKind: 'input-path', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      {
        name: 'mode',
        flag: '--mode',
        type: 'string',
        choices: ['auto', 'alpha', 'edges', 'bright_on_dark', 'dark_on_bright'],
      },
      { name: 'min_area', flag: '--min-area', type: 'integer' },
    ],
  },
  {
    name: 'render-overlay-validator',
    module: 'reference-analysis-validator',
    description:
      '测量参考图/渲染图的重叠与误差指标，可选输出混合 overlay。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'reference-analysis-validator/scripts/render_overlay_validator.py',
    arguments: [
      { name: 'reference', flag: '--reference', type: 'path', pathKind: 'input-file', required: true },
      { name: 'render', flag: '--render', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      { name: 'overlay', flag: '--overlay', type: 'path', pathKind: 'output-file' },
      {
        name: 'mode',
        flag: '--mode',
        type: 'string',
        choices: ['auto', 'alpha', 'edges', 'bright_on_dark', 'dark_on_bright'],
      },
      {
        name: 'reference_mode',
        flag: '--reference-mode',
        type: 'string',
        choices: ['auto', 'alpha', 'edges', 'bright_on_dark', 'dark_on_bright'],
      },
      {
        name: 'render_mode',
        flag: '--render-mode',
        type: 'string',
        choices: ['auto', 'alpha', 'edges', 'bright_on_dark', 'dark_on_bright'],
      },
    ],
  },
  {
    name: 'silhouette-validator',
    module: 'reference-to-3d',
    description: '比较参考图与渲染图的轮廓：overlap、bbox、像素误差。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'reference-to-3d/scripts/silhouette_validator.py',
    arguments: [
      { name: 'reference', flag: '--reference', type: 'path', pathKind: 'input-file', required: true },
      { name: 'render', flag: '--render', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      { name: 'threshold', flag: '--threshold', type: 'integer' },
    ],
  },
  {
    name: 'template-analyzer',
    module: 'reference-to-3d',
    description:
      '从参考图提取模板掩码与排序后的连通域，保留细长线特征。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'reference-to-3d/scripts/template_analyzer.py',
    arguments: [
      { name: 'image', flag: '--image', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      {
        name: 'mode',
        flag: '--mode',
        type: 'string',
        choices: ['auto', 'alpha', 'bright_on_dark', 'dark_on_bright', 'edges'],
      },
      { name: 'min_area_frac', flag: '--min-area-frac', type: 'number' },
      { name: 'min_score_frac', flag: '--min-score-frac', type: 'number' },
      { name: 'canny1', flag: '--canny1', type: 'integer' },
      { name: 'canny2', flag: '--canny2', type: 'integer' },
      { name: 'dilate', flag: '--dilate', type: 'integer' },
      { name: 'mask_out', flag: '--mask-out', type: 'path', pathKind: 'output-file' },
    ],
  },
  {
    name: 'segment-source-parts',
    module: 'source-part-segmentation',
    description:
      '分割参考图中的视觉部件，输出掩码与清单（可选 watershed）。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'source-part-segmentation/scripts/segment_source_parts.py',
    arguments: [
      { name: 'image', flag: '--image', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out_dir', flag: '--out-dir', type: 'path', pathKind: 'output-dir', required: true },
      {
        name: 'mode',
        flag: '--mode',
        type: 'string',
        choices: ['auto', 'alpha', 'dark_lines', 'bright_on_dark'],
      },
      { name: 'min_area', flag: '--min-area', type: 'integer' },
      { name: 'watershed', flag: '--watershed', type: 'boolean' },
    ],
  },
  {
    name: 'seeded-part-masks',
    module: 'source-part-segmentation',
    description: '按显式 seed/part 清单生成确定性的命名部件掩码与清单。manifest 需含 image（绝对路径）与 parts[{name,bbox}]。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'source-part-segmentation/scripts/seeded_part_masks.py',
    arguments: [
      { name: 'manifest', flag: '--manifest', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out_dir', flag: '--out-dir', type: 'path', pathKind: 'output-dir', required: true },
    ],
  },
  {
    name: 'atlas-region-detector',
    module: 'atlas-uv-fitting',
    description: '检测图集/贴花中的占用区域并输出归一化 UV 矩形。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'atlas-uv-fitting/scripts/atlas_region_detector.py',
    arguments: [
      { name: 'image', flag: '--image', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      {
        name: 'mode',
        flag: '--mode',
        type: 'string',
        choices: ['auto', 'alpha', 'bright_on_dark', 'dark_on_bright'],
      },
      { name: 'min_area', flag: '--min-area', type: 'integer' },
      { name: 'pad', flag: '--pad', type: 'integer' },
    ],
  },
  {
    name: 'atlas-region-mapper',
    module: 'atlas-uv-fitting',
    description: '把部件清单与图集区域匹配，输出排序后的候选映射。parts 需含 bbox_px（regions 由 atlas-region-detector 生成）。',
    runtime: 'python',
    dependencies: [],
    script: 'atlas-uv-fitting/scripts/atlas_region_mapper.py',
    arguments: [
      { name: 'parts', flag: '--parts', type: 'path', pathKind: 'input-file', required: true },
      { name: 'regions', flag: '--regions', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      { name: 'max_candidates', flag: '--max-candidates', type: 'integer' },
    ],
  },
  {
    name: 'contour-correspondence-report',
    module: 'texture-driven-mesh-fitting',
    description: '测量源掩码与产物掩码之间的轮廓位移。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'texture-driven-mesh-fitting/scripts/contour_correspondence_report.py',
    arguments: [
      { name: 'source_mask', flag: '--source-mask', type: 'path', pathKind: 'input-file', required: true },
      { name: 'product_mask', flag: '--product-mask', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      { name: 'samples', flag: '--samples', type: 'integer' },
    ],
  },
  {
    name: 'look-fit-report',
    module: 'reference-look-calibration',
    description: '比较参考图与产物的裁切、亮度、饱和度、色相、强调色与对象掩码。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'reference-look-calibration/scripts/look_fit_report.py',
    arguments: [
      { name: 'reference', flag: '--reference', type: 'path', pathKind: 'input-file', required: true },
      { name: 'product', flag: '--product', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      { name: 'overlay', flag: '--overlay', type: 'path', pathKind: 'output-file' },
      { name: 'accent_hue_min', flag: '--accent-hue-min', type: 'integer' },
      { name: 'accent_hue_max', flag: '--accent-hue-max', type: 'integer' },
    ],
  },
  {
    name: 'multiview-fit-report',
    module: 'multiview-fit-loop',
    description: '比较已配准的 front/side/back/top 模板与渲染对，输出指标与 overlay。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'multiview-fit-loop/scripts/multiview_fit_report.py',
    arguments: [
      { name: 'front_template', flag: '--front-template', type: 'path', pathKind: 'input-file' },
      { name: 'front_render', flag: '--front-render', type: 'path', pathKind: 'input-file' },
      { name: 'side_template', flag: '--side-template', type: 'path', pathKind: 'input-file' },
      { name: 'side_render', flag: '--side-render', type: 'path', pathKind: 'input-file' },
      { name: 'back_template', flag: '--back-template', type: 'path', pathKind: 'input-file' },
      { name: 'back_render', flag: '--back-render', type: 'path', pathKind: 'input-file' },
      { name: 'top_template', flag: '--top-template', type: 'path', pathKind: 'input-file' },
      { name: 'top_render', flag: '--top-render', type: 'path', pathKind: 'input-file' },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      { name: 'overlay_dir', flag: '--overlay-dir', type: 'path', pathKind: 'output-dir', required: true },
    ],
  },
  {
    name: 'register-orthographic-views',
    module: 'orthographic-registration',
    description: '测量各正交视图的图像范围并输出共享配准契约。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'orthographic-registration/scripts/register_views.py',
    arguments: [
      { name: 'images', positional: true, type: 'path-array', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
    ],
  },
  {
    name: 'view-constraint-report',
    module: 'multiview-constraint-solver',
    description: '读取各视图 bbox JSON，检测共享轴尺寸冲突并给出规范策略建议。',
    runtime: 'python',
    dependencies: [],
    script: 'multiview-constraint-solver/scripts/view_constraint_report.py',
    arguments: [
      { name: 'input', flag: '--input', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      { name: 'tolerance', flag: '--tolerance', type: 'number' },
    ],
  },
];

const HELPER_BY_NAME = new Map(HELPERS.map((helper) => [helper.name, helper]));

/**
 * 已知但本版本不收录的 helper（缺依赖或与建模无关）。
 * catalog 在 include_unavailable=true 时展示；helper_run 直接拒绝并给出原因。
 */
const UNSUPPORTED = [
  {
    name: 'wireframe-analyzer',
    module: 'wireframe-to-3d',
    description: '从线框/技术图提取简化轮廓与贝塞尔拟合。',
    dependencies: ['opencv-python-headless', 'numpy', 'scipy'],
    reason: 'requires-scipy',
  },
  {
    name: 'mask-to-mesh-recipe',
    module: 'contour-to-mesh',
    description: '从掩码生成三角化网格 recipe。',
    dependencies: ['opencv-python-headless', 'numpy', 'scipy'],
    reason: 'requires-scipy',
  },
  {
    name: 'source-locked-skin-recipe',
    module: 'contour-to-mesh',
    description: '生成源锁定前表面 recipe 与二值掩码。',
    dependencies: ['opencv-python-headless', 'numpy', 'scipy'],
    reason: 'requires-scipy',
  },
  {
    name: 'skill-graph-audit',
    module: 'blender-skill-harmonizer',
    description: '审计技能图引用完整性（发布工具）。',
    dependencies: [],
    reason: 'maintenance',
  },
  {
    name: 'release-readiness-check',
    module: 'quality-refinement-autoloop',
    description: '技能包发布前检查（发布工具）。',
    dependencies: [],
    reason: 'maintenance',
  },
  {
    name: 'sanitize-skill-contributions',
    module: 'quality-refinement-autoloop',
    description: '扫描技能源中的项目特定术语（发布工具）。',
    dependencies: [],
    reason: 'maintenance',
  },
];

const UNSUPPORTED_BY_NAME = new Map(UNSUPPORTED.map((item) => [item.name, item]));

function getHelper(name) {
  return HELPER_BY_NAME.get(String(name || ''));
}

function getUnsupported(name) {
  return UNSUPPORTED_BY_NAME.get(String(name || ''));
}

function listHelpers(options = {}) {
  const { module, includeUnavailable = false, isAvailable } = options;
  return HELPERS.filter((helper) => !module || helper.module === module).filter(
    (helper) => includeUnavailable || !isAvailable || isAvailable(helper),
  );
}

module.exports = {
  HELPERS,
  HELPER_BY_NAME,
  UNSUPPORTED,
  UNSUPPORTED_BY_NAME,
  getHelper,
  getUnsupported,
  listHelpers,
};
