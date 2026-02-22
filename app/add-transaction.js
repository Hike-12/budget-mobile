import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Colors from '../constants/colors';

const API_URL = 'https://budget-tracker-aliqyaan.vercel.app';
const categories = ['school friends', 'college friends', 'religion', 'personal', 'miscellaneous'];

export default function AddTransactionScreen() {
  const params = useLocalSearchParams();
  const isEdit = params.edit === 'true';

  const [title, setTitle] = useState(params.title || '');
  const [amount, setAmount] = useState(params.amount ? String(params.amount) : '');
  const [type, setType] = useState(params.type || 'expense');
  const [category, setCategory] = useState(params.category || 'miscellaneous');
  const [note, setNote] = useState(params.note || '');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !amount.trim()) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const user = await AsyncStorage.getItem('username');
      const budgetId = isEdit && params._id
        ? params._id
        : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const budget = {
        title: title.trim(),
        amount: Number(amount),
        type,
        category,
        note: note.trim(),
        createdAt: isEdit && params.createdAt ? params.createdAt : new Date().toISOString(),
        user,
        _id: budgetId,
      };

      const localBudgets = await AsyncStorage.getItem('budgets');
      let budgetsArr = localBudgets ? JSON.parse(localBudgets) : [];

      if (isEdit) {
        budgetsArr = budgetsArr.map(b => b._id === budgetId ? budget : b);
      } else {
        budgetsArr.push(budget);
      }

      await AsyncStorage.setItem('budgets', JSON.stringify(budgetsArr));

      const queue = await AsyncStorage.getItem('unsynced');
      const unsynced = queue ? JSON.parse(queue) : [];
      const alreadyQueued = unsynced.some(item => {
        if (isEdit) return item.action === 'edit' && item.budget && item.budget._id === budgetId;
        return item.action === 'add' && item.budget && item.budget._id === budgetId;
      });

      if (!alreadyQueued) {
        unsynced.push({ action: isEdit ? 'edit' : 'add', budget });
        await AsyncStorage.setItem('unsynced', JSON.stringify(unsynced));
      }

      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        await syncWithServer();
      }

      router.replace('/dashboard');
    } catch {
      Alert.alert('Error', isEdit ? 'Failed to edit transaction' : 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  }, [title, amount, type, category, note, isEdit, params, router]);

  async function syncWithServer() {
    const user = await AsyncStorage.getItem('username');
    let queue = await AsyncStorage.getItem('unsynced');
    let unsynced = queue ? JSON.parse(queue) : [];
    const newQueue = [];

    const map = new Map();
    for (let i = unsynced.length - 1; i >= 0; i--) {
      const c = unsynced[i];
      const key = c.action === 'delete' ? c.id : c.budget?._id;
      if (!map.has(key)) map.set(key, c);
    }
    unsynced = Array.from(map.values()).reverse();

    const serverList = (await axios.get(`${API_URL}/api/budgets?user=${user}`)).data || [];
    const serverByClientId = new Set(serverList.filter(b => b.clientId).map(b => b.clientId));

    for (const change of unsynced) {
      let success = false;
      try {
        if (change.action === 'add') {
          const clientId = change.budget._id;
          if (!serverByClientId.has(clientId)) {
            await axios.post(`${API_URL}/api/budgets`, { ...change.budget, clientId, user });
            serverByClientId.add(clientId);
          }
          success = true;
        } else if (change.action === 'edit') {
          const clientId = change.budget._id;
          await axios.patch(`${API_URL}/api/budgets`, { ...change.budget, clientId, user, id: clientId });
          success = true;
        } else if (change.action === 'delete') {
          await axios.delete(`${API_URL}/api/budgets`, { data: { id: change.id, clientId: change.id, user } });
          success = true;
        }
      } catch { success = false; }
      if (!success) newQueue.push(change);
    }
    await AsyncStorage.setItem('unsynced', JSON.stringify(newQueue));
    const res = await axios.get(`${API_URL}/api/budgets?user=${user}`);
    await AsyncStorage.setItem('budgets', JSON.stringify(res.data));
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter title"
          placeholderTextColor={Colors.secondary}
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
        />

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter amount"
          placeholderTextColor={Colors.secondary}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          returnKeyType="next"
        />

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeContainer}>
          <TouchableOpacity
            style={[styles.typeButton, type === 'expense' && styles.typeButtonActiveExpense]}
            onPress={() => setType('expense')}
            activeOpacity={0.7}
          >
            <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, type === 'income' && styles.typeButtonActiveIncome]}
            onPress={() => setType('income')}
            activeOpacity={0.7}
          >
            <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>Income</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryContainer}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryButton, category === cat && styles.categoryButtonActive]}
              onPress={() => setCategory(cat)}
              activeOpacity={0.7}
            >
              <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Note (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Add a note"
          placeholderTextColor={Colors.secondary}
          multiline
          numberOfLines={3}
          value={note}
          onChangeText={setNote}
        />

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.dark} size="small" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isEdit ? 'Save Changes' : 'Add Transaction'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: Colors.dark,
  },
  label: {
    color: Colors.secondary,
    fontSize: 12,
    marginBottom: 5,
    marginLeft: 5,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.secondary,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: Colors.accent,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.secondary,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  typeButtonActiveExpense: {
    backgroundColor: Colors.red + '30',
    borderColor: Colors.red,
  },
  typeButtonActiveIncome: {
    backgroundColor: Colors.green + '30',
    borderColor: Colors.green,
  },
  typeText: {
    color: Colors.secondary,
    fontWeight: '500',
  },
  typeTextActive: {
    color: Colors.accent,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.secondary,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  categoryButtonActive: {
    backgroundColor: Colors.secondary,
  },
  categoryText: {
    color: Colors.secondary,
    fontSize: 12,
  },
  categoryTextActive: {
    color: Colors.dark,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 50,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: Colors.dark,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
    width: '100%',
  },
});