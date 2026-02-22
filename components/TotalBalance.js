import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '../constants/colors';
import { usePrivacy } from '../contexts/PrivacyContext';

const TotalBalance = React.memo(function TotalBalance({ budgets }) {
  const { privacyMode } = usePrivacy();

  // Memoize the calculation — single pass instead of two separate reduces
  const { income, expense, total } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (let i = 0; i < budgets.length; i++) {
      if (budgets[i].type === 'income') inc += budgets[i].amount;
      else exp += budgets[i].amount;
    }
    return { income: inc, expense: exp, total: inc - exp };
  }, [budgets]);

  const PrivacyBar = ({ style }) => (
    <View style={[styles.privacyBar, style]} />
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Total Balance</Text>
      <View style={styles.mainAmountContainer}>
        {privacyMode ? (
          <PrivacyBar style={styles.mainPrivacyBar} />
        ) : (
          <Text style={[styles.amount, { color: total >= 0 ? Colors.primary : Colors.red }]}>
            ₹{total.toLocaleString('en-IN')}
          </Text>
        )}
      </View>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Income</Text>
          {privacyMode ? (
            <PrivacyBar style={styles.statPrivacyBar} />
          ) : (
            <Text style={[styles.statValue, { color: Colors.green }]}>
              ₹{income.toLocaleString('en-IN')}
            </Text>
          )}
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Expense</Text>
          {privacyMode ? (
            <PrivacyBar style={styles.statPrivacyBar} />
          ) : (
            <Text style={[styles.statValue, { color: Colors.red }]}>
              ₹{expense.toLocaleString('en-IN')}
            </Text>
          )}
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
  mainAmountContainer: {
    height: 48,
    justifyContent: 'center',
    marginTop: 5,
    marginBottom: 14,
  },
  amount: {
    fontSize: 32,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  privacyBar: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    opacity: 0.6,
  },
  mainPrivacyBar: {
    width: 140,
    height: 32,
  },
  statPrivacyBar: {
    width: 60,
    height: 16,
    marginTop: 4,
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
