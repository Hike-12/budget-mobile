import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/colors';
import { transactionRulesRequest } from '../utils/transactionRules';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const order = [1, 2, 3, 4, 5, 6, 0];
const categories = ['miscellaneous', 'personal', 'Transport', 'Food', 'Travel', 'Shopping', 'Bills', 'Entertainment', 'Health', 'school friends', 'college friends', 'religion', 'Other'];
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const dateLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' });
const makeRequestId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function Button({ label, onPress, primary, disabled, icon, selected }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled, selected }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, primary && styles.primary, selected && styles.selected,
        pressed && styles.pressed, disabled && styles.disabled]}>
      {icon && <Ionicons name={icon} size={17} color={primary ? Colors.dark : Colors.secondary} />}
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor={Colors.secondary}
        style={[styles.input, props.multiline && styles.multiline]} />
    </View>
  );
}

function RuleEditor({ initial, kind, today, busy, onSave, onCancel }) {
  const recurring = kind === 'recurring';
  const [form, setForm] = useState(() => initial ? { ...initial, amount: String(initial.amount) } : {
    title: '', amount: '', type: 'expense', category: 'miscellaneous', note: '',
    ...(recurring && { weekdays: [], startDate: today, paused: false }),
  });
  const [showCategories, setShowCategories] = useState(false);
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const amount = Number(form.amount.replace(',', '.'));
  const validDate = !recurring || (/^\d{4}-\d{2}-\d{2}$/.test(form.startDate)
    && form.startDate >= (initial?.startDate < today ? initial.startDate : today)
    && form.startDate <= '2100-12-31');
  const canSave = !!form.title.trim() && amount > 0 && amount <= 1e9 && validDate && (!recurring || !!form.weekdays.length);

  return (
    <View style={styles.card}>
      <Field label="Name" placeholder="Rickshaw" value={form.title} onChangeText={(value) => change('title', value)} maxLength={80} />
      <Field label="Amount (₹)" keyboardType="decimal-pad" value={form.amount} onChangeText={(value) => change('amount', value)} />
      <View style={styles.field}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.actions}>
          <Button label="Expense" selected={form.type === 'expense'} onPress={() => change('type', 'expense')} />
          <Button label="Income" selected={form.type === 'income'} onPress={() => change('type', 'income')} />
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Category, ${form.category}`}
          accessibilityState={{ expanded: showCategories }} onPress={() => setShowCategories(!showCategories)} style={styles.category}>
          <Text style={styles.capitalize}>{form.category}</Text>
          <Ionicons name={showCategories ? 'chevron-up' : 'chevron-down'} size={17} color={Colors.secondary} />
        </Pressable>
        {showCategories && <View style={styles.actions}>
          {categories.map((category) => <Button key={category} label={category} selected={form.category === category}
            onPress={() => { change('category', category); setShowCategories(false); }} />)}
        </View>}
      </View>
      {recurring && <>
        <View style={styles.field}>
          <Text style={styles.label}>Repeat on</Text>
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
        <Field label="Start date (YYYY-MM-DD)" value={form.startDate} onChangeText={(value) => change('startDate', value)} maxLength={10} autoCorrect={false} />
      </>}
      <Field label="Note (optional)" value={form.note} onChangeText={(value) => change('note', value)} maxLength={500} multiline />
      <View style={styles.actions}>
        <Button label={busy ? 'Saving…' : 'Save'} primary disabled={busy || !canSave}
          onPress={() => onSave({ ...form, kind, amount })} />
        <Button label="Cancel" disabled={busy} onPress={onCancel} />
      </View>
    </View>
  );
}

export default function TransactionRulesScreen({ kind }) {
  const recurring = kind === 'recurring';
  const title = recurring ? 'Recurring transactions' : 'Quick transactions';
  const newLabel = recurring ? 'New schedule' : 'New quick transaction';
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
      <Stack.Screen options={{ title: editor ? (editor._id ? 'Edit transaction setup' : newLabel) : title }} />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!editor && <Text style={styles.hint}>{recurring ? 'Log entries automatically on the days you choose. Dates use India time.' : 'Save the details once, then add the transaction in one tap.'}</Text>}
          {!!notice && <Text accessibilityLiveRegion="polite" style={styles.hint}>{notice}</Text>}
          {!!error && <View style={styles.card}>
            <Text accessibilityLiveRegion="polite" style={styles.hint}>{unauthorized
              ? 'Sign in again to sync your saved transactions.' : error.response?.data?.error || 'Could not connect. Try again.'}</Text>
            {unauthorized ? <Button label="Sign in" primary onPress={() => router.replace({
              pathname: '/login', params: { next: recurring ? '/recurring-transactions' : '/quick-transactions' },
            })} /> : !data && <Button label="Retry" onPress={() => { setError(null); setReload(reload + 1); }} />}
          </View>}
          {!data && !error && <ActivityIndicator accessibilityLabel="Loading" color={Colors.secondary} />}
          {editor && data && <RuleEditor key={editor._id || 'new'} initial={editor._id ? editor : null} kind={kind}
            today={data.today} busy={!!active} onSave={(rule) => save(rule, editor._id)}
            onCancel={() => { setEditor(null); setError(null); }} />}
          {!editor && data && <>
            {!data.rules.length && <Text style={styles.title}>{recurring ? 'No schedules yet' : 'No quick transactions yet'}</Text>}
            <Button label={newLabel} icon="add" primary disabled={!!active} onPress={() => { setEditor({}); setRemove(null); setNotice(''); }} />
            {data.rules.map((rule) => (
              <View key={rule._id} style={styles.card}>
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
                </> : <View style={styles.actions}>
                  {recurring ? <Button label={rule.paused ? 'Resume' : 'Pause'} disabled={!!active} onPress={() => save({ ...rule, paused: !rule.paused }, rule._id)} />
                    : <Button label={active === rule._id ? 'Adding…' : 'Add now'} primary disabled={!!active} onPress={() => {
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
  card: { backgroundColor: Colors.card, padding: 15, gap: 13, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderLight },
  summary: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, gap: 3 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.accent },
  total: { fontSize: 17, fontWeight: '700', color: Colors.accent, fontVariant: ['tabular-nums'] },
  income: { color: Colors.green },
  hint: { color: Colors.secondary, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  button: { minHeight: 46, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  primary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  selected: { backgroundColor: '#25384b', borderColor: Colors.primary },
  buttonText: { color: Colors.accent, fontWeight: '600', fontSize: 14 },
  primaryText: { color: Colors.dark },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.48 },
  field: { gap: 6 },
  label: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  input: { minHeight: 46, backgroundColor: Colors.dark, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 9, paddingHorizontal: 12, color: Colors.accent, fontSize: 15 },
  multiline: { paddingVertical: 10, minHeight: 70, textAlignVertical: 'top' },
  category: { minHeight: 46, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.dark, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 9, paddingHorizontal: 12 },
  capitalize: { color: Colors.secondary, textTransform: 'capitalize' },
  day: { minHeight: 44, minWidth: 44, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 9 },
});
