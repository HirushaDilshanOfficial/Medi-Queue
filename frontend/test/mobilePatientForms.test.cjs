const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function nodes(node) {
  return node && typeof node === 'object' ? [node, ...(node.props?.children || []).flatMap(nodes)] : [];
}
function text(node) {
  if (typeof node === 'string') return node;
  return (node?.props?.children || []).map(text).join('');
}

function screen(name, platform = 'ios') {
  let index = 0, resourceIndex = 0, focus = [], androidPicker, reloads = 0;
  const state = [], params = name === 'DoctorBookingScreen' ? { id: 'doctor' } : {}, reschedules = [], reports = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat() } }),
    useState: initial => {
      const slot = index++;
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
      return [state[slot], next => { state[slot] = typeof next === 'function' ? next(state[slot]) : next; }];
    },
    useRef: initial => {
      const slot = index++;
      if (!(slot in state)) state[slot] = { current: initial };
      return state[slot];
    },
    useCallback: callback => callback, useMemo: callback => callback(), useEffect: () => {},
  };
  const theme = new Proxy({}, { get: (_, key) => key === 'designType' ? { body: 14 } : 12 });
  const resource = (_loader, deps) => {
    const n = resourceIndex++;
    let data;
    if (name === 'DoctorBookingScreen') {
      data = n === 0 ? { doctor: { name: 'Test Doctor', department: 'General OPD', languages: [], qualifications: [], workingHours: { start: '08:00', end: '17:00' } } }
        : n === 1 ? { days: [{ date: '2026-10-12', slotsRemaining: 1 }] }
          : { date: deps[1], slots: [{ id: 'slot', time: '10:00', available: true, remaining: 1 }] };
    } else data = name === 'MedicalReportsScreen' ? { reports: [] } : n === 0 ? { visits: [] } : { report: null };
    return { data, loading: false, error: null, reload: () => { reloads++; }, setData: () => {} };
  };
  const router = { back() {}, replace() {}, push() {}, setParams() {} };
  const modules = {
    react,
    'react-native': {
      ...Object.fromEntries(['View', 'Text', 'Image', 'Pressable', 'ScrollView', 'Modal', 'TextInput', 'ActivityIndicator', 'KeyboardAvoidingView', 'FlatList', 'RefreshControl'].map(key => [key, key])),
      Platform: { OS: platform }, StyleSheet: { create: value => value }, Alert: { alert() {} },
    },
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => params, useFocusEffect: callback => { focus.push(callback); } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 20 }) },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-document-picker': {},
    'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle', Path: 'Path' },
    '@react-native-community/datetimepicker': { __esModule: true, default: 'DateTimePicker', DateTimePickerAndroid: { open: options => { androidPicker = options; } } },
    '../../../i18n/LanguageContext': { useLanguage: () => ({ t: value => value, locale: 'en-GB' }) },
    '../../../i18n/LocalizedText': { LocalizedText: 'Text' },
    '../../../i18n/LanguageSwitcher': { LanguageSwitcher: 'LanguageSwitcher' },
    '../../../constants/PatientTheme': { PatientTheme: theme },
    '../../../hooks/useAsyncResource': { useAsyncResource: resource },
    '../../../services/doctorApi': { doctorApi: {} },
    '../../../services/patientApi': { patientApi: { createReport: async draft => { reports.push(draft); } } },
    '../../../services/bookingApi': { bookingApi: {
      create: async () => ({ appointment: { id: 'booking', slotTime: '10:00' }, pass: { tokenNumber: 1 } }),
      reschedule: async (...args) => { reschedules.push(args); },
    } },
    '../../../services/http': { HttpError: class extends Error {} },
    '../../../utils/appendReportFile': {},
    '../../../utils/opdDates': { todayKey: () => '2026-10-11', addDaysKey: () => '2026-10-25', isPastDateKey: () => false,
      longDayLabel: value => value, shortDayParts: () => ({ day: '12', weekday: 'Mon' }), calendarDateLabel: value => value, dayLabel: value => value },
  };
  const context = { exports: {}, require: key => {
    if (key in modules) return modules[key];
    if (key.includes('/components/')) return new Proxy({}, { get: (_, property) => property });
    if (key.endsWith('.png')) return 'image';
    throw new Error(`Unexpected import: ${key}`);
  } };
  const folder = name === 'DoctorBookingScreen' ? 'Doctors' : 'Profile';
  const source = fs.readFileSync(require.resolve(`../src/screens/Patient/${folder}/${name}.tsx`), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, context);
  const render = () => { index = 0; resourceIndex = 0; focus = []; return context.exports[name](); };
  return { render, params, focus: () => focus.forEach(callback => callback()), reschedules, reports,
    picker: () => androidPicker, reloads: () => reloads };
}

test('a retained mobile booking screen enables confirmation when starting a reschedule', async () => {
  const app = screen('DoctorBookingScreen');
  const time = () => nodes(app.render()).find(node => node.type === 'Pressable' && node.props.accessibilityLabel?.startsWith('10:00,'));
  const confirm = label => nodes(app.render()).find(node => node.type === 'Pressable' && text(node).startsWith(label));
  time().props.onPress();
  await confirm('Confirm Appointment').props.onPress();
  nodes(app.render()).find(node => node.type === 'Pressable' && text(node) === 'View queue pass').props.onPress();
  app.params.rescheduleId = 'booking';
  assert.equal(confirm('Confirm New Appointment').props.disabled, true, 'old confirmation persists before focus reset');
  app.focus();
  time().props.onPress();
  assert.equal(confirm('Confirm New Appointment').props.disabled, false);
  await confirm('Confirm New Appointment').props.onPress();
  assert.deepEqual(app.reschedules, [['booking', '2026-10-12', '10:00']]);
});

test('iOS report date picker has visible dimensions and readable text', () => {
  const app = screen('AddReportScreen');
  nodes(app.render()).find(node => node.type === 'Pressable' && text(node) === 'Choose report date').props.onPress();
  const tree = nodes(app.render());
  assert.ok(tree.some(node => node.type === 'Modal' && node.props.visible));
  const picker = tree.find(node => node.type === 'DateTimePicker');
  assert.equal(picker.props.themeVariant, 'light');
  assert.equal(picker.props.style.height, 216);
  assert.equal(picker.props.style.width, '100%');
  picker.props.onChange({}, new Date(2026, 9, 10, 12));
  nodes(app.render()).find(node => node.type === 'Pressable' && text(node) === 'Done').props.onPress();
  assert.ok(nodes(app.render()).some(node => node.type === 'Pressable' && text(node) === '2026-10-10'));
});

test('Android report date uses a system dialog and commits only confirmed selections', () => {
  const app = screen('AddReportScreen', 'android');
  const open = () => nodes(app.render()).find(node => node.type === 'Pressable' && ['Choose report date', '2026-10-10'].includes(text(node))).props.onPress();
  open();
  app.picker().onChange({ type: 'dismissed' }, new Date(2026, 9, 10, 12));
  assert.ok(nodes(app.render()).some(node => text(node) === 'Choose report date'));
  open();
  app.picker().onChange({ type: 'set' }, new Date(2026, 9, 10, 12));
  assert.ok(nodes(app.render()).some(node => node.type === 'Pressable' && text(node) === '2026-10-10'));
});

test('returning to medical reports reloads the mounted list', () => {
  const app = screen('MedicalReportsScreen');
  app.render(); app.focus();
  assert.equal(app.reloads(), 0);
  app.render(); app.focus();
  assert.equal(app.reloads(), 1);
});

test('a selected mobile report date reaches the existing save API', async () => {
  const app = screen('AddReportScreen', 'android');
  nodes(app.render()).find(node => node.type === 'FormField' && node.props.label === 'Title').props.onChangeText('Blood test');
  nodes(app.render()).find(node => node.type === 'Pressable' && text(node) === 'Choose report date').props.onPress();
  app.picker().onChange({ type: 'set' }, new Date(2020, 9, 10, 12));
  await nodes(app.render()).find(node => node.props.accessibilityLabel === 'Save report').props.onPress();
  assert.equal(app.reports.length, 1);
  assert.equal(app.reports[0].title, 'Blood test');
  assert.equal(app.reports[0].reportDate, '2020-10-10');
});

test('web report dates still use the browser date input', () => {
  const app = screen('AddReportScreen', 'web');
  const input = nodes(app.render()).find(node => node.type === 'input' && node.props['aria-label'] === 'Choose report date');
  assert.equal(input.props.type, 'date');
  input.props.onChange({ currentTarget: { value: '2020-10-10' } });
  assert.equal(nodes(app.render()).find(node => node.type === 'input').props.value, '2020-10-10');
  assert.equal(app.picker(), undefined);
});
