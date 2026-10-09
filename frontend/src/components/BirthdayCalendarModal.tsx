import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export interface BirthdayCalendarModalProps {
  visible: boolean;
  initialDate?: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
}

const EN_MONTH_NAMES = [
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

const EN_MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const EN_DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1920;

// All years from current year down to MIN_YEAR
const ALL_YEARS = Array.from(
  { length: CURRENT_YEAR - MIN_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i
);

const DECADES = [
  2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940, 1930, 1920,
];

export const BirthdayCalendarModal: React.FC<BirthdayCalendarModalProps> = ({
  visible,
  initialDate,
  onSelectDate,
  onClose,
}) => {
  const { t, locale, language } = useLanguage();
  const MONTH_NAMES = useMemo(() => language === 'en' ? EN_MONTH_NAMES : Array.from({ length: 12 }, (_, month) =>
    new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, month, 1)))), [language, locale]);
  const MONTH_SHORT = useMemo(() => language === 'en' ? EN_MONTH_SHORT : Array.from({ length: 12 }, (_, month) =>
    new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, month, 1)))), [language, locale]);
  const DAY_NAMES = useMemo(() => language === 'en' ? EN_DAY_NAMES : Array.from({ length: 7 }, (_, day) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, day + 1)))), [language, locale]);
  const today = useMemo(() => new Date(), []);

  // Parse initialDate or fallback to 30 years ago for realistic default birthday
  const defaultYear = CURRENT_YEAR - 30;
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0-indexed (0 = Jan)
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'calendar' | 'years' | 'months'>('calendar');

  useEffect(() => {
    if (visible) {
      if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate.trim())) {
        const parts = initialDate.trim().split('-').map(Number);
        if (parts.length === 3) {
          const y = parts[0];
          const m = parts[1] - 1;
          const d = parts[2];
          if (y >= MIN_YEAR && y <= CURRENT_YEAR && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
            setSelectedYear(y);
            setSelectedMonth(m);
            setSelectedDay(d);
            setViewMode('calendar');
            return;
          }
        }
      }
      // If no valid initial date, default to a sensible adult birth year (e.g. 1995)
      setSelectedYear(defaultYear);
      setSelectedMonth(0);
      setSelectedDay(1);
      setViewMode('calendar');
    }
  }, [visible, initialDate]);

  // Days in selected month & year
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // First day of week for selected month & year (0 = Sun, 6 = Sat)
  const firstDayOfWeek = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 1).getDay();
  }, [selectedYear, selectedMonth]);

  // Calculated Age preview
  const calculatedAge = useMemo(() => {
    const bDate = new Date(selectedYear, selectedMonth, selectedDay);
    let age = today.getFullYear() - bDate.getFullYear();
    const m = today.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : 0;
  }, [selectedYear, selectedMonth, selectedDay, today]);

  // Current formatted string
  const formattedDateStr = useMemo(() => {
    const yStr = String(selectedYear);
    const mStr = String(selectedMonth + 1).padStart(2, '0');
    const dStr = String(selectedDay).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  }, [selectedYear, selectedMonth, selectedDay]);

  // Handle day click
  const handleSelectDay = (day: number) => {
    const clickedDate = new Date(selectedYear, selectedMonth, day);
    if (clickedDate > today) return; // Disallow future dates
    setSelectedDay(day);
  };

  // Confirm selection
  const handleConfirm = () => {
    onSelectDate(formattedDateStr);
    onClose();
  };

  // Quick Decade Jump
  const handleDecadeJump = (decade: number) => {
    const targetYear = Math.min(CURRENT_YEAR, decade + 5);
    setSelectedYear(targetYear);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIconCircle}>
                    <Ionicons name="calendar" size={18} color={Colors.white} />
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>{t("Select Birthday")}</Text>
                    <Text style={styles.headerSubtitle}>
                      {formattedDateStr}{' '}{t("• Age:")}{' '}{calculatedAge}{' '}{t("yrs")}
                      {calculatedAge >= 60 ? t(' (Senior)') : ''}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={20} color={Colors.textLight} />
                </TouchableOpacity>
              </View>

              {/* Navigation Bar (Year & Month Toggles) */}
              <View style={styles.navBar}>
                {/* Month Toggle Button */}
                <TouchableOpacity
                  style={[
                    styles.navSelectorBtn,
                    viewMode === 'months' && styles.navSelectorBtnActive,
                  ]}
                  onPress={() =>
                    setViewMode((prev) => (prev === 'months' ? 'calendar' : 'months'))
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.navSelectorText}>
                    {MONTH_NAMES[selectedMonth]}
                  </Text>
                  <Ionicons
                    name={viewMode === 'months' ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={Colors.primary}
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>

                {/* Year Toggle Button with Fast Navigation */}
                <TouchableOpacity
                  style={[
                    styles.navSelectorBtn,
                    viewMode === 'years' && styles.navSelectorBtnActive,
                  ]}
                  onPress={() =>
                    setViewMode((prev) => (prev === 'years' ? 'calendar' : 'years'))
                  }
                  activeOpacity={0.7}
                >
                  <Text style={[styles.navSelectorText, { fontWeight: '800' }]}>
                    {selectedYear}
                  </Text>
                  <Ionicons
                    name={viewMode === 'years' ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={Colors.primary}
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>

                {/* Quick Prev / Next Year Arrows */}
                <View style={styles.quickYearArrows}>
                  <TouchableOpacity
                    onPress={() => setSelectedYear((y) => Math.max(MIN_YEAR, y - 1))}
                    style={styles.arrowBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="chevron-back" size={16} color={Colors.textDark} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSelectedYear((y) => Math.min(CURRENT_YEAR, y + 1))}
                    style={styles.arrowBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="chevron-forward" size={16} color={Colors.textDark} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* VIEW 1: YEARS GRID WITH DECADE SELECTOR */}
              {viewMode === 'years' && (
                <View style={styles.viewContainer}>
                  {/* Decade Pills Header */}
                  <View style={styles.decadeHeader}>
                    <Text style={styles.subSectionTitle}>{t("Quick Decade:")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                      {DECADES.map((dec) => {
                        const isDecadeMatch =
                          selectedYear >= dec && selectedYear < dec + 10;
                        return (
                          <TouchableOpacity
                            key={dec}
                            style={[
                              styles.decadeChip,
                              isDecadeMatch && styles.decadeChipActive,
                            ]}
                            onPress={() => handleDecadeJump(dec)}
                          >
                            <Text
                              style={[
                                styles.decadeChipText,
                                isDecadeMatch && styles.decadeChipTextActive,
                              ]}
                            >
                              {dec}s
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Scrollable Years Grid */}
                  <ScrollView
                    style={styles.yearsScrollView}
                    contentContainerStyle={styles.yearsGrid}
                    showsVerticalScrollIndicator={true}
                  >
                    {ALL_YEARS.map((y) => {
                      const isSelected = y === selectedYear;
                      return (
                        <TouchableOpacity
                          key={y}
                          style={[
                            styles.yearGridItem,
                            isSelected && styles.yearGridItemSelected,
                          ]}
                          onPress={() => {
                            setSelectedYear(y);
                            setViewMode('calendar');
                          }}
                        >
                          <Text
                            style={[
                              styles.yearGridText,
                              isSelected && styles.yearGridTextSelected,
                            ]}
                          >
                            {y}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* VIEW 2: MONTHS GRID */}
              {viewMode === 'months' && (
                <View style={styles.viewContainer}>
                  <Text style={[styles.subSectionTitle, { marginBottom: 12 }]}>
                    {t("Choose Month (")}{selectedYear}):
                  </Text>
                  <View style={styles.monthsGrid}>
                    {MONTH_SHORT.map((mName, mIdx) => {
                      const isSelected = mIdx === selectedMonth;
                      return (
                        <TouchableOpacity
                          key={mName}
                          style={[
                            styles.monthGridItem,
                            isSelected && styles.monthGridItemSelected,
                          ]}
                          onPress={() => {
                            setSelectedMonth(mIdx);
                            setViewMode('calendar');
                          }}
                        >
                          <Text
                            style={[
                              styles.monthGridText,
                              isSelected && styles.monthGridTextSelected,
                            ]}
                          >
                            {mName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* VIEW 3: STANDARD MONTH DAYS CALENDAR */}
              {viewMode === 'calendar' && (
                <View style={styles.calendarContainer}>
                  {/* Day Names Row */}
                  <View style={styles.dayNamesRow}>
                    {DAY_NAMES.map((dName) => (
                      <View key={dName} style={styles.dayNameCell}>
                        <Text style={styles.dayNameText}>{dName}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Days Matrix */}
                  <View style={styles.daysMatrix}>
                    {/* Empty padding slots before first day */}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <View key={`empty-${i}`} style={styles.dayCell} />
                    ))}

                    {/* Active days in month */}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => {
                      const isSelected =
                        dayNum === selectedDay &&
                        selectedMonth === selectedMonth &&
                        selectedYear === selectedYear;

                      const isFuture =
                        new Date(selectedYear, selectedMonth, dayNum) > today;

                      return (
                        <TouchableOpacity
                          key={`day-${dayNum}`}
                          disabled={isFuture}
                          style={[
                            styles.dayCell,
                            isSelected && styles.dayCellSelected,
                            isFuture && styles.dayCellFuture,
                          ]}
                          onPress={() => handleSelectDay(dayNum)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.dayCellText,
                              isSelected && styles.dayCellTextSelected,
                              isFuture && styles.dayCellTextFuture,
                            ]}
                          >
                            {dayNum}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Action Buttons Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>{t("Cancel")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={Colors.white}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.confirmButtonText}>
                    {t("Set:")}{' '}{formattedDateStr}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 10,
  },
  navSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  navSelectorBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  navSelectorText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  quickYearArrows: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  viewContainer: {
    paddingVertical: 6,
    minHeight: 250,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  decadeHeader: {
    marginBottom: 10,
  },
  decadeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  decadeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  decadeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textDark,
  },
  decadeChipTextActive: {
    color: Colors.white,
  },
  yearsScrollView: {
    maxHeight: 210,
  },
  yearsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  yearGridItem: {
    width: '23%',
    paddingVertical: 10,
    marginVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearGridItemSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  yearGridText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
  },
  yearGridTextSelected: {
    color: Colors.white,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  monthGridItem: {
    width: '31%',
    paddingVertical: 14,
    marginVertical: 5,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthGridItemSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  monthGridText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
  },
  monthGridTextSelected: {
    color: Colors.white,
  },
  calendarContainer: {
    minHeight: 250,
    paddingVertical: 4,
  },
  dayNamesRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
    marginBottom: 4,
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textLight,
  },
  daysMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellFuture: {
    opacity: 0.3,
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textDark,
  },
  dayCellTextSelected: {
    color: Colors.white,
    fontWeight: '800',
  },
  dayCellTextFuture: {
    color: '#9CA3AF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMedium,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
});
