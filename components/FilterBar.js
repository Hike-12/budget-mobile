import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
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
  'All', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => (currentYear - i).toString());

export default function FilterBar({
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
    filterYear !== currentYear.toString() ||
    filterRange !== 'all';

  function clearFilters() {
    setFilterType('all');
    setFilterCategory('All');
    setFilterMonth('0');
    setFilterYear(currentYear.toString());
    setFilterRange('all');
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.toggleButton, open && styles.toggleButtonActive]}
        onPress={() => setOpen(!open)}
      >
        <Text style={styles.toggleText}>
          {open ? 'Hide Filters' : 'Show Filters'}
        </Text>
        {hasActiveFilters && (
          <View style={styles.activeDot} />
        )}
      </TouchableOpacity>
      {open && (
        <View style={styles.filtersContainer}>
          {/* Type */}
          <Text style={styles.groupLabel}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {types.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.button, filterType === t.toLowerCase() && styles.buttonActive]}
                onPress={() => setFilterType(t.toLowerCase())}
              >
                <Text style={[styles.text, filterType === t.toLowerCase() && styles.textActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Category */}
          <Text style={styles.groupLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {categories.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.button, filterCategory === c && styles.buttonActive]}
                onPress={() => setFilterCategory(c)}
              >
                <Text style={[styles.text, filterCategory === c && styles.textActive]}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Range */}
          <Text style={styles.groupLabel}>Range</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {ranges.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.button, filterRange === r.value && styles.buttonActive]}
                onPress={() => setFilterRange(r.value)}
              >
                <Text style={[styles.text, filterRange === r.value && styles.textActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Month */}
          <Text style={styles.groupLabel}>Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {months.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[styles.button, filterMonth === i.toString() && styles.buttonActive]}
                onPress={() => setFilterMonth(i.toString())}
              >
                <Text style={[styles.text, filterMonth === i.toString() && styles.textActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Year */}
          <Text style={styles.groupLabel}>Year</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {years.map(y => (
              <TouchableOpacity
                key={y}
                style={[styles.button, filterYear === y && styles.buttonActive]}
                onPress={() => setFilterYear(y)}
              >
                <Text style={[styles.text, filterYear === y && styles.textActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Clear Filters */}
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 15, backgroundColor: Colors.dark, borderRadius: 10, padding: 8 },
  toggleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: Colors.primary + '20', borderRadius: 8, marginBottom: 5 },
  toggleButtonActive: { backgroundColor: Colors.secondary },
  toggleText: { color: Colors.accent, fontWeight: 'bold', fontSize: 14 },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginLeft: 8 },
  filtersContainer: { paddingBottom: 10 },
  groupLabel: { color: Colors.accent, fontWeight: '600', fontSize: 12, marginVertical: 4, marginLeft: 2 },
  groupScroll: { marginBottom: 8 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.primary + '20', borderColor: Colors.secondary, borderWidth: 1, marginRight: 8, marginBottom: 4 },
  buttonActive: { backgroundColor: Colors.secondary },
  text: { color: Colors.secondary, fontSize: 12 },
  textActive: { color: Colors.dark, fontWeight: '600' },
  clearButton: { backgroundColor: Colors.red, padding: 8, borderRadius: 8, alignSelf: 'center', marginTop: 8 },
  clearText: { color: Colors.dark, fontWeight: 'bold', fontSize: 13 },
});