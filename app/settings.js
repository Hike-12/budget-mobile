import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Switch,
  Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/colors';
import ActionLabel from '../components/ActionLabel';
import { useCaptureSession } from '../contexts/UpiCaptureContext';
import { parsePaymentAlert } from '../utils/smsParser';
import { upiNative } from '../utils/upiNative';

function ActionRow({ icon, title, description, busy = false, disabled, onPress, last }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled, busy }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={Colors.secondary} />
      <View style={styles.rowCopy}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {busy ? <ActivityIndicator color={Colors.secondary} size="small" /> :
        <Ionicons name="chevron-forward" size={17} color={Colors.textMuted} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, capture } = useCaptureSession();
  const [work, setWork] = useState(null);
  const [editingReceipt, setEditingReceipt] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [notice, setNotice] = useState('');
  const scrollRef = useRef(null);

  async function run(action, callback) {
    if (work) return;
    setNotice('');
    setWork(action);
    try {
      await callback();
    } finally {
      setWork(null);
    }
  }

  async function addReceipt() {
    if (!parsePaymentAlert(receipt)) {
      setNotice('No completed payment found. Paste the full alert.');
      return;
    }
    try {
      const { added, offline } = await capture.queue([{ body: receipt }]);
      if (!added) {
        setNotice('This payment has already been processed.');
        return;
      }
      Keyboard.dismiss();
      setEditingReceipt(false);
      setReceipt('');
      setNotice(offline ? 'Saved on this phone. It will sync when you reconnect.' : 'Added to Needs Verification.');
    } catch {
      setNotice('Could not save this receipt. Try again.');
    }
  }

  const disabled = !user || !!work;
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.screen}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <Text accessibilityRole="header" style={styles.section}>Transactions</Text>
        <View style={styles.group}>
          <ActionRow icon="flash-outline" title="Quick transactions" description="Save an entry you add often."
            onPress={() => router.push('/quick-transactions')} />
          <ActionRow icon="calendar-outline" title="Recurring transactions" description="Log entries on selected weekdays."
            onPress={() => router.push('/recurring-transactions')} last />
        </View>
        <Text accessibilityRole="header" style={[styles.section, styles.nextSection]}>Payment alerts</Text>
        <View style={styles.group}>
          <View style={[styles.row, upiNative && capture.enabled && styles.divider]}>
            <Ionicons name="flash-outline" size={22} color={Colors.secondary} />
            <View style={styles.rowCopy}>
              <Text style={styles.label}>Automatic capture</Text>
              <Text style={styles.description}>
                {upiNative ? 'Add bank SMS and GPay alerts to your review queue.' : 'Requires the Android app.'}
              </Text>
            </View>
            <Switch accessibilityLabel="Automatic payment capture" value={capture.enabled}
              disabled={disabled || !upiNative}
              onValueChange={value => run('permissions', () => capture.setAutoCapture(value))}
              trackColor={{ true: Colors.primary }} />
          </View>
          {!!upiNative && capture.enabled && (
            <ActionRow icon="notifications-outline" title="GPay notification access"
              description={capture.notificationAccess ? 'Allowed · Manage in Android settings' : 'Allow access in Android settings'}
              disabled={disabled} onPress={() => upiNative.openNotificationSettings()} last />
          )}
        </View>

        <Text accessibilityRole="header" style={[styles.section, styles.nextSection]}>Add an alert</Text>
        <View style={styles.group}>
          {!!upiNative && (
            <ActionRow icon="scan-outline" title={work === 'scan' ? 'Scanning…' : 'Scan recent bank SMS'}
              description="Check the last 7 days." busy={work === 'scan'} disabled={disabled}
              onPress={() => run('scan', capture.scan)} />
          )}
          <ActionRow icon="clipboard-outline" title="Paste SMS or GPay receipt"
            description="Add a payment from an alert you copied." disabled={disabled || editingReceipt}
            onPress={() => { setNotice(''); setEditingReceipt(true); }} last />
        </View>

        {editingReceipt && (
          <View style={styles.editor} onLayout={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            <Text style={styles.label}>Receipt text</Text>
            <TextInput accessibilityLabel="Receipt text" autoFocus multiline value={receipt} style={styles.input}
              onChangeText={setReceipt} placeholder="Paste the full alert" placeholderTextColor={Colors.textMuted}
              maxLength={1600} editable={!work} />
            <View style={styles.editorActions}>
              <Pressable accessibilityRole="button" disabled={!!work} style={styles.secondaryButton}
                onPress={() => { Keyboard.dismiss(); setEditingReceipt(false); setNotice(''); }}>
                <ActionLabel style={styles.secondaryText}>Cancel</ActionLabel>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={disabled || !receipt.trim()}
                onPress={() => run('paste', addReceipt)}
                style={[styles.primaryButton, (disabled || !receipt.trim()) && styles.disabled]}>
                <ActionLabel style={styles.primaryText}>{work === 'paste' ? 'Saving…' : 'Add to review'}</ActionLabel>
              </Pressable>
            </View>
          </View>
        )}
        {!!(notice || capture.message) && (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice || capture.message}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.dark },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  section: { marginBottom: 8, color: Colors.secondary, fontSize: 13, fontWeight: '600' },
  nextSection: { marginTop: 24 },
  group: { backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowCopy: { flex: 1, gap: 4 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  pressed: { backgroundColor: Colors.cardElevated },
  label: { color: Colors.accent, fontWeight: '600', fontSize: 15 },
  description: { color: Colors.secondary, fontSize: 13, lineHeight: 18 },
  editor: { marginTop: 12, padding: 14, gap: 12, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderLight },
  input: { minHeight: 100, textAlignVertical: 'top', color: Colors.accent, padding: 12, borderWidth: 1, borderRadius: 10, borderColor: Colors.borderLight },
  editorActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
  primaryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, backgroundColor: Colors.primary },
  primaryText: { color: Colors.dark, fontWeight: '700' },
  secondaryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  secondaryText: { color: Colors.accent, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  notice: { marginTop: 12, color: Colors.secondary, fontSize: 13, lineHeight: 19 },
});
