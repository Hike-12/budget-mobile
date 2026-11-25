import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Toast } from '../components/Toast';
import ActionLabel from '../components/ActionLabel';
import Colors from '../constants/colors';
import TransactionCategoryPicker from '../components/TransactionCategoryPicker';
import TransactionCalendar from '../components/TransactionCalendar';
import { transactionFormStyles as formStyles, transactionPlaceholderColor, TransactionTypeField } from '../components/TransactionFormFields';
import { addToUnsyncedQueue, syncWithServer } from '../utils/sync';

function calcPreview(expr) {
  if (!expr || !/[+\-*/]/.test(expr)) return null;
  const sanitized = expr.replace(/[^0-9.+\-*/]/g, '').trim();
  if (!sanitized) return null;
  try {
    const result = Function(`"use strict"; return (${sanitized})`)();
    if (typeof result === 'number' && isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
    return null;
  } catch {
    return null;
  }
}

export default function AddTransactionScreen() {
  const params = useLocalSearchParams();
  const isEdit = params.edit === 'true';
  const parsedInitialDate = params.createdAt ? new Date(params.createdAt) : new Date();
  const initialDate = Number.isNaN(parsedInitialDate.getTime()) ? new Date() : parsedInitialDate;

  const [title, setTitle] = useState(params.title || '');
  const [amount, setAmount] = useState(params.amount ? String(params.amount) : '');
  const [type, setType] = useState(params.type || 'expense');
  const [category, setCategory] = useState(params.category || 'miscellaneous');
  const [note, setNote] = useState(params.note || '');
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [loading, setLoading] = useState(false);
  const [calcExpr, setCalcExpr] = useState(null);
  const [calcResult, setCalcResult] = useState(null);
  const [convertedFrom, setConvertedFrom] = useState(null);
  const [convertedTo, setConvertedTo] = useState(null);
  const calcTimeoutRef = useRef(null);
  const amountRef = useRef(amount);
  const submitInFlightRef = useRef(false);
  const draftBudgetIdRef = useRef(
    isEdit && params._id
      ? String(params._id)
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  useEffect(() => {
    amountRef.current = amount;
  }, [amount]);

  useEffect(() => {
    return () => {
      if (calcTimeoutRef.current) clearTimeout(calcTimeoutRef.current);
    };
  }, []);

  const handleAmountChange = useCallback((value) => {
    setAmount(value);
    if (calcTimeoutRef.current) clearTimeout(calcTimeoutRef.current);

    // Reconstruct full expression if continuing from a previous conversion
    let displayExpr = value;
    if (convertedFrom && convertedTo && value.startsWith(convertedTo)) {
      const rest = value.slice(convertedTo.length);
      if (rest && /^[+\-*/]/.test(rest)) {
        displayExpr = convertedFrom + rest;
      } else {
        setConvertedFrom(null);
        setConvertedTo(null);
      }
    } else if (convertedFrom) {
      setConvertedFrom(null);
      setConvertedTo(null);
    }

    if (value && /[+\-*/]/.test(value)) {
      // If value ends with an operator, user is mid-expression — keep current preview
      if (/[+\-*/]$/.test(value)) return;

      const result = calcPreview(displayExpr);
      if (result !== null) {
        setCalcExpr(displayExpr);
        setCalcResult(result);
        calcTimeoutRef.current = setTimeout(() => {
          setAmount(String(result));
          setConvertedFrom(displayExpr);
          setConvertedTo(String(result));
        }, 300);
        return;
      }
    }
    setCalcExpr(null);
    setCalcResult(null);
  }, [convertedFrom, convertedTo]);

  const router = useRouter();

  const handleSubmit = useCallback(async () => {
    if (submitInFlightRef.current) return;

    let resolvedAmount = amount;
    if (resolvedAmount && /[+\-*/]/.test(resolvedAmount)) {
      const evaled = calcPreview(resolvedAmount);
      if (evaled !== null) {
        resolvedAmount = String(evaled);
        setAmount(resolvedAmount);
        setCalcExpr(null);
        setCalcResult(null);
        setConvertedFrom(null);
        setConvertedTo(null);
      }
    }

    if (!title.trim() || !resolvedAmount.trim()) {
      Toast.show({ message: 'Please fill in title and amount.', type: 'warning' });
      return;
    }
    const numAmount = Number(resolvedAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Toast.show({ message: 'Please enter a valid amount.', type: 'warning' });
      return;
    }

    if (!(selectedDate instanceof Date) || Number.isNaN(selectedDate.getTime())) {
      Toast.show({ message: 'Please select a valid date.', type: 'warning' });
      return;
    }

    try {
      submitInFlightRef.current = true;
      setLoading(true);
      const user = await AsyncStorage.getItem('username');
      const budgetId = draftBudgetIdRef.current;

      const budget = {
        title: title.trim(),
        amount: numAmount,
        type,
        category,
        note: note.trim(),
        createdAt: selectedDate.toISOString(),
        updatedAt: new Date().toISOString(),
        user,
        _id: budgetId,
      };

      // Update local storage
      const raw = await AsyncStorage.getItem('budgets');
      let budgetsArr = raw ? JSON.parse(raw) : [];

      if (isEdit) {
        budgetsArr = budgetsArr.map(b => b._id === budgetId ? budget : b);
      } else {
        const existingIndex = budgetsArr.findIndex(b => b._id === budgetId);
        if (existingIndex >= 0) {
          budgetsArr[existingIndex] = budget;
        } else {
          budgetsArr.push(budget);
        }
      }
      await AsyncStorage.setItem('budgets', JSON.stringify(budgetsArr));

      // Queue for sync (using the canonical dedup utility)
      const action = isEdit ? 'edit' : 'add';
      await addToUnsyncedQueue({ action, budget });

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
      submitInFlightRef.current = false;
      setLoading(false);
    }
  }, [title, amount, type, category, note, selectedDate, isEdit, router]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Stack.Screen options={{ title: isEdit ? 'Edit Transaction' : 'Add Transaction' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={formStyles.label}>Title</Text>
        <TextInput
          style={formStyles.input}
          placeholder="Enter title"
          placeholderTextColor={transactionPlaceholderColor}
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
        />

        <Text style={formStyles.label}>Amount</Text>
        <TextInput
          style={formStyles.input}
          placeholder="Enter amount"
          placeholderTextColor={transactionPlaceholderColor}
          keyboardType="numeric"
          value={amount}
          onChangeText={handleAmountChange}
          onBlur={() => {
            if (calcTimeoutRef.current) clearTimeout(calcTimeoutRef.current);
            const src = calcExpr || amount;
            if (src && /[+\-*/]/.test(src)) {
              const result = calcPreview(src);
              if (result !== null) {
                setAmount(String(result));
                setConvertedFrom(src);
                setConvertedTo(String(result));
              }
            }
          }}
          returnKeyType="next"
        />
        {/* Operator buttons for expression entry */}
        <View style={styles.operatorRow}>
          {['+', '-', '*', '/'].map(op => (
            <TouchableOpacity
              key={op}
              style={styles.operatorBtn}
              onPress={() => handleAmountChange(amount + op)}
              activeOpacity={0.7}
            >
              <Text style={styles.operatorBtnText}>{op}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.calcPreviewContainer}>
          {calcExpr !== null && (
            <Text style={styles.calcPreviewText}>{calcExpr} = {calcResult}</Text>
          )}
        </View>

        <TransactionCalendar value={selectedDate} onChange={setSelectedDate} />

        <TransactionTypeField value={type} onChange={setType} />

        <Text style={formStyles.label}>Category</Text>
        <TransactionCategoryPicker value={category} onChange={setCategory} style={formStyles.category} />

        <Text style={formStyles.label}>Note (Optional)</Text>
        <TextInput
          style={[formStyles.input, formStyles.textArea]}
          placeholder="Add a note"
          placeholderTextColor={transactionPlaceholderColor}
          multiline
          numberOfLines={3}
          value={note}
          onChangeText={setNote}
        />

        <TouchableOpacity
          accessibilityRole="button"
          style={[formStyles.submit, loading && formStyles.submitDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.dark} size="small" />
            : <ActionLabel style={formStyles.submitText}>
              {isEdit ? 'Save Changes' : 'Add Transaction'}
            </ActionLabel>
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
  operatorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    marginTop: 2,
  },
  operatorBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.secondary,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  operatorBtnText: {
    color: Colors.accent,
    fontSize: 18,
    fontWeight: '600',
  },
  calcPreviewContainer: {
    height: 20,
    marginBottom: 15,
    paddingLeft: 6,
    justifyContent: 'center',
  },
  calcPreviewText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
