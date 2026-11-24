import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/colors';
import { parseUpiAlert } from '../utils/smsParser';
import { reviewPendingBudget } from '../utils/sync';
import { upiNative } from '../utils/upiNative';
import PendingVerifySheet, { ReviewSheet, styles } from './PendingVerifySheet';

export function PendingUpiBanner({ count, onPress }) {
    if (!count) return null;
    return (
        <TouchableOpacity accessibilityRole="button" onPress={onPress} style={local.pending}>
            <Text style={local.pendingText}>Needs Verification ({count})</Text>
            <Ionicons name="chevron-forward" size={17} color={Colors.warning} />
        </TouchableOpacity>
    );
}

function SettingsAction({ icon, label, onPress, disabled = false }) {
    return (
        <TouchableOpacity accessibilityRole="button" onPress={onPress} disabled={disabled}
            style={[local.action, disabled && local.disabled]}>
            <Ionicons name={icon} size={20} color={Colors.secondary} />
            <Text style={local.actionLabel}>{label}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
    );
}

export default function UpiCaptureControls({ user, capture, sheet, setSheet, onVerified }) {
    const [receipt, setReceipt] = useState('');
    const [feedback, setFeedback] = useState('');
    const [work, setWork] = useState(null);
    if (!user || !sheet) return null;

    async function runAction(action, callback) {
        if (work) return;
        setWork(action);
        try {
            await callback();
        } finally {
            setWork(null);
        }
    }

    async function paste() {
        if (!parseUpiAlert(receipt)) {
            setFeedback('No completed UPI payment found. Paste the full alert.');
            return;
        }
        setFeedback('');
        try {
            const { added, offline } = await capture.queue([{ body: receipt }]);
            setFeedback(!added
                ? 'This payment has already been processed.'
                : offline ? 'Saved on this phone. It will sync when you reconnect.' : 'Added to the review queue.');
            if (added) setReceipt('');
        } catch {
            setFeedback('Could not save this receipt. Try again.');
        }
    }

    async function review(item, edit) {
        await reviewPendingBudget(user, item, edit);
        capture.setItems(items => items.filter(row => row._id !== item._id));
        if (edit) await onVerified();
    }

    if (sheet === 'review') {
        return <PendingVerifySheet visible items={capture.items} onClose={() => setSheet(null)} onReview={review} />;
    }

    const pasting = sheet === 'paste';
    return (
        <ReviewSheet
            visible
            title={pasting ? 'Paste a receipt' : 'Settings'}
            closeLabel={pasting ? 'Back' : 'Done'}
            onClose={() => setSheet(pasting ? 'settings' : null)}
        >
            {pasting ? (
                <>
                    <TextInput accessibilityLabel="SMS or receipt text" multiline value={receipt}
                        onChangeText={setReceipt} maxLength={1600} editable={work !== 'paste'}
                        placeholder="Paste your UPI alert here" placeholderTextColor={Colors.secondary}
                        style={[styles.input, local.receipt]} />
                    <SettingsAction icon="checkmark-circle-outline" label={work === 'paste' ? 'Saving…' : 'Add to review queue'}
                        disabled={!!work || !receipt.trim()} onPress={() => runAction('paste', paste)} />
                    {!!feedback && <Text accessibilityLiveRegion="polite" style={local.message}>{feedback}</Text>}
                </>
            ) : (
                <>
                    <Text accessibilityRole="header" style={local.section}>UPI capture</Text>
                    <View style={local.card}>
                        <View style={local.toggle}>
                            <View style={local.toggleText}>
                                <Text style={local.actionLabel}>Auto-Parse GPay / UPI Alerts</Text>
                                <Text style={local.description}>
                                    {upiNative ? 'Send bank SMS and GPay alerts to your review queue.' : 'Automatic capture requires the Android app.'}
                                </Text>
                            </View>
                            <Switch accessibilityLabel="Auto-Parse GPay / UPI Alerts" value={capture.enabled}
                                disabled={!upiNative || !!work}
                                onValueChange={value => runAction('permissions', () => capture.setAutoCapture(value))}
                                trackColor={{ true: Colors.primary }} />
                        </View>
                        {upiNative && capture.enabled && (
                            <SettingsAction icon="notifications-outline" disabled={!!work}
                                label={capture.notificationAccess ? 'Manage GPay notification access' : 'Enable GPay notification access'}
                                onPress={() => upiNative.openNotificationSettings()} />
                        )}
                        {!!upiNative && (
                            <SettingsAction icon="scan-outline" disabled={!!work}
                                label={work === 'scan' ? 'Scanning…' : 'Scan recent UPI SMS'}
                                onPress={() => runAction('scan', capture.scan)} />
                        )}
                        <SettingsAction icon="clipboard-outline" label="Paste SMS or GPay receipt" disabled={!!work}
                            onPress={() => { setFeedback(''); setSheet('paste'); }} />
                    </View>
                    {!!capture.message && <Text accessibilityLiveRegion="polite" style={local.message}>{capture.message}</Text>}
                </>
            )}
        </ReviewSheet>
    );
}

const local = StyleSheet.create({
    pending: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FBBF2440', borderRadius: 12, backgroundColor: '#FBBF2410' },
    pendingText: { color: Colors.warning, fontWeight: '700', flexShrink: 1 },
    section: { color: Colors.secondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
    card: { backgroundColor: Colors.cardElevated, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden' },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    toggleText: { flex: 1, gap: 4 },
    description: { color: Colors.secondary, fontSize: 13, lineHeight: 18 },
    action: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderLight },
    actionLabel: { color: Colors.accent, flexShrink: 1, flexGrow: 1, fontSize: 14, fontWeight: '600' },
    disabled: { opacity: 0.45 },
    message: { color: Colors.secondary, fontSize: 13, lineHeight: 18, marginTop: 10 },
    receipt: { minHeight: 120, textAlignVertical: 'top' },
});
