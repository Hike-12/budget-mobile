import { useRef, useState, useEffect, useMemo } from 'react';
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
  const syncingRef = useRef(false);

  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMonth, setFilterMonth] = useState('0');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterRange, setFilterRange] = useState('all');

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
      if (state.isConnected) syncWithServer();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => { loadBudgetsLocal(); }, []);

  async function loadBudgetsLocal() {
    const localBudgets = await AsyncStorage.getItem('budgets');
    setBudgets(localBudgets ? JSON.parse(localBudgets) : []);
  }

  async function saveBudgetsLocal(newBudgets) {
    setBudgets(newBudgets);
    await AsyncStorage.setItem('budgets', JSON.stringify(newBudgets));
  }

  async function handleDelete(id) {
    const newBudgets = budgets.filter(b => b._id !== id);
    await saveBudgetsLocal(newBudgets);
    await addToUnsyncedQueue({ action: 'delete', id });
    if (isOnline) syncWithServer();
  }

  async function addToUnsyncedQueue(change) {
    const queue = await AsyncStorage.getItem('unsynced');
    const unsynced = queue ? JSON.parse(queue) : [];
    const alreadyExists = unsynced.some(item => {
      if (change.action === 'add' && item.action === 'add') return item.budget?._id === change.budget?._id;
      if (change.action === 'delete' && item.action === 'delete') return item.id === change.id;
      if (change.action === 'edit' && item.action === 'edit') return item.budget?._id === change.budget?._id;
      return false;
    });
    if (!alreadyExists) {
      unsynced.push(change);
      await AsyncStorage.setItem('unsynced', JSON.stringify(unsynced));
    }
  }

  async function syncWithServer() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const user = await AsyncStorage.getItem('username');
      let queue = await AsyncStorage.getItem('unsynced');
      let unsynced = queue ? JSON.parse(queue) : [];

      // Keep only the latest change per clientId/id
      const map = new Map();
      for (let i = unsynced.length - 1; i >= 0; i--) {
        const c = unsynced[i];
        const key = c.action === 'delete' ? c.id : c.budget?._id;
        if (!map.has(key)) map.set(key, c);
      }
      unsynced = Array.from(map.values()).reverse();

      // Pull latest once
      const serverList = (await axios.get(`${API_URL}/api/budgets?user=${user}`)).data || [];
      const serverByClientId = new Set(serverList.filter(b => b.clientId).map(b => b.clientId));

      const newQueue = [];
      for (const change of unsynced) {
        let success = false;
        try {
          if (change.action === 'add') {
            const clientId = change.budget._id;
            if (!serverByClientId.has(clientId)) {
              await axios.post(`${API_URL}/api/budgets`, {
                ...change.budget,
                clientId: clientId,
                user,
              });
              serverByClientId.add(clientId);
            }
            success = true;
          } else if (change.action === 'edit') {
            const clientId = change.budget._id;
            await axios.patch(`${API_URL}/api/budgets`, {
              ...change.budget,
              clientId,
              user,
              id: change.budget._id, // server PATCH handles id or clientId
            });
            success = true;
          } else if (change.action === 'delete') {
            await axios.delete(`${API_URL}/api/budgets`, {
              data: { id: change.id, clientId: change.id, user },
            });
            success = true;
          }
        } catch (e) {
          success = false;
        }
        if (!success) newQueue.push(change);
      }

      await AsyncStorage.setItem('unsynced', JSON.stringify(newQueue));
      const res = await axios.get(`${API_URL}/api/budgets?user=${user}`);
      await saveBudgetsLocal(res.data);
    } finally {
      syncingRef.current = false;
    }
  }

  function handleEdit(budget) {
    router.push({
      pathname: '/add-transaction',
      params: {
        edit: 'true',
        _id: budget._id,
        title: budget.title,
        amount: budget.amount.toString(),
        type: budget.type,
        category: budget.category,
        note: budget.note || '',
        createdAt: budget.createdAt
      }
    });
  }

  async function onRefresh() {
    setRefreshing(true);
    if (isOnline) await syncWithServer();
    else await loadBudgetsLocal();
    setRefreshing(false);
  }

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
          const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
          return d >= weekAgo && d <= now;
        }
        if (filterRange === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (filterRange === 'year') return d.getFullYear() === now.getFullYear();
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
      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/add-transaction')}>
        <Text style={styles.addButtonText}>+ Add Transaction</Text>
      </TouchableOpacity>
      {filteredBudgets.length === 0 ? (
        <Text style={{ color: Colors.secondary, textAlign: 'center', marginTop: 40 }}>No transactions found.</Text>
      ) : (
        filteredBudgets.map(item => (
          <BudgetCard key={item._id} budget={item} onDelete={handleDelete} onEdit={handleEdit} />
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