import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '../constants/colors';
import { usePrivacy } from '../contexts/PrivacyContext';

const MASKED = '••••••';

const TotalBalance = React.memo(function TotalBalance({ budgets }) {
  const { privacyMode } = usePrivacy();

  const income = budgets.reduce((acc, b) => (b.type === 'income' ? acc + b.amount : acc), 0);
  const expense = budgets.reduce((acc, b) => (b.type === 'expense' ? acc + b.amount : acc), 0);
  const total = income - expense;

  const mask = (val) =>
    privacyMode ? MASKED : `₹${val.toLocaleString('en-IN')}`;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Total Balance</Text>
      <Text style={[styles.amount, { color: total >= 0 ? Colors.primary : Colors.red }]}>
        {privacyMode ? MASKED : `₹${total.toLocaleString('en-IN')}`}
      </Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Income</Text>
          <Text style={[styles.statValue, { color: Colors.green }]}>{mask(income)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Expense</Text>
          <Text style={[styles.statValue, { color: Colors.red }]}>{mask(expense)}</Text>
        </View>
      </View>
    </View>
  );
});

export default TotalBalance;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  label: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '500',
  },
  amount: {
    fontSize: 32,
    fontWeight: '600',
    marginTop: 5,
    marginBottom: 14,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark + 'AA',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: Colors.secondary,
    fontSize: 12,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.secondary + '40',
    marginHorizontal: 10,
  },
});