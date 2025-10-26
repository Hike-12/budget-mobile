import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Colors from '../constants/colors';

export default function BudgetCard({ budget, onDelete }) {
  function confirmDelete() {
    Alert.alert('Delete Transaction', 'Are you sure you want to delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  }

  return (
    <View style={[styles.card, { borderColor: budget.type === 'income' ? Colors.primary : Colors.red }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{budget.title}</Text>
        <Text style={[styles.type, { color: budget.type === 'income' ? Colors.primary : Colors.red }]}>
          {budget.type}
        </Text>
      </View>
      <Text style={[styles.amount, { color: budget.type === 'income' ? Colors.primary : Colors.red }]}>
        {budget.type === 'income' ? '+' : '-'}₹ {budget.amount}
      </Text>
      <Text style={styles.category}>{budget.category}</Text>
      {budget.note && <Text style={styles.note}>{budget.note}</Text>}
      <View style={styles.footer}>
        <Text style={styles.date}>{new Date(budget.createdAt).toLocaleDateString()}</Text>
        <TouchableOpacity onPress={confirmDelete}>
          <Text style={styles.deleteButton}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.dark, borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { color: Colors.accent, fontSize: 16, fontWeight: '600' },
  type: { fontSize: 12, textTransform: 'uppercase', fontWeight: '600' },
  amount: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  category: { color: Colors.secondary, fontSize: 12, fontStyle: 'italic', marginBottom: 3 },
  note: { color: Colors.secondary, fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  date: { color: Colors.secondary, fontSize: 11 },
  deleteButton: { color: Colors.red, fontSize: 12, fontWeight: '600' },
});