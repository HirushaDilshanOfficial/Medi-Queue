const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function screen(platform) {
  let index = 0;
  const state = [];
  const modules = {
    react: { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat() } }),
      useState: initial => { const slot = index++; if (!(slot in state)) state[slot] = initial;
        return [state[slot], next => { state[slot] = next; }]; } },
    'react-native': { ...Object.fromEntries(['View', 'TextInput', 'TouchableOpacity', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'Modal', 'Image'].map(name => [name, name])),
      Platform: { OS: platform }, StyleSheet: { create: styles => styles } },
    'expo-router': { router: {} },
    '../../constants/Colors': { Colors: { textDark: '#132228' } },
    '../../components/AppIcon': { AppIcon: 'Icon' },
    '../../i18n/LanguageSwitcher': { LanguageSwitcher: 'LanguageSwitcher' },
    '../../i18n/LocalizedText': { LocalizedText: 'Text' },
    '../../i18n/LanguageContext': { useLanguage: () => ({ t: text => text, locale: 'en-GB' }) },
    '../../services/authService': { registerPatient: () => { throw new Error('No registration should occur in a picker test'); } },
    '../../components/GlobalToast': { show: () => {} },
    '@react-native-community/datetimepicker': 'DateTimePicker',
    '../../utils/opdDates': { todayKey: () => '2026-10-10', calendarDateLabel: key => key },
    '../../../assets/images/logo.png': 'logo',
  };
  const context = { exports: {}, require: name => { assert.ok(name in modules, name); return modules[name]; } };
  const source = fs.readFileSync(require.resolve('../src/app/(auth)/register.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, context);
  return () => { index = 0; return context.exports.default(); };
}
function nodes(node) { return node && typeof node === 'object' ? [node, ...(node.props?.children || []).flatMap(nodes)] : []; }
function find(render, predicate) { return nodes(render()).find(predicate); }
const localBirthday = { getFullYear: () => 1999, getMonth: () => 5, getDate: () => 15,
  toISOString: () => '1999-06-14T18:30:00.000Z' };

test('web birthday uses an inline calendar with immediate selection and clearing', () => {
  const render = screen('web');
  const input = () => find(render, node => node.type === 'input' && node.props.type === 'date');
  assert.equal(input().props.max, '2026-10-10');
  assert.equal(input().props.lang, 'en-GB');
  assert.equal(input().props.style.width, '100%');
  input().props.onChange({ currentTarget: { value: '1999-06-15' } });
  assert.equal(input().props.value, '1999-06-15');
  assert.ok(!nodes(render()).some(node => node.type === 'Modal' && node.props.visible));
  assert.ok(!nodes(render()).some(node => node.type === 'DateTimePicker'));
  input().props.onChange({ currentTarget: { value: '' } });
  assert.equal(input().props.value, '');
});

test('iOS confirms the local calendar date and discards cancelled draft changes', () => {
  const render = screen('ios');
  const open = () => find(render, node => node.props.accessibilityLabel === 'Choose birthday').props.onPress();
  const picker = () => find(render, node => node.type === 'DateTimePicker');
  const action = label => find(render, node => node.type === 'TouchableOpacity' && node.props.children.some(child => child?.type === 'Text' && child.props.children.includes(label)));
  open(); picker().props.onChange({ type: 'set' }, localBirthday); action('Done').props.onPress();
  open(); assert.equal(picker().props.value.getDate(), 15);
  picker().props.onChange({ type: 'set' }, { ...localBirthday, getDate: () => 16 });
  action('Cancel').props.onPress(); open();
  assert.equal(picker().props.value.getDate(), 15);
  find(render, node => node.type === 'Modal' && node.props.animationType === 'slide').props.onRequestClose();
  assert.ok(!nodes(render()).some(node => node.type === 'Modal' && node.props.visible));
});

test('Android dismissal preserves the confirmed birthday without a UTC day shift', () => {
  const render = screen('android');
  const open = () => find(render, node => node.props.accessibilityLabel === 'Choose birthday').props.onPress();
  const picker = () => find(render, node => node.type === 'DateTimePicker');
  open(); picker().props.onChange({ type: 'set' }, localBirthday);
  assert.ok(!picker());
  open(); assert.equal(picker().props.value.getDate(), 15);
  picker().props.onChange({ type: 'dismissed' }, { ...localBirthday, getDate: () => 16 });
  open(); assert.equal(picker().props.value.getDate(), 15);
});
