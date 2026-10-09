const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}, extra = {}) {
  const context = { exports: {}, require: name => modules[name], ...extra };
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, context);
  return context.exports;
}

test('toast messages survive navigation and preserve entered names and localized copy', () => {
  const { toastStore } = load('services/toastStore.ts');
  let notifications = 0;
  const unsubscribe = toastStore.subscribe(() => notifications++);
  toastStore.show({ type: 'success', text1: 'සාදරයෙන් පිළිගනිමු', text2: 'Heshani $&', topOffset: 60 });
  assert.equal(toastStore.getSnapshot().text2, 'Heshani $&');
  assert.equal(toastStore.getSnapshot().text1, 'සාදරයෙන් පිළිගනිමු');
  assert.equal(notifications, 1);
  unsubscribe();
  toastStore.hide();
  assert.equal(toastStore.getSnapshot(), null);
  assert.equal(notifications, 1);
});

test('an older message cannot dismiss a new validation error', () => {
  const { toastStore } = load('services/toastStore.ts');
  toastStore.show({ text1: 'First' });
  const first = toastStore.getSnapshot();
  toastStore.show({ type: 'error', text1: 'Passwords do not match' });
  toastStore.hide(first);
  assert.equal(toastStore.getSnapshot().text1, 'Passwords do not match');
  toastStore.hide();
  assert.equal(toastStore.getSnapshot(), null);
});

test('global popup uses the current custom design and dismisses after its visible duration', () => {
  const { toastStore } = load('services/toastStore.ts');
  let timer;
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useEffect: effect => effect(),
  };
  const { default: Toast } = load('components/GlobalToast.tsx', {
    react,
    'react-native': { View: 'View', StyleSheet: { create: value => value, absoluteFillObject: {} } },
    './Toast': { Toast: 'InlineToast' },
    '../services/toastStore': { toastStore },
  }, { setTimeout: (callback, delay) => { timer = { callback, delay }; }, clearTimeout() {} });
  Toast.show({ type: 'error', text1: 'Login Failed', text2: 'Try again', topOffset: 60 });
  let rendered;
  const tree = Toast({ config: { error: message => { rendered = message; return 'custom error card'; } } });
  assert.equal(rendered.text1, 'Login Failed');
  assert.equal(tree.children[0].props.style[1].top, 60);
  assert.equal(timer.delay, 4000);
  timer.callback();
  assert.equal(toastStore.getSnapshot(), null);
});
