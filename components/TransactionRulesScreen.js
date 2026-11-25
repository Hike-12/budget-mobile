import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/colors';
import TransactionCategoryPicker from './TransactionCategoryPicker';
import TransactionCalendar, { calendarDateKey } from './TransactionCalendar';
import { transactionFormStyles as formStyles, transactionPlaceholderColor, TransactionTypeField } from './TransactionFormFields';
import { transactionRulesRequest } from '../utils/transactionRules';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const order = [1, 2, 3, 4, 5, 6, 0];
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const dateLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' });
const makeRequestId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function Button({ label, onPress, primary, disabled, icon, roomy }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, roomy && styles.roomyButton, primary && styles.primary,
        pressed && styles.pressed, disabled && styles.disabled]}>
      <View style={styles.buttonContent}>
        {icon && <Ionicons name={icon} size={17} color={primary ? Colors.dark : Colors.secondary} />}
        <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={formStyles.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor={transactionPlaceholderColor}
        style={[formStyles.input, props.multiline && formStyles.textArea]} />
    </View>
  );
}

function RuleEditor({ initial, kind, today, busy, error, onSave, onCancel }) {
  const recurring = kind === 'recurring';
  const [form, setForm] = useState(() => initial ? { ...initial, amount: String(initial.amount) } : {
    title: '', amount: '', type: 'expense', category: 'miscellaneous', note: '',
    ...(recurring && { weekdays: [], startDate: today, paused: false }),
  });
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const amount = Number(form.amount.replace(',', '.'));
  const validDate = !recurring || (/^\d{4}-\d{2}-\d{2}$/.test(form.startDate)
    && form.startDate >= (initial?.startDate < today ? initial.startDate : today)
    && form.startDate <= '2100-12-31');
  const canSave = !!form.title.trim() && amount > 0 && amount <= 1e9 && validDate && (!recurring || !!form.weekdays.length);

  return (
    <>
      <Field label="Title" placeholder="Enter title" value={form.title} onChangeText={(value) => change('title', value)} maxLength={80} />
      <Field label="Amount" placeholder="Enter amount" keyboardType="decimal-pad" value={form.amount} onChangeText={(value) => change('amount', value)} />
      {recurring && <TransactionCalendar label="Start date" value={new Date(`${form.startDate}T00:00:00`)}
        min={initial?.startDate < today ? initial.startDate : today} onChange={(date) => change('startDate', calendarDateKey(date))} />}
      <TransactionTypeField value={form.type} onChange={(value) => change('type', value)} />
      <Text style={formStyles.label}>Category</Text>
      <TransactionCategoryPicker value={form.category} onChange={(value) => change('category', value)} style={formStyles.category} />
      {recurring && <>
        <View style={formStyles.category}>
          <Text style={formStyles.label}>Repeat on</Text>
          <View style={styles.actions}>
            {order.map((day) => {
              const selected = form.weekdays.includes(day);
              return (
                <Pressable key={day} accessibilityRole="button" accessibilityLabel={days[day]} accessibilityState={{ selected }}
                  style={[styles.day, selected && styles.selected]} onPress={() => change('weekdays',
                    selected ? form.weekdays.filter((value) => value !== day) : [...form.weekdays, day])}>
                  <Text style={styles.buttonText}>{days[day].slice(0, 3)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </>}
      <Field label="Note (Optional)" placeholder="Add a note" value={form.note} onChangeText={(value) => change('note', value)} maxLength={500} multiline />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <TouchableOpacity accessibilityRole="button" disabled={busy || !canSave}
        style={[formStyles.submit, (busy || !canSave) && formStyles.submitDisabled]}
        onPress={() => onSave({ ...form, kind, amount })}>
        {busy ? <ActivityIndicator color={Colors.dark} /> : <Text style={formStyles.submitText}>
          {initial ? 'Save Changes' : recurring ? 'Save Schedule' : 'Save Quick Transaction'}
        </Text>}
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={formStyles.cancel} disabled={busy} onPress={onCancel}>
        <Text style={formStyles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </>
  );
}

export default function TransactionRulesScreen({ kind }) {
  const recurring = kind === 'recurring';
  const title = recurring ? 'Recurring transactions' : 'Quick transactions';
  const newLabel = recurring ? 'New transaction' : 'New quick transaction';
  const router = useRouter();
  const [data, setData] = useState(null);
  const [editor, setEditor] = useState(null);
  const [remove, setRemove] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);
  const [reload, setReload] = useState(0);
  const inFlight = useRef(false);
  const requestIds = useRef({});
  const closeEditor = useCallback(() => {
    if (inFlight.current) return;
    setEditor(null);
    setError(null);
  }, []);
  const editing = Boolean(editor);
  useFocusEffect(useCallback(() => {
    if (!editing) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { closeEditor(); return true; });
    return () => back.remove();
  }, [closeEditor, editing]));

  useEffect(() => {
    const controller = new AbortController();
    transactionRulesRequest(kind, null, controller.signal).then(setData).catch((err) => {
      if (!controller.signal.aborted) setError(err);
    });
    return () => controller.abort();
  }, [kind, reload]);

  async function act(id, command, success) {
    if (inFlight.current) return;
    inFlight.current = true;
    setActive(id);
    setNotice('');
    setError(null);
    try {
      success(await transactionRulesRequest(kind, command));
    } catch (err) {
      setError(err);
      if (err.response?.status === 409) setReload((value) => value + 1);
    } finally {
      inFlight.current = false;
      setActive(null);
    }
  }

  function save(rule, id) {
    const requestId = id ? undefined : (requestIds.current.new ??= makeRequestId());
    act(id || 'new', { action: 'save', id, rule, requestId }, ({ rule: saved }) => {
      if (!id) delete requestIds.current.new;
      setData((current) => ({ ...current, rules: id
        ? current.rules.map((item) => item._id === id ? saved : item)
        : [...current.rules, saved] }));
      setEditor(null);
      setNotice(id ? 'Changes saved.' : recurring ? 'Schedule saved.' : 'Quick transaction saved.');
    });
  }

  const unauthorized = error?.response?.status === 401;
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.screen}>
      <Stack.Screen options={{ title: editor ? (editor._id ? (recurring ? 'Edit Schedule' : 'Edit Quick Transaction') : newLabel) : title,
        headerLeft: editing ? () => <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} onPress={closeEditor}>
          <Ionicons name="chevron-back" color={Colors.accent} size={24} />
        </Pressable> : undefined,
      }} />
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <ScrollView contentContainerStyle={editing ? styles.editorContent : [styles.content, !recurring && styles.quickContent]} keyboardShouldPersistTaps="handled">
          {!editor && <Text style={styles.hint}>{recurring ? 'Log entries automatically on the days you choose. Dates use India time.' : 'Save the details once, then add the transaction in one tap.'}</Text>}
          {!!notice && <Text accessibilityLiveRegion="polite" style={styles.hint}>{notice}</Text>}
          {!!error && !editing && <View style={styles.card}>
            <Text accessibilityLiveRegion="polite" style={styles.hint}>{unauthorized
              ? 'Sign in again to sync your saved transactions.' : error.response?.data?.error || 'Could not connect. Try again.'}</Text>
            {unauthorized ? <Button label="Sign in" primary onPress={() => router.replace({
              pathname: '/login', params: { next: recurring ? '/recurring-transactions' : '/quick-transactions' },
            })} /> : !data && <Button label="Retry" onPress={() => { setError(null); setReload(reload + 1); }} />}
          </View>}
          {!data && !error && <ActivityIndicator accessibilityLabel="Loading" color={Colors.secondary} />}
          {editor && data && <RuleEditor key={editor._id || 'new'} initial={editor._id ? editor : null} kind={kind}
            today={data.today} busy={!!active} onSave={(rule) => save(rule, editor._id)}
            error={error && (error.response?.data?.error || 'Could not connect. Try again.')} onCancel={closeEditor} />}
          {!editor && data && <>
            {!data.rules.length && <Text style={styles.title}>{recurring ? 'No schedules yet' : 'No quick transactions yet'}</Text>}
            <Button label={newLabel} icon="add" primary roomy={!recurring} disabled={!!active} onPress={() => { setEditor({}); setRemove(null); setNotice(''); }} />
            {data.rules.map((rule) => (
              <View key={rule._id} style={[styles.card, !recurring && styles.quickCard]}>
                <View style={styles.summary}>
                  <View style={styles.name}>
                    <Text style={styles.title}>{rule.title}</Text>
                    <Text style={[styles.hint, styles.capitalize]}>{rule.category} · {rule.type}</Text>
                  </View>
                  <Text style={[styles.total, rule.type === 'income' && styles.income]}>{money.format(rule.amount)}</Text>
                </View>
                {recurring && <Text style={styles.hint}>
                  {rule.weekdays.length === 7 ? 'Every day' : order.filter((day) => rule.weekdays.includes(day)).map((day) => days[day].slice(0, 3)).join(', ')}
                  {' · '}{rule.paused ? 'Paused' : rule.nextDate && `Next ${dateLabel.format(new Date(rule.nextDate))}`}
                </Text>}
                {remove === rule._id ? <>
                  <Text style={styles.hint}>Remove this {recurring ? 'schedule' : 'quick transaction'}?</Text>
                  <View style={styles.actions}>
                    <Button label="Remove" disabled={!!active} onPress={() => act(rule._id, { action: 'remove', id: rule._id }, () => {
                      setData((current) => ({ ...current, rules: current.rules.filter((item) => item._id !== rule._id) }));
                      setRemove(null);
                      setNotice('Removed.');
                    })} />
                    <Button label="Cancel" disabled={!!active} onPress={() => setRemove(null)} />
                  </View>
                </> : <View style={[styles.actions, !recurring && styles.quickActions]}>
                  {recurring ? <Button label={rule.paused ? 'Resume' : 'Pause'} disabled={!!active} onPress={() => save({ ...rule, paused: !rule.paused }, rule._id)} />
                    : <Button label={active === rule._id ? 'Adding…' : 'Add now'} primary roomy disabled={!!active} onPress={() => {
                      const id = rule._id;
                      const requestId = requestIds.current[id] ??= makeRequestId();
                      act(id, { action: 'add', id, requestId }, () => {
                        delete requestIds.current[id];
                        setNotice(`${rule.title} added.`);
                      });
                    }} />}
                  <Button label="Edit" disabled={!!active} onPress={() => { setEditor(rule); setNotice(''); }} />
                  <Button label="Remove" disabled={!!active} onPress={() => { setRemove(rule._id); setNotice(''); }} />
                </View>}
              </View>
            ))}
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.dark },
  content: { gap: 14, padding: 16, paddingBottom: 32, maxWidth: 680, alignSelf: 'center', width: '100%' },
  editorContent: { padding: 20, paddingBottom: 30 },
  card: { backgroundColor: Colors.card, padding: 15, gap: 13, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderLight },
  quickContent: { gap: 18, paddingTop: 20 },
  quickCard: { padding: 18, gap: 16 },
  summary: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, gap: 3 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.accent },
  total: { fontSize: 17, fontWeight: '700', color: Colors.accent, fontVariant: ['tabular-nums'] },
  income: { color: Colors.green },
  hint: { color: Colors.secondary, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  quickActions: { alignItems: 'center', gap: 10 },
  button: { minHeight: 46, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  roomyButton: { minHeight: 52, paddingHorizontal: 17, paddingVertical: 11 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  primary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  selected: { backgroundColor: '#25384b', borderColor: Colors.primary },
  buttonText: { color: Colors.accent, fontWeight: '600', fontSize: 14, flexShrink: 1, textAlign: 'center' },
  primaryText: { color: Colors.dark },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.48 },
  error: { color: Colors.red, marginBottom: 8 },
  capitalize: { color: Colors.secondary, textTransform: 'capitalize' },
  day: { minHeight: 44, minWidth: 44, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 9 },
});
