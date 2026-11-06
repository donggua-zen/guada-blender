/* Built by build.mjs — do not edit dist by hand. Source: frontend/src/settings-page.js */
/* GuaDa Blender — Settings page (render-function component).
 *
 * Contract: IIFE, registers through window.__GuaDaModuleLoader__.
 * Vue + API from window.__GuaDaShared__.
 */
(function () {
  'use strict';

  var shared = window.__GuaDaShared__;
  if (!shared || !shared.vue || !shared.pluginApi) {
    console.error('[guada-blender] shared runtime is missing');
    return;
  }

  var h = shared.vue.h;
  var ref = shared.vue.ref;
  var reactive = shared.vue.reactive;
  var onMounted = shared.vue.onMounted;

  var PLUGIN_ID = 'guada-blender';

  var S = {
    root: { padding: '16px 20px', fontSize: '13px', lineHeight: '1.65', color: 'var(--gd-color-text)' },
    title: { fontSize: '16px', fontWeight: 600, margin: '0 0 4px' },
    desc: { margin: '0 0 14px', opacity: 0.7 },
    card: { border: '1px solid var(--gd-color-border, rgba(127,127,127,.25))', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' },
    label: { display: 'block', fontWeight: 600, marginBottom: '6px' },
    hint: { opacity: 0.65, fontSize: '12px', margin: '4px 0 8px' },
    input: { width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: '8px', border: '1px solid var(--gd-color-border, rgba(127,127,127,.35))', background: 'var(--gd-color-secondary-surface, transparent)', color: 'inherit', fontFamily: 'inherit', fontSize: '13px' },
    row: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' },
    btn: { padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--gd-color-border, rgba(127,127,127,.35))', background: 'var(--gd-color-secondary-surface, transparent)', color: 'inherit', cursor: 'pointer', fontSize: '13px' },
    btnPrimary: { padding: '5px 12px', borderRadius: '8px', border: '1px solid transparent', background: 'var(--gd-color-primary, #2563eb)', color: '#fff', cursor: 'pointer', fontSize: '13px' },
    kv: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '5px 0', borderBottom: '1px dashed var(--gd-color-border, rgba(127,127,127,.2))' },
    ok: { color: '#16a34a', fontWeight: 600 },
    bad: { color: '#dc2626', fontWeight: 600 },
    muted: { opacity: 0.65 },
    err: { color: 'var(--gd-color-danger, #dc2626)', marginBottom: '10px' },
  };

  var SettingsPage = {
    name: 'GuadaBlenderSettingsPage',
    setup: function () {
      var loading = ref(true);
      var error = ref('');
      var status = ref(null);
      var testResult = ref(null);
      var saving = ref(false);
      var form = reactive({
        blenderExecutable: '',
        timeoutMs: 180000,
        maxOutputChars: 20000,
        restrictToWorkspace: true,
        enablePython: true,
        analysisPythonExecutable: '',
        enableHelpers: true,
        helperTimeoutMs: 120000,
      });
      var pythonResult = ref(null);

      function call(method, args) {
        return shared.pluginApi.call(PLUGIN_ID, method, args);
      }

      function applyStatus(data) {
        status.value = data;
        var cfg = (data && data.config) || {};
        form.blenderExecutable = cfg.blenderExecutable || '';
        form.timeoutMs = cfg.timeoutMs || 180000;
        form.maxOutputChars = cfg.maxOutputChars || 20000;
        form.restrictToWorkspace = cfg.restrictToWorkspace !== false;
        form.enablePython = cfg.enablePython !== false;
        form.analysisPythonExecutable = cfg.analysisPythonExecutable || '';
        form.enableHelpers = cfg.enableHelpers !== false;
        form.helperTimeoutMs = cfg.helperTimeoutMs || 120000;
      }

      function refresh() {
        loading.value = true;
        error.value = '';
        return call('get_status')
          .then(applyStatus)
          .catch(function (e) {
            error.value = String((e && e.message) || e);
          })
          .then(function () {
            loading.value = false;
          });
      }

      function save() {
        saving.value = true;
        error.value = '';
        call('save_config', {
          blenderExecutable: form.blenderExecutable,
          timeoutMs: Number(form.timeoutMs) || 180000,
          maxOutputChars: Number(form.maxOutputChars) || 20000,
          restrictToWorkspace: !!form.restrictToWorkspace,
          enablePython: !!form.enablePython,
          analysisPythonExecutable: form.analysisPythonExecutable,
          enableHelpers: !!form.enableHelpers,
          helperTimeoutMs: Number(form.helperTimeoutMs) || 120000,
        })
          .then(refresh)
          .catch(function (e) {
            error.value = String((e && e.message) || e);
          })
          .then(function () {
            saving.value = false;
          });
      }

      function detect() {
        call('detect')
          .then(function (res) {
            if (res && res.detected) form.blenderExecutable = res.detected;
          })
          .catch(function (e) {
            error.value = String((e && e.message) || e);
          });
      }

      function test() {
        testResult.value = null;
        call('test', {
          blenderExecutable: form.blenderExecutable,
          timeoutMs: Number(form.timeoutMs) || 180000,
          maxOutputChars: Number(form.maxOutputChars) || 20000,
        })
          .then(function (res) {
            testResult.value = res;
          })
          .catch(function (e) {
            testResult.value = { ok: false, error: String((e && e.message) || e) };
          });
      }

      function testPython() {
        pythonResult.value = null;
        call('test_python', {
          analysisPythonExecutable: form.analysisPythonExecutable,
          blenderExecutable: form.blenderExecutable,
          timeoutMs: Number(form.timeoutMs) || 180000,
        })
          .then(function (res) {
            pythonResult.value = res;
          })
          .catch(function (e) {
            pythonResult.value = { ok: false, error: String((e && e.message) || e) };
          });
      }

      onMounted(refresh);

      function row(label, value) {
        return h('div', { style: S.kv }, [
          h('span', null, label),
          h('span', { style: S.muted }, String(value === undefined || value === '' ? '-' : value)),
        ]);
      }

      return function () {
        var children = [
          h('h2', { style: S.title }, 'GuaDa Blender'),
          h('p', { style: S.desc }, 'Blender 3D 建模、检查、预览、渲染与导出。所有操作启动独立后台进程。'),
        ];

        if (error.value) children.push(h('div', { style: S.err }, error.value));
        if (loading.value) {
          children.push(h('div', { style: S.muted }, 'Loading…'));
          return h('div', { style: S.root }, children);
        }

        var s = status.value || {};
        var blender = s.blender || {};
        children.push(
          h('div', { style: S.card }, [
            h('div', { style: S.row }, [
              h('strong', null, '运行状态'),
              h('span', { style: blender.available ? S.ok : S.bad }, blender.available ? 'available' : 'unavailable'),
            ]),
            row('可执行文件', s.executable),
            row('来源', s.executableSource),
            row('版本', blender.version),
            row('自动探测', s.detected),
            row('Python 工具', s.pythonEnabled ? 'enabled' : 'disabled'),
            row('分析 Python', s.analysis && s.analysis.executable),
            row('Python 版本', s.analysis && s.analysis.version),
            row(
              'Python 包',
              s.analysis && s.analysis.packages
                ? Object.keys(s.analysis.packages)
                    .filter(function (k) { return s.analysis.packages[k]; })
                    .join(', ')
                : '-',
            ),
            row('Helper 数量', s.helpers ? s.helpers.count : '-'),
            row('数据目录', s.dataDir),
            blender.error ? h('div', { style: Object.assign({}, S.hint, { color: '#dc2626' }) }, blender.error) : null,
          ]),
        );

        children.push(
          h('div', { style: S.card }, [
            h('label', { style: S.label }, 'Blender 可执行文件'),
            h('div', { style: S.hint }, '留空 = 自动探测（Windows 会扫描 Program Files\\Blender Foundation）。'),
            h('input', {
              style: S.input,
              value: form.blenderExecutable,
              placeholder: 'C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe',
              onInput: function (e) { form.blenderExecutable = e.target.value; },
            }),
            h('div', { style: S.row }, [
              h('button', { style: S.btn, onClick: detect }, '自动探测'),
              h('button', { style: S.btn, onClick: test }, '测试连接'),
              h('button', { style: S.btnPrimary, disabled: saving.value, onClick: save }, '保存'),
            ]),
            testResult.value
              ? h('div', { style: Object.assign({}, S.hint, testResult.value.ok ? S.ok : S.bad) },
                  testResult.value.ok
                    ? '连接成功：' + (testResult.value.version || testResult.value.executable)
                    : '连接失败：' + (testResult.value.error || 'unknown'))
              : null,
          ]),
        );

        children.push(
          h('div', { style: S.card }, [
            h('label', { style: S.label }, '分析 Python（Helper）'),
            h('div', { style: S.hint }, '留空 = 自动探测；需要 numpy / opencv / Pillow。缺依赖时 helper_catalog 会明确标出。'),
            h('input', {
              style: S.input,
              value: form.analysisPythonExecutable,
              placeholder: 'C:\\Users\\...\\Python313\\python.exe',
              onInput: function (e) { form.analysisPythonExecutable = e.target.value; },
            }),
            h('div', { style: S.row }, [
              h('button', { style: S.btn, onClick: testPython }, '测试 Python'),
              h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [
                h('input', {
                  type: 'checkbox',
                  checked: form.enableHelpers,
                  onChange: function (e) { form.enableHelpers = e.target.checked; },
                }),
                '启用 helper',
              ]),
            ]),
            pythonResult.value
              ? h('div', {
                  style: Object.assign(
                    {},
                    S.hint,
                    pythonResult.value.ok ? S.ok : S.bad,
                  ),
                },
                  pythonResult.value.ok
                    ? 'Python ' + (pythonResult.value.version || '') + '：' +
                      Object.keys(pythonResult.value.packages || {})
                        .filter(function (k) { return pythonResult.value.packages[k]; })
                        .join(', ')
                    : '失败：' + (pythonResult.value.error || 'unknown'))
              : null,
            h('div', { style: S.row }, [
              h('span', { style: { width: '120px' } }, 'Helper 超时'),
              h('input', {
                style: Object.assign({}, S.input, { width: '160px' }),
                type: 'number',
                value: form.helperTimeoutMs,
                onInput: function (e) { form.helperTimeoutMs = e.target.value; },
              }),
            ]),
            h('div', { style: S.row }, [
              h('button', { style: S.btnPrimary, disabled: saving.value, onClick: save }, '保存设置'),
            ]),
          ]),
        );

        children.push(
          h('div', { style: S.card }, [
            h('label', { style: S.label }, '高级设置'),
            h('div', { style: S.row }, [
              h('span', { style: { width: '120px' } }, '超时 (ms)'),
              h('input', {
                style: Object.assign({}, S.input, { width: '160px' }),
                type: 'number',
                value: form.timeoutMs,
                onInput: function (e) { form.timeoutMs = e.target.value; },
              }),
            ]),
            h('div', { style: S.row }, [
              h('span', { style: { width: '120px' } }, '日志上限'),
              h('input', {
                style: Object.assign({}, S.input, { width: '160px' }),
                type: 'number',
                value: form.maxOutputChars,
                onInput: function (e) { form.maxOutputChars = e.target.value; },
              }),
            ]),
            h('div', { style: S.row }, [
              h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [
                h('input', {
                  type: 'checkbox',
                  checked: form.restrictToWorkspace,
                  onChange: function (e) { form.restrictToWorkspace = e.target.checked; },
                }),
                '限制路径在会话 workspace 内',
              ]),
            ]),
            h('div', { style: S.row }, [
              h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [
                h('input', {
                  type: 'checkbox',
                  checked: form.enablePython,
                  onChange: function (e) { form.enablePython = e.target.checked; },
                }),
                '允许 blender_python / blender_run_script',
              ]),
            ]),
            h('div', { style: S.row }, [
              h('button', { style: S.btnPrimary, disabled: saving.value, onClick: save }, '保存设置'),
            ]),
          ]),
        );

        return h('div', { style: S.root }, children);
      };
    },
  };

  if (!window.__GuaDaModuleLoader__) {
    console.error('[guada-blender] __GuaDaModuleLoader__ is missing');
    return;
  }
  window.__GuaDaModuleLoader__.register('guada-blender:SettingsPage', { default: SettingsPage });
})();
