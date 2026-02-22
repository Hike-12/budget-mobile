import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/colors';

const types = ['All', 'Expense', 'Income'];
const categories = ['All', 'school friends', 'college friends', 'religion', 'personal', 'miscellaneous'];
const ranges = [
  { label: 'All', value: 'all' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
];
const months = [
  'All', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const currentYear = new Date().getFullYear();
const years = ['All', ...Array.from({ length: 6 }, (_, i) => (currentYear - i).toString())];

const FilterChip = React.memo(function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.button, active && styles.buttonActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </TouchableOpacity>
  );
});

const FilterBar = React.memo(function FilterBar({
  filterType,
  setFilterType,
  filterCategory,
  setFilterCategory,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  filterRange,
  setFilterRange,
}) {
  const [open, setOpen] = useState(false);

  const hasActiveFilters =
    filterType !== 'all' ||
    filterCategory !== 'All' ||
    filterMonth !== '0' ||
    filterYear !== 'All' ||
    filterRange !== 'all';

  const clearFilters = useCallback(() => {
    setFilterType('all');
    setFilterCategory('All');
    setFilterMonth('0');
    setFilterYear('All');
    setFilterRange('all');
  }, [setFilterType, setFilterCategory, setFilterMonth, setFilterYear, setFilterRange]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.toggleButton, open && styles.toggleButtonActive]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={styles.toggleText}>
          {open ? 'Hide Filters' : 'Filters'}
        </Text>
        {hasActiveFilters && <View style={styles.activeDot} />}
      </TouchableOpacity>
      {open && (
        <View style={styles.filtersContainer}>
          <Text style={styles.groupLabel}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {types.map(t => (
              <FilterChip
                key={t}
                label={t}
                active={filterType === t.toLowerCase()}
                onPress={() => setFilterType(t.toLowerCase())}
              />
            ))}
          </ScrollView>

          <Text style={styles.groupLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {categories.map(c => (
              <FilterChip
                key={c}
                label={c.charAt(0).toUpperCase() + c.slice(1)}
                active={filterCategory === c}
                onPress={() => setFilterCategory(c)}
              />
            ))}
          </ScrollView>

          <Text style={styles.groupLabel}>Range</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {ranges.map(r => (
              <FilterChip
                key={r.value}
                label={r.label}
                active={filterRange === r.value}
                onPress={() => setFilterRange(r.value)}
              />
            ))}
          </ScrollView>

          <Text style={styles.groupLabel}>Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {months.map((m, i) => (
              <FilterChip
                key={m}
                label={m}
                active={filterMonth === i.toString()}
                onPress={() => setFilterMonth(i.toString())}
              />
            ))}
          </ScrollView>

          <Text style={styles.groupLabel}>Year</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {years.map(y => (
              <FilterChip
                key={y}
                label={y}
                active={filterYear === y}
                onPress={() => setFilterYear(y)}
              />
            ))}
          </ScrollView>

          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters} activeOpacity={0.7}>
              <Text style={styles.clearText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

export default FilterBar;

const styles = StyleSheet.create({
  container: {
    marginBottom: 15,
    backgroundColor: Colors.dark,
    borderRadius: 10,
    padding: 8,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: Colors.primary + '20',
    borderRadius: 8,
    marginBottom: 5,
  },
  toggleButtonActive: {
    backgroundColor: Colors.secondary,
  },
  toggleText: {
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    width: '100%',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    position: 'absolute',
    right: 12,
  },
  filtersContainer: {
    paddingBottom: 10,
  },
  groupLabel: {
    color: Colors.accent,
    fontWeight: '500',
    fontSize: 12,
    marginVertical: 4,
    marginLeft: 2,
  },
  groupScroll: {
    marginBottom: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.secondary,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 4,
  },
  buttonActive: {
    backgroundColor: Colors.secondary,
  },
  text: {
    color: Colors.secondary,
    fontSize: 12,
  },
  textActive: {
    color: Colors.dark,
    fontWeight: '500',
  },
  clearButton: {
    backgroundColor: Colors.red,
    padding: 8,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 8,
  },
  clearText: {
    color: Colors.dark,
    fontWeight: '600',
    fontSize: 13,
  },
});