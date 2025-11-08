import { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Colors from '../constants/colors';
import BudgetCard from '../components/BudgetCard';
import TotalBalance from '../components/TotalBalance';
import FilterBar from '../components/FilterBar';

const API_URL = 'https://budget-tracker-aliqyaan.vercel.app';

export default function DashboardScreen() {
  const [budgets, setBudgets] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Filter states
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMonth, setFilterMonth] = useState('0'); // 0 = All
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterRange, setFilterRange] = useState('all');

  const router = useRouter();

  async function fetchBudgets() {
    try {
      const res = await axios.get(`${API_URL}/api/budgets`);
      setBudgets(res.data);
    } catch (e) {}
  }

  useEffect(() => {
    fetchBudgets();
  }, []);

  async function handleDelete(id) {
    try {
      await axios.delete(`${API_URL}/api/budgets`, { data: { id } });
      fetchBudgets();
    } catch (e) {}
  }

  function handleEdit(budget) {
    router.push({ pathname: '/add-transaction', params: { edit: 'true', ...budget } });
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchBudgets();
    setRefreshing(false);
  }

  // Filtering logic (like web)
  const filteredBudgets = useMemo(() => {
    let arr = [...budgets];
    if (filterType !== 'all') {
      arr = arr.filter(b => b.type === filterType);
    }
    if (filterCategory !== 'All') {
      arr = arr.filter(b => b.category === filterCategory);
    }
    // Month/year
    if (filterMonth !== '0' || filterYear !== new Date().getFullYear().toString()) {
      arr = arr.filter(b => {
        const d = new Date(b.createdAt);
        const monthMatch = filterMonth === '0' || (d.getMonth() + 1).toString() === filterMonth;
        const yearMatch = filterYear === 'All' || d.getFullYear().toString() === filterYear;
        return monthMatch && yearMatch;
      });
    }
    // Range
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