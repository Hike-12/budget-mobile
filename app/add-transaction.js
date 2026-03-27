import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
};

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

const buildCalendarDays = (year, month) => {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= totalDays; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
};

const getDateParts = (date) => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
});

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateDraft, setDateDraft] = useState(getDateParts(initialDate));
  const [loading, setLoading] = useState(false);
  const submitInFlightRef = useRef(false);
  const draftBudgetIdRef = useRef(
    isEdit && params._id
      ? String(params._id)
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const router = useRouter();

  const openDatePicker = useCallback(() => {
    setDateDraft(getDateParts(selectedDate));
    setShowDatePicker(true);
  }, [selectedDate]);

  const closeDatePicker = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const changeMonth = useCallback((delta) => {
    setDateDraft(prev => {
      const shifted = new Date(prev.year, prev.month - 1 + delta, 1);
      let year = shifted.getFullYear();
      let month = shifted.getMonth() + 1;

      if (year < 2000) {
        year = 2000;
        month = 1;
      }

      if (year > 2100) {
        year = 2100;
        month = 12;
      }

      const maxDay = daysInMonth(year, month);
      return { ...prev, year, month, day: Math.min(prev.day, maxDay) };
    });
  }, []);

  const selectDay = useCallback((day) => {
    setDateDraft(prev => ({ ...prev, day }));
  }, []);

  const calendarDays = useMemo(
    () => buildCalendarDays(dateDraft.year, dateDraft.month),
    [dateDraft.year, dateDraft.month]
  );

  const applyDateDraft = useCallback(() => {
    const nextDate = new Date(dateDraft.year, dateDraft.month - 1, dateDraft.day);
    setSelectedDate(nextDate);
    setShowDatePicker(false);
  }, [dateDraft]);

  const setToday = useCallback(() => {
    const today = new Date();
    setDateDraft(getDateParts(today));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitInFlightRef.current) return;

    if (!title.trim() || !amount.trim()) {
      Toast.show({ message: 'Please fill in title and amount.', type: 'warning' });
      return;
    }
    const numAmount = Number(amount);
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
      submitInFlightRef.current = false;
      setLoading(false);
    }
  }, [title, amount, type, category, note, selectedDate, isEdit, router]);

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

        <Text style={styles.label}>Date</Text>
        <TouchableOpacity
          style={[styles.input, styles.dateInputButton]}
          onPress={openDatePicker}
          activeOpacity={0.8}
        >
          <Text style={styles.dateInputText}>{formatDate(selectedDate)}</Text>
        </TouchableOpacity>

        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={closeDatePicker}
        >
          <Pressable style={styles.modalOverlay} onPress={closeDatePicker}>
            <Pressable style={styles.modalCard} onPress={() => { }}>
              <Text style={styles.modalTitle}>Select Date</Text>

              <View style={styles.calendarHeaderRow}>
                <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)} activeOpacity={0.8}>
                  <Text style={styles.navBtnText}>{'<'}</Text>
                </TouchableOpacity>
                <Text style={styles.calendarHeaderTitle}>
                  {monthNames[dateDraft.month - 1]} {dateDraft.year}
                </Text>
                <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)} activeOpacity={0.8}>
                  <Text style={styles.navBtnText}>{'>'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.weekHeaderRow}>
                {weekDays.map(dayName => (
                  <Text key={dayName} style={styles.weekHeaderText}>{dayName}</Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                  }

                  const isSelected = day === dateDraft.day;

                  return (
                    <TouchableOpacity
                      key={`day-${day}-${index}`}
                      style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                      onPress={() => selectDay(day)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dayCellText, isSelected && styles.dayCellTextSelected]}>{day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity style={styles.modalSecondaryBtn} onPress={setToday} activeOpacity={0.8}>
                  <Text style={styles.modalSecondaryBtnText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSecondaryBtn} onPress={closeDatePicker} activeOpacity={0.8}>
                  <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalPrimaryBtn} onPress={applyDateDraft} activeOpacity={0.8}>
                  <Text style={styles.modalPrimaryBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

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
  dateInputButton: {
    justifyContent: 'center',
  },
  dateInputText: {
    color: Colors.accent,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.dark,
    borderColor: Colors.secondary,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  modalTitle: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderColor: Colors.secondary,
    borderWidth: 1,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnText: {
    color: Colors.accent,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  calendarHeaderTitle: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  dayCellEmpty: {
    width: '14.2857%',
    height: 38,
  },
  dayCell: {
    width: '14.2857%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
    borderRadius: 19,
  },
  dayCellText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  dayCellTextSelected: {
    color: Colors.dark,
    fontWeight: '700',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalSecondaryBtn: {
    borderColor: Colors.secondary,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.primary + '20',
  },
  modalSecondaryBtnText: {
    color: Colors.accent,
    fontWeight: '500',
  },
  modalPrimaryBtn: {
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.primary,
  },
  modalPrimaryBtnText: {
    color: Colors.dark,
    fontWeight: '600',
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