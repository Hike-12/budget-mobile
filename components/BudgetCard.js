import React, { useCallback } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/colors';

const BudgetCard = React.memo(function BudgetCard({ budget, onDelete, onEdit }) {
  const confirmDelete = useCallback(() => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete "${budget.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(budget._id) },
      ]
    );
  }, [budget._id, budget.title, onDelete]);

  const handleEdit = useCallback(() => {
    onEdit(budget);
  }, [budget, onEdit]);

  const isIncome = budget.type === 'income';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{budget.title}</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleEdit} hitSlop={8} activeOpacity={0.7}>
            <Text style={styles.editButton}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmDelete} hitSlop={8} activeOpacity={0.7}>
            <Text style={styles.deleteButton}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={[styles.amount, { color: isIncome ? Colors.green : Colors.red }]}>
        {isIncome ? '+' : '-'} ₹ {budget.amount.toLocaleString('en-IN')}
      </Text>
      <Text style={styles.category}>
        {budget.category.charAt(0).toUpperCase() + budget.category.slice(1)}
      </Text>
      {budget.note ? <Text style={styles.note}>{budget.note}</Text> : null}
      <View style={styles.footer}>
        <Text style={styles.date}>
          {new Date(budget.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
        <View style={[styles.typeBadge, { backgroundColor: isIncome ? Colors.green + '20' : Colors.red + '20' }]}>
          <Text style={[styles.type, { color: isIncome ? Colors.green : Colors.red }]}>
            {budget.type.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
});

export default BudgetCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border || 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  deleteButton: {
    color: Colors.red,
    fontSize: 13,
    fontWeight: '500',
  },
  amount: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 5,
    fontVariant: ['tabular-nums'],
  },
  category: {
    color: Colors.secondary,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 3,
  },
  note: {
    color: Colors.secondary,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  date: {
    color: Colors.secondary,
    fontSize: 11,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  type: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});