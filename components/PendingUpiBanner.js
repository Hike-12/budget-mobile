import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import Colors from '../constants/colors';

export function PendingUpiBanner({ count, onPress }) {
    if (!count) return null;
    return (
        <TouchableOpacity accessibilityRole="button" onPress={onPress} style={local.pending}>
            <Text style={local.pendingText}>Needs Verification ({count})</Text>
            <Ionicons name="chevron-forward" size={17} color={Colors.warning} />
        </TouchableOpacity>
    );
}

const local = StyleSheet.create({
  pending: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FBBF2440', borderRadius: 12, backgroundColor: '#FBBF2410' },
  pendingText: { color: Colors.warning, fontWeight: '700', flexShrink: 1 },
});
