import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/colors';
import { usePrivacy } from '../contexts/PrivacyContext';
import DeleteModal from './DeleteModal';

// Pre-compute date format options once (avoids object allocation per render)
const DATE_FORMAT_OPTIONS = { day: 'numeric', month: 'short', year: 'numeric' };

const BudgetCard = React.memo(function BudgetCard({ budget, onDelete, onEdit }) {
  const [modalVisible, setModalVisible] = useState(false);

  const handleDelete = useCallback(() => {
    setModalVisible(false);
    onDelete(budget._id);
  }, [budget._id, onDelete]);

  const handleEdit = useCallback(() => {
    onEdit(budget);
  }, [budget, onEdit]);

  const openModal = useCallback(() => setModalVisible(true), []);
  const closeModal = useCallback(() => setModalVisible(false), []);

  const isIncome = budget.type === 'income';
  const { privacyMode } = usePrivacy();

  // Memoize the formatted date string — avoids Date construction + toLocaleDateString per render
  const formattedDate = useMemo(
    () => new Date(budget.createdAt).toLocaleDateString('en-IN', DATE_FORMAT_OPTIONS),
    [budget.createdAt]
  );

  // Memoize capitalized category
  const displayCategory = useMemo(
    () => budget.category.charAt(0).toUpperCase() + budget.category.slice(1),
    [budget.category]
  );

  const amountColor = isIncome ? Colors.green : Colors.red;
  const badgeBg = amountColor + '20';

  const PrivacyBar = () => (
    <View style={styles.privacyBar}>
      <Text style={[styles.amount, { color: amountColor, marginRight: 4 }]}>
        {isIncome ? '+' : '-'}
      </Text>
      <View style={styles.blueBar} />
    </View>
  );

  return (
    <View style={styles.card}>
      <DeleteModal
        visible={modalVisible}
        title={budget.title}
        onCancel={closeModal}
        onDelete={handleDelete}
      />
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{budget.title}</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleEdit} hitSlop={8} activeOpacity={0.7}>
            <Text style={styles.editButton}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openModal} hitSlop={8} activeOpacity={0.7}>
            <Text style={styles.deleteButton}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {privacyMode ? (
        <PrivacyBar />
      ) : (
        <Text style={[styles.amount, { color: amountColor }]}>
          {isIncome ? '+' : '-'}₹{budget.amount.toLocaleString('en-IN')}
        </Text>
      )}

      <Text style={styles.category}>{displayCategory}</Text>
      {budget.note ? <Text style={styles.note}>{budget.note}</Text> : null}
      <View style={styles.footer}>
        <Text style={styles.date}>{formattedDate}</Text>
        <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.type, { color: amountColor }]}>
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
    letterSpacing: -0.8,
  },
  privacyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
  },
  blueBar: {
    width: 80,
    height: 18,
    backgroundColor: Colors.primary,
    borderRadius: 4,
    opacity: 0.6,
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
