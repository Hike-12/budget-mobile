import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BudgetCard from '../components/BudgetCard';
import FilterBar from '../components/FilterBar';
import TotalBalance from '../components/TotalBalance';
import Colors from '../constants/colors';

const API_URL = 'https://budget-tracker-aliqyaan.vercel.app';
const PAGE_SIZE = 15;

export default function DashboardScreen() {
  const [budgets, setBudgets] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const syncingRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMonth, setFilterMonth] = useState('0');
  const [filterYear, setFilterYear] = useState('All');
  const [filterRange, setFilterRange] = useState('all');
  const [page, setPage] = useState(1);

  const router = useRouter();

  // --- Network & data loading ---

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
      if (state.isConnected) syncWithServer();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadBudgetsLocal();
  }, []);

  const loadBudgetsLocal = useCallback(async () => {
    const localBudgets = await AsyncStorage.getItem('budgets');
    setBudgets(localBudgets ? JSON.parse(localBudgets) : []);
  }, []);

  const saveBudgetsLocal = useCallback(async (newBudgets) => {
    setBudgets(newBudgets);
    await AsyncStorage.setItem('budgets', JSON.stringify(newBudgets));
  }, []);

  const handleDelete = useCallback(async (id) => {
    setBudgets(prev => {
      const updated = prev.filter(b => b._id !== id);
      AsyncStorage.setItem('budgets', JSON.stringify(updated));
      return updated;
    });
    await addToUnsyncedQueue({ action: 'delete', id });
    const netState = await NetInfo.fetch();
    if (netState.isConnected) syncWithServer();
  }, []);

  const addToUnsyncedQueue = useCallback(async (change) => {
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
  }, []);

  const syncWithServer = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const user = await AsyncStorage.getItem('username');
      let queue = await AsyncStorage.getItem('unsynced');
      let unsynced = queue ? JSON.parse(queue) : [];

      const map = new Map();
      for (let i = unsynced.length - 1; i >= 0; i--) {
        const c = unsynced[i];
        const key = c.action === 'delete' ? c.id : c.budget?._id;
        if (!map.has(key)) map.set(key, c);
      }
      unsynced = Array.from(map.values()).reverse();

      const serverList = (await axios.get(`${API_URL}/api/budgets?user=${user}`)).data || [];
      const serverByClientId = new Set(serverList.filter(b => b.clientId).map(b => b.clientId));

      const newQueue = [];
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
            await axios.patch(`${API_URL}/api/budgets`, { ...change.budget, clientId, user, id: change.budget._id });
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
      await saveBudgetsLocal(res.data);
    } finally {
      syncingRef.current = false;
    }
  }, [saveBudgetsLocal]);

  const handleEdit = useCallback((budget) => {
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
        createdAt: budget.createdAt,
      },
    });
  }, [router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isOnline) await syncWithServer();
    else await loadBudgetsLocal();
    setRefreshing(false);
  }, [isOnline, syncWithServer, loadBudgetsLocal]);

  // --- Filtering & Search ---

  const filteredBudgets = useMemo(() => {
    let arr = [...budgets];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      arr = arr.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        (b.note && b.note.toLowerCase().includes(q)) ||
        b.amount.toString().includes(q)
      );
    }

    if (filterType !== 'all') arr = arr.filter(b => b.type === filterType);
    if (filterCategory !== 'All') arr = arr.filter(b => b.category === filterCategory);

    // Year filter
    if (filterYear !== 'All') {
      arr = arr.filter(b => new Date(b.createdAt).getFullYear().toString() === filterYear);
    }

    // Month filter
    if (filterMonth !== '0') {
      arr = arr.filter(b => (new Date(b.createdAt).getMonth() + 1).toString() === filterMonth);
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
        if (filterRange === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (filterRange === 'year') return d.getFullYear() === now.getFullYear();
        return true;
      });
    }
    return arr;
  }, [budgets, searchQuery, filterType, filterCategory, filterMonth, filterYear, filterRange]);

  // --- Pagination ---

  // Reset page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterType, filterCategory, filterMonth, filterYear, filterRange]);

  const totalPages = Math.max(1, Math.ceil(filteredBudgets.length / PAGE_SIZE));
  const paginatedBudgets = useMemo(() => {
    return filteredBudgets.slice(0, page * PAGE_SIZE);
  }, [filteredBudgets, page]);

  const hasMore = page < totalPages;

  const loadMore = useCallback(() => {
    if (hasMore) setPage(prev => prev + 1);
  }, [hasMore]);

  // --- Render ---

  const renderItem = useCallback(({ item }) => (
    <BudgetCard budget={item} onDelete={handleDelete} onEdit={handleEdit} />
  ), [handleDelete, handleEdit]);

  const keyExtractor = useCallback((item) => item._id, []);

  const listHeader = useMemo(() => (
    <>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline Mode — Using cached data</Text>
        </View>
      )}

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
        activeOpacity={0.8}
      >
        <Text style={styles.addButtonText}>+ Add Transaction</Text>
      </TouchableOpacity>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          placeholderTextColor={Colors.secondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {filteredBudgets.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <Text style={styles.sectionCount}>{filteredBudgets.length}</Text>
        </View>
      )}
    </>
  ), [isOnline, filteredBudgets, searchQuery, filterType, filterCategory, filterMonth, filterYear, filterRange, router]);

  const listFooter = useMemo(() => {
    if (filteredBudgets.length === 0) return null;
    return (
      <View style={styles.paginationContainer}>
        <Text style={styles.pageInfo}>
          Showing {Math.min(paginatedBudgets.length, filteredBudgets.length)} of {filteredBudgets.length}
        </Text>
        {hasMore && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore} activeOpacity={0.8}>
            <Text style={styles.loadMoreText}>Load More</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [filteredBudgets.length, paginatedBudgets.length, hasMore, loadMore]);

  const listEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No transactions found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery.trim() ? 'Try a different search term' : 'Tap "+ Add Transaction" to get started'}
      </Text>
    </View>
  ), [searchQuery]);

  return (
    <FlatList
      data={paginatedBudgets}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      ListEmptyComponent={listEmpty}
      contentContainerStyle={styles.listContent}
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={Platform.OS === 'android'}
      maxToRenderPerBatch={10}
      windowSize={7}
      initialNumToRender={PAGE_SIZE}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  offlineBanner: {
    backgroundColor: Colors.warning + '20',
    borderColor: Colors.warning,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  offlineText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '500',
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.secondary,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    paddingHorizontal: 16,
    color: Colors.accent,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  addButtonText: {
    color: Colors.dark,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  sectionCount: {
    color: Colors.secondary,
    fontSize: 12,
    backgroundColor: Colors.primary + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: Colors.secondary,
    fontSize: 13,
    textAlign: 'center',
  },
  paginationContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  pageInfo: {
    color: Colors.secondary,
    fontSize: 12,
  },
  loadMoreButton: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  loadMoreText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});