import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import { Colors } from '../constants/Colors';

export interface ScheduleDatePickerModalProps {
  visible: boolean;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatYMD = (year: number, month: number, day: number): string => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

export const ScheduleDatePickerModal: React.FC<ScheduleDatePickerModalProps> = ({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
}) => {
  const { t } = useLanguage();

  // Parse selected date or fallback to today
  const parsedDate = useMemo(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [selectedDate]);

  const [currentYear, setCurrentYear] = useState<number>(parsedDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(parsedDate.getMonth());

  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }, []);

  // When modal opens, sync viewing year/month to selectedDate
  useEffect(() => {
    if (visible) {
      setCurrentYear(parsedDate.getFullYear());
      setCurrentMonth(parsedDate.getMonth());
    }
  }, [visible, parsedDate]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Quick shortcut handler
  const handleSelectShortcut = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dateStr = formatYMD(d.getFullYear(), d.getMonth(), d.getDate());
    onSelectDate(dateStr);
    onClose();
  };

  // Calendar grid calculations
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  // Build calendar matrix
  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number | null; dateStr: string | null }> = [];

    // Leading empty slots
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, dateStr: null });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        day,
        dateStr: formatYMD(currentYear, currentMonth, day),
      });
    }

    return cells;
  }, [currentYear, currentMonth, daysInMonth, firstDayOfWeek]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar" size={18} color="#0A5C67" />
              </View>
              <Text style={styles.modalTitle}>{t('Select Schedule Date')}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close calendar"
            >
              <Ionicons name="close" size={22} color={Colors.textMedium} />
            </TouchableOpacity>
          </View>

          {/* Month Navigation */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              style={styles.monthNavBtn}
              accessibilityLabel="Previous month"
            >
              <Ionicons name="chevron-back" size={20} color="#0F172A" />
            </TouchableOpacity>

            <Text style={styles.monthYearText}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </Text>

            <TouchableOpacity
              onPress={handleNextMonth}
              style={styles.monthNavBtn}
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Day Headers (Su, Mo, Tu, We, Th, Fr, Sa) */}
          <View style={styles.dayHeadersRow}>
            {DAY_NAMES.map((dn, idx) => (
              <View key={idx} style={styles.dayHeaderCell}>
                <Text
                  style={[
                    styles.dayHeaderText,
                    (idx === 0 || idx === 6) && styles.weekendHeaderText,
                  ]}
                >
                  {dn}
                </Text>
              </View>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.gridContainer}>
            {calendarCells.map((cell, idx) => {
              if (cell.day === null || !cell.dateStr) {
                return <View key={idx} style={styles.dayCellEmpty} />;
              }

              const isSelected = cell.dateStr === selectedDate;
              const isToday = cell.dateStr === todayStr;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => {
                    onSelectDate(cell.dateStr!);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayCellText,
                      isSelected && styles.dayCellTextSelected,
                      isToday && !isSelected && styles.dayCellTextToday,
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {isToday && (
                    <View
                      style={[
                        styles.todayDot,
                        isSelected && styles.todayDotSelected,
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick Shortcuts */}
          <View style={styles.shortcutsRow}>
            <TouchableOpacity
              style={styles.shortcutChip}
              onPress={() => handleSelectShortcut(0)}
              activeOpacity={0.7}
            >
              <Ionicons name="today-outline" size={14} color="#0A5C67" style={{ marginRight: 4 }} />
              <Text style={styles.shortcutText}>{t('Today')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutChip}
              onPress={() => handleSelectShortcut(1)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-forward-outline" size={14} color="#0A5C67" style={{ marginRight: 4 }} />
              <Text style={styles.shortcutText}>{t('Tomorrow')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutChip}
              onPress={() => handleSelectShortcut(7)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={14} color="#0A5C67" style={{ marginRight: 4 }} />
              <Text style={styles.shortcutText}>{t('+7 Days')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  dayHeadersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayHeaderCell: {
    width: 38,
    alignItems: 'center',
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  weekendHeaderText: {
    color: '#94A3B8',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dayCellEmpty: {
    width: 38,
    height: 38,
    marginBottom: 6,
  },
  dayCellSelected: {
    backgroundColor: '#0A5C67',
    shadowColor: '#0A5C67',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayCellTextToday: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  todayDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#3B82F6',
    position: 'absolute',
    bottom: 4,
  },
  todayDotSelected: {
    backgroundColor: '#FFFFFF',
  },
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A5C67',
  },
});

export default ScheduleDatePickerModal;
