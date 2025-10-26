import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import BudgetCard from '../components/BudgetCard';
import TotalBalance from '../components/TotalBalance';
import Colors from '../constants/colors';

const API_URL = 'https://budget-tracker-aliqyaan.vercel.app';

export default function DashboardScreen() {
  const [budgets, setBudgets] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  async function fetchBudgets() {
    try {
      const res = await axios.get(`${API_URL}/api/budgets`);
      setBudgets(res.data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    fetchBudgets();
  }, []);

  async function handleDelete(id) {
    try {
      await axios.delete(`${API_URL}/api/budgets`, { data: { id } });
      fetchBudgets();
    } catch (error) {
      console.error(error);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchBudgets();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <TotalBalance budgets={budgets} />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/add-transaction')}
      >
        <Text style={styles.addButtonText}>+ Add Transaction</Text>
      </TouchableOpacity>
      <FlatList
        data={budgets}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <BudgetCard budget={item} onDelete={() => handleDelete(item._id)} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: Colors.dark },
  addButton: { backgroundColor: Colors.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
  addButtonText: { color: Colors.dark, fontWeight: 'bold', fontSize: 16 },
});