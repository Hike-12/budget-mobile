import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Toast } from '../components/Toast';
import TotalBalance from '../components/TotalBalance';
import UpiCaptureControls, { PendingUpiBanner } from '../components/UpiCaptureControls';
import { useUpiCapture } from '../utils/useUpiCapture';
import { PAGE_SIZE } from '../constants/api';
import Colors from '../constants/colors';
import { usePrivacy } from '../contexts/PrivacyContext';
import { addToUnsyncedQueue, syncWithServer } from '../utils/sync';

export default function DashboardScreen() {
  const [budgets, setBudgets] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [username, setUsername] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMonth, setFilterMonth] = useState('0');
  const [filterYear, setFilterYear] = useState('All');
  const [filterRange, setFilterRange] = useState('all');
  const [page, setPage] = useState(1);
  const [captureSheet, setCaptureSheet] = useState(null);

  const capture = useUpiCapture(username);
  const refreshCapture = capture.refresh;
  const pendingCount = capture.items.length;
  const router = useRouter();
  const { privacyMode, togglePrivacy } = usePrivacy();

  // --- Debounce search ---
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- Network & data loading ---

  const doSync = useCallback(async () => {
    const result = await syncWithServer(username);
    if (result) setBudgets(result);
  }, [username]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const nextIsOnline = Boolean(state.isConnected);
      setIsOnline(prevIsOnline => {
        if (!prevIsOnline && nextIsOnline) {
          Toast.show({ message: 'Back online. Syncing...', type: 'info' });
          doSync();
        }
        return nextIsOnline;
      });
    });
    return unsubscribe;
  }, [doSync]);

  const loadBudgetsLocal = useCallback(async () => {
    const raw = await AsyncStorage.getItem('budgets');
    setBudgets(raw ? JSON.parse(raw) : []);
  }, []);

  useEffect(() => {
    loadBudgetsLocal();
    AsyncStorage.getItem('username').then(u => setUsername(u || null));
  }, [loadBudgetsLocal]);


  const handleDelete = useCallback(async (id) => {
    setBudgets(prev => prev.filter(b => b._id !== id));
    // Persist outside the state updater to avoid async-in-updater anti-pattern
    const raw = await AsyncStorage.getItem('budgets');
    const all = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem('budgets', JSON.stringify(all.filter(b => b._id !== id)));

    Toast.show({ message: 'Transaction deleted.', type: 'success' });
    await addToUnsyncedQueue({ action: 'delete', id });

    const netState = await NetInfo.fetch();
    if (netState.isConnected) doSync();
  }, [doSync]);

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
    if (isOnline) await Promise.all([doSync(), refreshCapture().catch(() => {})]);
    else await loadBudgetsLocal();
    setRefreshing(false);
  }, [doSync, isOnline, loadBudgetsLocal, refreshCapture]);

  // --- Filtering & Search ---

  const filteredBudgets = useMemo(() => {
    let arr = budgets.filter(b => b.status !== 'pending');

    // Search (debounced)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
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
      const nowTime = now.getTime();
      const weekAgoTime = nowTime - 7 * 24 * 60 * 60 * 1000;
      const curMonth = now.getMonth();
      const curYear = now.getFullYear();

      arr = arr.filter(b => {
        const d = new Date(b.createdAt);
        if (filterRange === 'week') return d.getTime() >= weekAgoTime && d.getTime() <= nowTime;
        if (filterRange === 'month') return d.getMonth() === curMonth && d.getFullYear() === curYear;
        if (filterRange === 'year') return d.getFullYear() === curYear;
        return true;
      });
    }
    return arr;
  }, [budgets, debouncedSearch, filterType, filterCategory, filterMonth, filterYear, filterRange]);

  // --- Pagination ---

  // Reset page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterType, filterCategory, filterMonth, filterYear, filterRange]);

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

  // Decouple the count from the header to avoid re-creating the entire header JSX
  const filteredCount = filteredBudgets.length;

  const listHeader = useMemo(() => (
    <>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline Mode — Using cached data</Text>
        </View>
      )}

      <TotalBalance budgets={filteredBudgets} />
      <PendingUpiBanner count={pendingCount} onPress={() => setCaptureSheet('review')} />

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
        <Ionicons name="add" size={20} color={Colors.dark} style={styles.addButtonIcon} />
        <Text
          style={styles.addButtonText}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          Add Transaction
        </Text>
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

      {filteredCount > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <Text style={styles.sectionCount}>{filteredCount}</Text>
        </View>
      )}
    </>
  ), [isOnline, filteredBudgets, searchQuery, filterType, filterCategory, filterMonth, filterYear, filterRange, filteredCount, router, pendingCount]);

  const listFooter = useMemo(() => {
    if (filteredCount === 0) return null;
    return (
      <View style={styles.paginationContainer}>
        <Text style={styles.pageInfo}>
          Showing {Math.min(paginatedBudgets.length, filteredCount)} of {filteredCount}
        </Text>
        {hasMore && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore} activeOpacity={0.8}>
            <Text style={styles.loadMoreText}>Load More</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [filteredCount, paginatedBudgets.length, hasMore, loadMore]);

  const listEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No transactions found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery.trim() ? 'Try a different search term' : 'Tap "+ Add Transaction" to get started'}
      </Text>
    </View>
  ), [searchQuery]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Dashboard',
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={togglePrivacy}
                hitSlop={12}
                style={styles.headerIconButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={privacyMode ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={Colors.accent}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCaptureSheet('settings')}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                hitSlop={12}
                style={styles.headerIconButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="settings-outline"
                  size={21}
                  color={Colors.accent}
                />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
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
        windowSize={5}
        initialNumToRender={PAGE_SIZE}
        updateCellsBatchingPeriod={50}
      />
      <UpiCaptureControls user={username} capture={capture} sheet={captureSheet} setSheet={setCaptureSheet} onVerified={doSync} />
    </>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    marginRight: 6,
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
  },
  addButtonIcon: {
    position: 'absolute',
    left: 15,
  },
  addButtonText: {
    color: Colors.dark,
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 40,
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
