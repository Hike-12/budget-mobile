import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/colors';
import { REVIEW_CATEGORIES } from '../utils/smsParser';

export function ReviewSheet({ visible, title, onClose, children }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.heading} accessibilityRole="header">{title}</Text>
                        <TouchableOpacity onPress={onClose} accessibilityRole="button"><Text style={styles.action}>Done</Text></TouchableOpacity>
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

export default function PendingVerifySheet({ visible, items, onClose, onReview }) {
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');
    async function review(item, edit) {
        if (busy) return;
        setBusy(item._id);
        setError('');
        try {
            await onReview(item, edit);
        } catch {
            setError('Could not save your review. Try again when connected.');
        } finally {
            setBusy(null);
        }
    }

    return (
        <ReviewSheet visible={visible} title="Needs Verification" onClose={onClose}>
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {!items.length && <Text style={styles.hint}>You are all caught up.</Text>}
            {items.map(item => <PendingRow key={item._id} item={item} onReview={review} busy={!!busy} />)}
        </ReviewSheet>
    );
}

function PendingRow({ item, onReview, busy }) {
    const [title, setTitle] = useState(item.title);
    const [category, setCategory] = useState(REVIEW_CATEGORIES.includes(item.category) ? item.category : 'Other');
    const income = item.type === 'income';
    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.heading}>₹{Number(item.amount).toLocaleString('en-IN')}</Text>
                <Text style={[styles.badge, { color: income ? Colors.green : Colors.warning }]}>{income ? 'Credit' : 'Debit'}</Text>
            </View>
            <TextInput accessibilityLabel="Merchant name" value={title} onChangeText={setTitle} maxLength={80} style={styles.input} />
            <View style={styles.chips}>
                {REVIEW_CATEGORIES.map(option => (
                    <TouchableOpacity key={option} accessibilityRole="button" accessibilityState={{ selected: option === category }}
                        onPress={() => setCategory(option)} style={[styles.chip, option === category && styles.selected]}>
                        <Text style={styles.action}>{option}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <View style={styles.header}>
                <TouchableOpacity accessibilityRole="button" disabled={busy || !title.trim()} onPress={() => onReview(item, { title: title.trim(), category })}>
                    <Text style={styles.action}>✓ Verify &amp; Add</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => onReview(item, null)}>
                    <Text style={styles.error}>✕ Ignore</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0009' },
    sheet: { maxHeight: '85%', padding: 20, paddingBottom: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 },
    heading: { color: Colors.accent, fontSize: 18, fontWeight: '700', flexShrink: 1 },
    hint: { color: Colors.secondary, marginBottom: 12, lineHeight: 20 },
    card: { padding: 14, marginBottom: 12, backgroundColor: Colors.cardElevated, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
    input: { color: Colors.accent, borderColor: Colors.borderLight, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
    action: { color: Colors.secondary, paddingVertical: 6, fontWeight: '700' },
    badge: { backgroundColor: Colors.dark, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    error: { color: Colors.red, paddingVertical: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    chip: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 12, paddingHorizontal: 8 },
    selected: { borderColor: Colors.primary, backgroundColor: Colors.dark },
});

