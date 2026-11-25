import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/colors';
import ActionLabel from './ActionLabel';
import { transactionFormStyles } from './TransactionFormFields';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function calendarDateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export default function TransactionCalendar({ value, onChange, label = 'Date', min = '2000-01-01', max = '2100-12-31' }) {
  const [draft, setDraft] = useState(null);
  const year = draft?.getFullYear();
  const month = draft?.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const cells = draft ? Array.from({ length: firstWeekday + dayCount }, (_, i) => i - firstWeekday + 1) : [];
  const withinRange = (date) => calendarDateKey(date) >= min && calendarDateKey(date) <= max;

  function changeMonth(delta) {
    const next = new Date(year, month + delta, 1);
    const end = new Date(next.getFullYear(), next.getMonth() + 1, 0);
    if (calendarDateKey(end) < min || calendarDateKey(next) > max) return;
    setDraft(new Date(next.getFullYear(), next.getMonth(), Math.min(draft.getDate(), end.getDate())));
  }

  return (
    <>
      <Text style={transactionFormStyles.label}>{label}</Text>
      <TouchableOpacity style={transactionFormStyles.input} accessibilityRole="button"
        accessibilityLabel={`${label}, ${calendarDateKey(value).split('-').reverse().join('/')}`}
        onPress={() => setDraft(value)} activeOpacity={0.8}>
        <Text style={styles.dateInputText}>{calendarDateKey(value).split('-').reverse().join('/')}</Text>
      </TouchableOpacity>
      {draft && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDraft(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setDraft(null)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Select date</Text>
              <View style={styles.calendarHeaderRow}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month" style={styles.navBtn} onPress={() => changeMonth(-1)}>
                  <Text style={styles.navBtnText}>{'<'}</Text>
                </TouchableOpacity>
                <Text style={styles.calendarHeaderTitle}>{monthNames[month]} {year}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month" style={styles.navBtn} onPress={() => changeMonth(1)}>
                  <Text style={styles.navBtnText}>{'>'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.weekHeaderRow}>
                {weekDays.map((day) => <Text key={day} style={styles.weekHeaderText}>{day}</Text>)}
              </View>
              <View style={styles.calendarGrid}>
                {cells.map((day) => {
                  if (day < 1) return <View key={day} style={styles.dayCellEmpty} />;
                  const date = new Date(year, month, day);
                  const selected = day === draft.getDate();
                  const disabled = !withinRange(date);
                  return (
                    <TouchableOpacity key={day} accessibilityRole="button"
                      accessibilityLabel={`${day} ${monthNames[month]} ${year}`} accessibilityState={{ selected, disabled }}
                      style={[styles.dayCell, selected && styles.dayCellSelected, disabled && styles.disabled]}
                      disabled={disabled} onPress={() => setDraft(date)}>
                      <Text style={[styles.dayCellText, selected && styles.dayCellTextSelected]}>{day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.modalActionsRow}>
                <TouchableOpacity accessibilityRole="button" style={[styles.modalSecondaryBtn, !withinRange(new Date()) && styles.disabled]}
                  disabled={!withinRange(new Date())} onPress={() => setDraft(new Date())}>
                  <ActionLabel style={styles.modalSecondaryBtnText}>Today</ActionLabel>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" style={styles.modalSecondaryBtn} onPress={() => setDraft(null)}>
                  <ActionLabel style={styles.modalSecondaryBtnText}>Cancel</ActionLabel>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" style={[styles.modalPrimaryBtn, !withinRange(draft) && styles.disabled]}
                  disabled={!withinRange(draft)} onPress={() => { onChange(draft); setDraft(null); }}>
                  <ActionLabel style={styles.modalPrimaryBtnText}>Apply</ActionLabel>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  dateInputText: {
    color: Colors.accent,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.dark,
    borderColor: Colors.secondary,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  modalTitle: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderColor: Colors.secondary,
    borderWidth: 1,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnText: {
    color: Colors.accent,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  calendarHeaderTitle: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  dayCellEmpty: {
    width: '14.2857%',
    height: 38,
  },
  dayCell: {
    width: '14.2857%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
    borderRadius: 19,
  },
  dayCellText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  dayCellTextSelected: {
    color: Colors.dark,
    fontWeight: '700',
  },
  modalActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalSecondaryBtn: {
    minHeight: 44,
    justifyContent: 'center',
    borderColor: Colors.secondary,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.primary + '20',
  },
  modalSecondaryBtnText: {
    color: Colors.accent,
    fontWeight: '500',
  },
  modalPrimaryBtn: {
    minHeight: 44,
    justifyContent: 'center',
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.primary,
  },
  modalPrimaryBtnText: {
    color: Colors.dark,
    fontWeight: '600',
  },
  disabled: { opacity: 0.38 },
});
