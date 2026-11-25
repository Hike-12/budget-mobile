import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/colors';
import { MAIN_TRANSACTION_CATEGORIES } from '../constants/transactionCategories';

const labelFor = (category) => category.charAt(0).toUpperCase() + category.slice(1);

export default function TransactionCategoryPicker({ value, onChange, style }) {
  return (
    <View style={[styles.group, style]}>
      {!!value && !MAIN_TRANSACTION_CATEGORIES.includes(value) && (
        <Text style={styles.current}>Current category: {labelFor(value)}</Text>
      )}
      {MAIN_TRANSACTION_CATEGORIES.map((category) => {
        const selected = value === category;
        return (
          <TouchableOpacity
            key={category}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.button, selected && styles.selectedButton]}
            onPress={() => onChange(category)}
            activeOpacity={0.7}
          >
            <Text style={[styles.text, selected && styles.selectedText]}>
              {labelFor(category)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  current: { width: '100%', color: Colors.secondary, fontSize: 12 },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.secondary,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  selectedButton: { backgroundColor: Colors.secondary },
  text: { color: Colors.secondary, fontSize: 12 },
  selectedText: { color: Colors.dark, fontWeight: '500' },
});
