import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/colors';

export const transactionFormStyles = StyleSheet.create({
  label: { color: Colors.secondary, fontSize: 12, marginBottom: 5, marginLeft: 5, fontWeight: '500' },
  input: { backgroundColor: Colors.primary + '20', borderColor: Colors.secondary, borderWidth: 1, borderRadius: 10, padding: 12, color: Colors.accent, marginBottom: 15, fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  category: { marginBottom: 15 },
  submit: { backgroundColor: Colors.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, minHeight: 50, justifyContent: 'center' },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: Colors.dark, fontWeight: '600', fontSize: 15, textAlign: 'center' },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: Colors.secondary, fontSize: 14, fontWeight: '600' },
});

export const transactionPlaceholderColor = Colors.secondary + '9c';

export function TransactionTypeField({ value, onChange }) {
  return (
    <>
      <Text style={transactionFormStyles.label}>Type</Text>
      <View style={styles.typeContainer}>
        {['expense', 'income'].map((type) => {
          const selected = type === value;
          return (
            <TouchableOpacity key={type} accessibilityRole="button" accessibilityState={{ selected }}
              style={[styles.typeButton, selected && (type === 'expense' ? styles.expense : styles.income)]}
              onPress={() => onChange(type)} activeOpacity={0.7}>
              <Text style={[styles.typeText, selected && styles.selectedText]}>{type === 'expense' ? 'Expense' : 'Income'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  typeContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  typeButton: { flex: 1, minHeight: 48, padding: 12, borderRadius: 10, backgroundColor: Colors.primary + '20', borderColor: Colors.secondary, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  expense: { backgroundColor: Colors.red + '30', borderColor: Colors.red },
  income: { backgroundColor: Colors.green + '30', borderColor: Colors.green },
  typeText: { color: Colors.secondary, fontWeight: '500', textAlign: 'center' },
  selectedText: { color: Colors.accent },
});
