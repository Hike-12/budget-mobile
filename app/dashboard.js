import { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Colors from '../constants/colors';
import BudgetCard from '../components/BudgetCard';
import TotalBalance from '../components/TotalBalance';
import FilterBar from '../components/FilterBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const API_URL = 'https://budget-tracker-aliqyaan.vercel.app';

export default function DashboardScreen() {
  const [budgets, setBudgets] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Filter states
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMonth, setFilterMonth] = useState('0');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterRange, setFilterRange] = useState('all');

  const router = useRouter();

  // Detect online/offline
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
      if (state.isConnected) {
        syncWithServer();
      }
    });
    return () => unsubscribe();
  }, []);

  // Load budgets from local storage on mount
  useEffect(() => {
    loadBudgetsLocal();
  }, []);

  async function loadBudgetsLocal() {
    const localBudgets = await AsyncStorage.getItem('budgets');
    setBudgets(localBudgets ? JSON.parse(localBudgets) : []);
  }

  // Save budgets to local storage
  async function saveBudgetsLocal(newBudgets) {
    setBudgets(newBudgets);
    await AsyncStorage.setItem('budgets', JSON.stringify(newBudgets));
  }

  // Add, edit, delete: update local storage and add to unsynced queue
  async function handleDelete(id) {
    const newBudgets = budgets.filter(b => b._id !== id);
    await saveBudgetsLocal(newBudgets);
    await addToUnsyncedQueue({ action: 'delete', id });
    if (isOnline) syncWithServer();
  }

  async function addToUnsyncedQueue(change) {
    const queue = await AsyncStorage.getItem('unsynced');
    const unsynced = queue ? JSON.parse(queue) : [];
    unsynced.push(change);
    await AsyncStorage.setItem('unsynced', JSON.stringify(unsynced));
  }

  // Sync with server when online
async function syncWithServer() {
  const user = await AsyncStorage.getItem('username');
  const queue = await AsyncStorage.getItem('unsynced');
  const unsynced = queue ? JSON.parse(queue) : [];
  for (const change of unsynced) {
    try {
      if (change.action === 'add') {
        await axios.post(`${API_URL}/api/budgets`, { ...change.budget, user });
      } else if (change.action === 'delete') {
        await axios.delete(`${API_URL}/api/budgets`, { data: { id: change.id, user } });
      } else if (change.action === 'edit') {
        await axios.patch(`${API_URL}/api/budgets`, { ...change.budget, user, id: change.budget._id });
      }
    } catch (e) {}
  }
  // After syncing, clear unsynced queue
  await AsyncStorage.setItem('unsynced', JSON.stringify([]));
  // Fetch latest from server and update local
  try {
    const res = await axios.get(`${API_URL}/api/budgets?user=${user}`);
    await AsyncStorage.setItem('budgets', JSON.stringify(res.data));
    setBudgets(res.data);
  } catch (e) {}
}

  function handleEdit(budget) {
    router.push({ pathname: '/add-transaction', params: { edit: 'true', ...budget } });
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadBudgetsLocal();
    setRefreshing(false);
  }

  // Filtering logic (like web)
  const filteredBudgets = useMemo(() => {
    let arr = [...budgets];
    if (filterType !== 'all') arr = arr.filter(b => b.type === filterType);
    if (filterCategory !== 'All') arr = arr.filter(b => b.category === filterCategory);
    if (filterMonth !== '0' || filterYear !== new Date().getFullYear().toString()) {
      arr = arr.filter(b => {
        const d = new Date(b.createdAt);
        const monthMatch = filterMonth === '0' || (d.getMonth() + 1).toString() === filterMonth;
        const yearMatch = filterYear === 'All' || d.getFullYear().toString() === filterYear;
        return monthMatch && yearMatch;
      });
    }
    if (filterRange !== 'all') {
      const now = new Date();
      arr = arr.filter(b => {
        const d = new Date(b.createdAt);
        if (filterRange === 'week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          return d >= weekAgo && d <= now;
        }
        if (filterRange === 'month') {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        if (filterRange === 'year') {
          return d.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }
    return arr;
  }, [budgets, filterType, filterCategory, filterMonth, filterYear, filterRange]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <TotalBalance budgets={filteredBudgets} />
      <FilterBar
        filterType={filterType}
        setFilterType={setFilterType}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterMonth={filterMonth}
        setFilterMonth={setFilterMonth}
        filterYear={filterYear}
        setFilterYear={setFilterYear}
        filterRange={filterRange}
        setFilterRange={setFilterRange}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/add-transaction')}
      >
        <Text style={styles.addButtonText}>+ Add Transaction</Text>
      </TouchableOpacity>
      {filteredBudgets.length === 0 ? (
        <Text style={{ color: Colors.secondary, textAlign: 'center', marginTop: 40 }}>No transactions found.</Text>
      ) : (
        filteredBudgets.map(item => (
          <BudgetCard
            key={item._id}
            budget={item}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark, padding: 10 },
  addButton: { backgroundColor: Colors.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginVertical: 10 },
  addButtonText: { color: Colors.dark, fontWeight: 'bold', fontSize: 16 },
});