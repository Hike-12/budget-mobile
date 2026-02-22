import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Toast } from '../components/Toast';
import Colors from '../constants/colors';
import { syncWithServer } from '../utils/sync';

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
      Toast.show({ message: 'Please fill in title and amount.', type: 'warning' });
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Toast.show({ message: 'Please enter a valid amount.', type: 'warning' });
      return;
    }

    try {
      setLoading(true);
      const user = await AsyncStorage.getItem('username');
      const budgetId = isEdit && params._id
        ? params._id
        : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const budget = {
        title: title.trim(),
        amount: numAmount,
        type,
        category,
        note: note.trim(),
        createdAt: isEdit && params.createdAt ? params.createdAt : new Date().toISOString(),
        user,
        _id: budgetId,
      };

      // Update local storage
      const raw = await AsyncStorage.getItem('budgets');
      let budgetsArr = raw ? JSON.parse(raw) : [];

      if (isEdit) {
        budgetsArr = budgetsArr.map(b => b._id === budgetId ? budget : b);
      } else {
        budgetsArr.push(budget);
      }
      await AsyncStorage.setItem('budgets', JSON.stringify(budgetsArr));

      // Queue for sync
      const queueRaw = await AsyncStorage.getItem('unsynced');
      const unsynced = queueRaw ? JSON.parse(queueRaw) : [];
      const action = isEdit ? 'edit' : 'add';
      const alreadyQueued = unsynced.some(item =>
        item.action === action && item.budget?._id === budgetId
      );
      if (!alreadyQueued) {
        unsynced.push({ action, budget });
        await AsyncStorage.setItem('unsynced', JSON.stringify(unsynced));
      }

      // Sync if online
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        await syncWithServer(user);
        Toast.show({ message: isEdit ? 'Transaction updated!' : 'Transaction added!', type: 'success' });
      } else {
        Toast.show({ message: 'Saved offline. Will sync when connected.', type: 'info' });
      }

      router.replace('/dashboard');
    } catch {
      Toast.show({ message: isEdit ? 'Failed to update transaction.' : 'Failed to add transaction.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [title, amount, type, category, note, isEdit, params, router]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Stack.Screen options={{ title: isEdit ? 'Edit Transaction' : 'Add Transaction' }} />
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
          {loading
            ? <ActivityIndicator color={Colors.dark} size="small" />
            : <Text style={styles.submitButtonText} numberOfLines={1} adjustsFontSizeToFit>
              {isEdit ? 'Save Changes' : 'Add Transaction'}
            </Text>
          }
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
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
});