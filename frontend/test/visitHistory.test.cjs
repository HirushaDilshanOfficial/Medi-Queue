const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the screen with isolated resources and navigation; no patient data or
// running backend is needed to exercise the status buttons and refresh behavior.
function screen(status, { loading = false } = {}) {
  const navigation = [];
  const focus = [];
  let reloads = 0;
  const createElement = (type, props, ...children) => ({ type, props: { ...props, children } });
  const react = { createElement, useCallback: fn => fn };
  const native = Object.fromEntries(['View', 'FlatList', 'RefreshControl', 'Pressable'].map(name => [name, name]));
  native.StyleSheet = { create: styles => styles };
  const router = { setParams: params => navigation.push(params), push: href => navigation.push(href) };
  const history = {
    data: {
      visits: ['completed', 'no_show', 'cancelled'].map((status, index) => ({ id: String(index), status })),
      summary: { totalVisits: 1, noShow: 1, cancelled: 1 },
      reports: [{ id: 'unlinked', title: 'Report' }],
    },
    loading, error: null, reload: () => { reloads++; },
  };
  const modules = {
    react, 'react-native': native,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => ({ status }), useFocusEffect: callback => focus.push(callback) },
    '../../../i18n/LocalizedText': { LocalizedText: 'Text' },
    '../../../i18n/LanguageContext': { useLanguage: () => ({ t: text => text }) },
    '../../../constants/PatientTheme': { PatientTheme: { designType: {}, brand: '#004c5b' } },
    '../../../services/patientApi': { patientApi: {} },
    '../../../hooks/useAsyncResource': { useAsyncResource: () => history },
  };
  for (const name of ['ScreenHeader', 'ReportRow', 'Badge', 'DesignImage']) modules[`../../../components/patient/${name}`] = { [name]: name };
  modules['../../../components/patient/ScreenStates'] = { ScreenLoader: 'ScreenLoader', MessageState: 'MessageState' };
  const source = fs.readFileSync(path.join(__dirname, '../src/screens/Patient/Profile/VisitHistoryScreen.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const context = { exports: {}, require: name => { assert.ok(name in modules, name); return modules[name]; } };
  vm.runInNewContext(compiled, context);
  const tree = context.exports.VisitHistoryScreen();
  const nodes = [];
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object' || !node.props) return;
    if (typeof node.type === 'function') return walk(node.type(node.props));
    nodes.push(node);
    walk(node.props.children);
    walk(node.props.ListHeaderComponent);
  }
  walk(tree);
  return { nodes, navigation, focus, reloads: () => reloads };
}

test('Seen, Missed and Cancelled buttons select only their matching visits', () => {
  for (const [label, status] of [['Seen', 'completed'], ['Missed', 'no_show'], ['Cancelled', 'cancelled']]) {
    const all = screen();
    const button = all.nodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === `${label}: 1`);
    assert.ok(button, `Missing ${label} button`);
    button.props.onPress();
    assert.equal(all.navigation[0].status, status);
    const filtered = screen(all.navigation[0].status);
    const list = filtered.nodes.find(node => node.type === 'FlatList');
    assert.equal(list.props.data.length, 1);
    assert.equal(list.props.data[0].status, status);
    assert.equal(filtered.nodes.filter(node => node.props.accessibilityState?.selected).length, 1);
    assert.ok(!filtered.nodes.some(node => node.type === 'ReportRow'));
  }
});

test('Show all appointments restores every status and unlinked reports', () => {
  const filtered = screen('cancelled');
  const button = filtered.nodes.find(node => node.type === 'Pressable' && node.props.children.some(child => child?.props?.children?.includes('Show all appointments')));
  button.props.onPress();
  const all = screen(filtered.navigation[0].status);
  assert.equal(all.nodes.find(node => node.type === 'FlatList').props.data.length, 3);
  assert.ok(all.nodes.some(node => node.type === 'ReportRow'));
});

test('returning to history reloads it and pull-to-refresh reflects the request', () => {
  const page = screen('cancelled', { loading: true });
  page.focus[0]();
  assert.equal(page.reloads(), 1);
  const refresh = page.nodes.find(node => node.type === 'FlatList').props.refreshControl;
  assert.equal(refresh.props.refreshing, true);
  refresh.props.onRefresh();
  assert.equal(page.reloads(), 2);
});
