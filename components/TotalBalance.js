import { View, Text, StyleSheet } from 'react-native';
import Colors from '../constants/colors';

export default function TotalBalance({ budgets }) {
  const total = budgets.reduce((acc, b) => (b.type === 'income' ? acc + b.amount : acc - b.amount), 0);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Total Balance</Text>
      <Text style={[styles.amount, { color: total >= 0 ? Colors.primary : Colors.red }]}>
        ₹ {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary, borderWidth: 1, borderRadius: 15, padding: 20, marginBottom: 20 },
  label: { color: Colors.accent, fontSize: 16, fontWeight: '600' },
  amount: { fontSize: 32, fontWeight: 'bold', marginTop: 5 },
});