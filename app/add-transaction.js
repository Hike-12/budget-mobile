import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const categories = ['school friends', 'college friends', 'religion', 'personal', 'miscellaneous'];

export default function AddTransactionScreen() {
  const params = useLocalSearchParams();
  const isEdit = params.edit === 'true';

  const [title, setTitle] = useState(params.title || '');
  const [amount, setAmount] = useState(params.amount ? String(params.amount) : '');
  const [type, setType] = useState(params.type || 'expense');
  const [category, setCategory] = useState(params.category || 'miscellaneous');
  const [note, setNote] = useState(params.note || '');
  const router = useRouter();

  // Import syncWithServer from dashboard.js
  async function syncWithServer() {
    const user = await AsyncStorage.getItem('username');
    const queue = await AsyncStorage.getItem('unsynced');
    const unsynced = queue ? JSON.parse(queue) : [];
    for (const change of unsynced) {
      try {
        if (change.action === 'add') {
          await axios.post(`https://budget-tracker-aliqyaan.vercel.app/api/budgets`, { ...change.budget, user });
        } else if (change.action === 'delete') {
          await axios.delete(`https://budget-tracker-aliqyaan.vercel.app/api/budgets`, { data: { id: change.id, user } });
        } else if (change.action === 'edit') {
          await axios.patch(`https://budget-tracker-aliqyaan.vercel.app/api/budgets`, { ...change.budget, user, id: change.budget._id });
        }
      } catch (e) {}
    }
    await AsyncStorage.setItem('unsynced', JSON.stringify([]));
    try {
      const res = await axios.get(`https://budget-tracker-aliqyaan.vercel.app/api/budgets?user=${user}`);
      await AsyncStorage.setItem('budgets', JSON.stringify(res.data));
    } catch (e) {}
  }

  async function handleSubmit() {
    if (!title || !amount) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    try {
      const user = await AsyncStorage.getItem('username');
      const budget = {
        title,
        amount: Number(amount),
        type,
        category,
        note,
        createdAt: new Date(),
        user,
        _id: Date.now().toString()
      };
      // Save locally
      const localBudgets = await AsyncStorage.getItem('budgets');
      const budgetsArr = localBudgets ? JSON.parse(localBudgets) : [];
      budgetsArr.push(budget);
      await AsyncStorage.setItem('budgets', JSON.stringify(budgetsArr));
      // Add to unsynced queue
      const queue = await AsyncStorage.getItem('unsynced');
      const unsynced = queue ? JSON.parse(queue) : [];
      unsynced.push({ action: 'add', budget });
      await AsyncStorage.setItem('unsynced', JSON.stringify(unsynced));
      // If online, sync
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        await syncWithServer();
      }
      router.replace('/dashboard');
    } catch (error) {
      Alert.alert('Error', isEdit ? 'Failed to edit transaction' : 'Failed to add transaction');
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} placeholder="Enter title" placeholderTextColor={Colors.secondary} value={title} onChangeText={setTitle} />
        <Text style={styles.label}>Amount</Text>
        <TextInput style={styles.input} placeholder="Enter amount" placeholderTextColor={Colors.secondary} keyboardType="numeric" value={amount} onChangeText={setAmount} />
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeContainer}>
          <TouchableOpacity style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]} onPress={() => setType('expense')}>
            <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeButton, type === 'income' && styles.typeButtonActive]} onPress={() => setType('income')}>
            <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>Income</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryContainer}>
          {categories.map(cat => (
            <TouchableOpacity key={cat} style={[styles.categoryButton, category === cat && styles.categoryButtonActive]} onPress={() => setCategory(cat)}>
              <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Note (Optional)</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="Add a note" placeholderTextColor={Colors.secondary} multiline numberOfLines={3} value={note} onChangeText={setNote} />
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>{isEdit ? 'Save Changes' : 'Add Transaction'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: Colors.dark },
  label: { color: Colors.secondary, fontSize: 12, marginBottom: 5, marginLeft: 5 },
  input: { backgroundColor: Colors.primary + '20', borderColor: Colors.secondary, borderWidth: 1, borderRadius: 10, padding: 12, color: Colors.accent, marginBottom: 15 },
  textArea: { height: 80, textAlignVertical: 'top' },
  typeContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  typeButton: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: Colors.primary + '20', borderColor: Colors.secondary, borderWidth: 1, alignItems: 'center' },
  typeButtonActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  typeText: { color: Colors.secondary, fontWeight: '600' },
  typeTextActive: { color: Colors.dark },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  categoryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.primary + '20', borderColor: Colors.secondary, borderWidth: 1 },
  categoryButtonActive: { backgroundColor: Colors.secondary },
  categoryText: { color: Colors.secondary, fontSize: 12 },
  categoryTextActive: { color: Colors.dark, fontWeight: '600' },
  submitButton: { backgroundColor: Colors.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  submitButtonText: { color: Colors.dark, fontWeight: 'bold', fontSize: 16 },
});