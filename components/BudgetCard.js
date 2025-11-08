import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Colors from '../constants/colors';

export default function BudgetCard({ budget, onDelete, onEdit }) {
  function confirmDelete() {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(budget._id) },
      ]
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{budget.title}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => onEdit(budget)}>
            <Text style={styles.editButton}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmDelete}>
            <Text style={styles.deleteButton}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.amount}>{budget.amount}</Text>
      <Text style={styles.category}>{budget.category}</Text>
      {budget.note ? <Text style={styles.note}>{budget.note}</Text> : null}
      <View style={styles.footer}>
        <Text style={styles.date}>{new Date(budget.createdAt).toLocaleDateString()}</Text>
        <Text style={styles.type}>{budget.type}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { color: Colors.accent, fontSize: 16, fontWeight: '600' },
  type: { color: Colors.secondary, fontSize: 12, textTransform: 'uppercase', fontWeight: '600' },
  amount: { color: Colors.accent, fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  category: { color: Colors.secondary, fontSize: 12, fontStyle: 'italic', marginBottom: 3 },
  note: { color: Colors.secondary, fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
  footer: { color: Colors.accent, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  date: { color: Colors.secondary, fontSize: 11 },
  editButton: { color: Colors.primary, fontSize: 12, fontWeight: '600', marginRight: 10 },
  deleteButton: { color: Colors.red, fontSize: 12, fontWeight: '600' },
});