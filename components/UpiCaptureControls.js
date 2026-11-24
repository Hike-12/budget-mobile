import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/colors';
import { parseUpiAlert } from '../utils/smsParser';
import { upiNative } from '../utils/upiNative';
import PendingVerifySheet, { ReviewSheet, styles } from './PendingVerifySheet';
import { reviewPendingBudget } from '../utils/sync';

export default function UpiCaptureControls({ user, capture, onVerified }) {
    const [sheet, setSheet] = useState(null);
    const [receipt, setReceipt] = useState('');
    const [feedback, setFeedback] = useState('');
    const [busy, setBusy] = useState(false);
    if (!user) return null;

    async function paste() {
        const item = parseUpiAlert(receipt);
        if (!item) {
            setFeedback('No completed UPI payment found. Include the amount and payment details.');
            return;
        }
        setBusy(true);
        try {
            const { added, offline } = await capture.queue([{ body: receipt }]);
            setFeedback(added ? (offline ? 'Saved on this device. It will sync when you reconnect.' : 'Added to Needs Verification.') : 'This alert has already been processed.');
            if (added) setReceipt('');
        } catch {
            setFeedback('Could not save this receipt. Try again.');
        } finally {
            setBusy(false);
        }
    }

    async function review(item, edit) {
        await reviewPendingBudget(user, item, edit);
        capture.setItems(items => items.filter(row => row._id !== item._id));
        if (edit) await onVerified();
    }

    return (
        <View style={local.group}>
            {capture.items.length > 0 && (
                <TouchableOpacity accessibilityRole="button" onPress={() => setSheet('review')} style={local.pending}>
                    <Text style={local.pendingText}>Needs Verification ({capture.items.length})</Text>
                    <Text style={local.pendingText}>Review ›</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity accessibilityRole="button" onPress={() => setSheet('settings')} style={local.settings}>
                <Text style={styles.action}>UPI capture settings</Text>
            </TouchableOpacity>
            <PendingVerifySheet visible={sheet === 'review'} items={capture.items} onClose={() => setSheet(null)} onReview={review} />
            <ReviewSheet visible={sheet === 'settings'} title="UPI capture" onClose={() => setSheet(null)}>
                <View style={styles.header}>
                    <Text style={styles.heading}>Auto-Parse GPay / UPI Alerts</Text>
                    <Switch accessibilityLabel="Auto-Parse GPay / UPI Alerts" value={capture.enabled}
                        onValueChange={capture.setAutoCapture} trackColor={{ true: Colors.primary }} />
                </View>
                <Text style={styles.hint}>
                    {upiNative
                        ? 'Allow Android SMS access to capture bank UPI alerts. GPay notifications require separate notification access. Captured items sync for review when Budget Mobile is open.'
                        : 'Automatic capture and inbox scanning require a native Android build. Paste a receipt to try parsing here.'}
                </Text>
                {upiNative && capture.enabled && (
                    <TouchableOpacity accessibilityRole="button" onPress={() => upiNative.openNotificationSettings()}>
                        <Text style={styles.action}>{capture.notificationAccess ? 'Manage GPay notification access' : 'Enable GPay notification access'}</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity accessibilityRole="button" onPress={capture.scan}><Text style={styles.action}>Scan Recent UPI SMS</Text></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => { setFeedback(''); setSheet('paste'); }}><Text style={styles.action}>Paste SMS / GPay Receipt</Text></TouchableOpacity>
                {!!capture.message && <Text accessibilityLiveRegion="polite" style={styles.hint}>{capture.message}</Text>}
            </ReviewSheet>
            <ReviewSheet visible={sheet === 'paste'} title="Paste SMS / GPay Receipt" onClose={() => setSheet('settings')}>
                <TextInput accessibilityLabel="SMS or receipt text" multiline value={receipt} onChangeText={setReceipt} maxLength={1600}
                    placeholder="Paste your UPI alert here" placeholderTextColor={Colors.secondary} style={[styles.input, local.receipt]} />
                <TouchableOpacity accessibilityRole="button" disabled={busy || !receipt.trim()} onPress={paste}>
                    <Text style={styles.action}>{busy ? 'Saving…' : 'Parse and queue for review'}</Text>
                </TouchableOpacity>
                {!!feedback && <Text accessibilityLiveRegion="polite" style={styles.hint}>{feedback}</Text>}
            </ReviewSheet>
        </View>
    );
}

const local = StyleSheet.create({
    group: { marginBottom: 12 },
    pending: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: 14, borderWidth: 1, borderColor: '#FBBF2440', borderRadius: 12, backgroundColor: '#FBBF2410' },
    pendingText: { color: Colors.warning, fontWeight: '700' },
    settings: { alignSelf: 'flex-end', marginTop: 6 },
    receipt: { minHeight: 120, textAlignVertical: 'top' },
});
