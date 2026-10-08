import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AllergyItem,
  AllergyReaction,
  AllergySeverity,
  getDefaultAllergiesForPatient,
  PatientRecord,
} from '../../services/patientRecordsService';

export interface AllergyAlertSectionProps {
  patientId?: string;
  tokenNumber?: number;
  patientName?: string;
  patientRecord?: PatientRecord;
  initialAllergies?: AllergyItem[];
  onAllergiesChange?: (allergies: AllergyItem[]) => void;
}

export const REACTION_OPTIONS: AllergyReaction[] = [
  'Angioedema',
  'Anaphylaxis',
  'Rash / hives',
  'Breathing difficulty',
  'Nausea / vomiting',
  'Other',
];

export const SEVERITY_OPTIONS: {
  id: AllergySeverity;
  label: string;
  subtitle: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}[] = [
  {
    id: 'mild',
    label: 'Mild',
    subtitle: 'Low risk reaction',
    badgeBg: '#fef3c7', // amber-100
    badgeText: '#92400e', // amber-800
    badgeBorder: '#fde68a', // amber-200
  },
  {
    id: 'moderate',
    label: 'Moderate',
    subtitle: 'Requires monitoring',
    badgeBg: '#ffedd5', // orange-100
    badgeText: '#c2410c', // orange-800
    badgeBorder: '#fed7aa', // orange-200
  },
  {
    id: 'severe',
    label: 'Severe',
    subtitle: 'High clinical risk',
    badgeBg: '#fee2e2', // red-100
    badgeText: '#b91c1c', // red-700
    badgeBorder: '#fca5a5', // red-300
  },
  {
    id: 'life-threatening',
    label: 'Life-threatening',
    subtitle: 'Critical / Anaphylactic',
    badgeBg: '#7f1d1d', // solid dark red
    badgeText: '#ffffff', // white text
    badgeBorder: '#991b1b', // dark red border
  },
];

export default function AllergyAlertSection({
  patientId,
  tokenNumber = 1,
  patientName,
  patientRecord,
  initialAllergies,
  onAllergiesChange,
}: AllergyAlertSectionProps) {
  // Local allergies state
  const [allergies, setAllergies] = useState<AllergyItem[]>(() => {
    if (initialAllergies && Array.isArray(initialAllergies)) {
      return initialAllergies;
    }
    if (patientRecord && patientRecord.allergy?.hasAllergy) {
      return getDefaultAllergiesForPatient(patientRecord);
    }
    return [];
  });

  const storageKey = `@medi_queue_patient_allergies_${tokenNumber}`;

  // Bottom sheet modal state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add');
  const [editingItem, setEditingItem] = useState<AllergyItem | null>(null);

  // Form states
  const [formAllergen, setFormAllergen] = useState('');
  const [formReaction, setFormReaction] = useState<AllergyReaction>('Angioedema');
  const [formSeverity, setFormSeverity] = useState<AllergySeverity>('severe');
  const [formNote, setFormNote] = useState('');
  const [allergenFocused, setAllergenFocused] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);
  const allergenInputRef = useRef<TextInput>(null);

  // Delete confirm dialog state
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ item: AllergyItem; index: number } | null>(null);

  // Undo toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<{ item: AllergyItem; index: number } | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Sync to parent & storage
  const syncAllergies = useCallback(
    async (updated: AllergyItem[]) => {
      setAllergies(updated);
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(storageKey, JSON.stringify(updated));
        }
      } catch (err) {
        console.warn('Failed to cache allergies:', err);
      }
      onAllergiesChange?.(updated);
    },
    [storageKey, onAllergiesChange]
  );

  // Load persisted allergies on mount or tokenNumber change
  useEffect(() => {
    let isMounted = true;
    const loadCached = async () => {
      try {
        let raw = await AsyncStorage.getItem(storageKey);
        if (!raw && typeof window !== 'undefined' && window.localStorage) {
          raw = window.localStorage.getItem(storageKey);
        }
        if (raw && isMounted) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setAllergies(parsed);
            onAllergiesChange?.(parsed);
            return;
          }
        }
      } catch (e) {
        console.log('Error loading cached allergies:', e);
      }

      // If no cache, use initialAllergies or patientRecord
      if (initialAllergies && Array.isArray(initialAllergies)) {
        if (isMounted) {
          setAllergies(initialAllergies);
          onAllergiesChange?.(initialAllergies);
        }
      } else if (patientRecord && patientRecord.allergy?.hasAllergy && isMounted) {
        const defaults = getDefaultAllergiesForPatient(patientRecord);
        setAllergies(defaults);
        onAllergiesChange?.(defaults);
      } else {
        if (isMounted) {
          setAllergies([]);
          onAllergiesChange?.([]);
        }
      }
    };

    loadCached();

    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  // Synchronize when parent updates initialAllergies (e.g. newly loaded patient with 0 allergies)
  useEffect(() => {
    if (initialAllergies !== undefined) {
      setAllergies(initialAllergies);
    }
  }, [initialAllergies]);

  // Web keyboard handler for closing modals with Escape
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteDialogVisible) {
          setDeleteDialogVisible(false);
          setItemToDelete(null);
        } else if (isSheetOpen) {
          setIsSheetOpen(false);
          setEditingItem(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSheetOpen, deleteDialogVisible]);

  // Toast animation & timer
  const showUndoToast = useCallback((deleted: { item: AllergyItem; index: number }) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setLastDeleted(deleted);
    setToastVisible(true);

    Animated.spring(toastAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 70,
      friction: 9,
    }).start();

    // Auto-dismiss after exactly 6 seconds per requirement
    toastTimeoutRef.current = setTimeout(() => {
      dismissToast();
    }, 6000);
  }, [toastAnim]);

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setToastVisible(false);
      setLastDeleted(null);
    });
  }, [toastAnim]);

  // Undo action - restores item at original index
  const handleUndoDelete = useCallback(() => {
    if (!lastDeleted) return;
    const restoredItem = lastDeleted.item;
    const targetIdx = lastDeleted.index;

    const nextList = [...allergies];
    if (targetIdx >= 0 && targetIdx <= nextList.length) {
      nextList.splice(targetIdx, 0, restoredItem);
    } else {
      nextList.push(restoredItem);
    }

    dismissToast();
    syncAllergies(nextList);
  }, [allergies, lastDeleted, dismissToast, syncAllergies]);

  // Open Add modal
  const handleOpenAdd = () => {
    setSheetMode('add');
    setEditingItem(null);
    setFormAllergen('');
    setFormReaction('Angioedema');
    setFormSeverity('severe');
    setFormNote('');
    setIsSheetOpen(true);
    setTimeout(() => {
      allergenInputRef.current?.focus();
    }, 200);
  };

  // Open Edit modal
  const handleOpenEdit = (item: AllergyItem) => {
    setSheetMode('edit');
    setEditingItem(item);
    setFormAllergen(item.allergen);
    setFormReaction(
      REACTION_OPTIONS.includes(item.reaction as AllergyReaction)
        ? (item.reaction as AllergyReaction)
        : 'Other'
    );
    setFormSeverity(item.severity);
    setFormNote(item.note || '');
    setIsSheetOpen(true);
    setTimeout(() => {
      allergenInputRef.current?.focus();
    }, 200);
  };

  // Save form (Add or Edit)
  const handleSaveForm = () => {
    const trimmedAllergen = formAllergen.trim();
    if (!trimmedAllergen) return;

    if (sheetMode === 'add') {
      const newItem: AllergyItem = {
        id: `allergy-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        allergen: trimmedAllergen,
        reaction: formReaction,
        severity: formSeverity,
        note: formNote.trim() ? formNote.trim() : undefined,
      };
      const nextList = [newItem, ...allergies];
      syncAllergies(nextList);
    } else if (sheetMode === 'edit' && editingItem) {
      const updatedItem: AllergyItem = {
        ...editingItem,
        allergen: trimmedAllergen,
        reaction: formReaction,
        severity: formSeverity,
        note: formNote.trim() ? formNote.trim() : undefined,
      };
      const nextList = allergies.map((it) => (it.id === editingItem.id ? updatedItem : it));
      syncAllergies(nextList);
    }

    setIsSheetOpen(false);
    setEditingItem(null);
  };

  // Request Delete confirmation
  const handleRequestDelete = (item: AllergyItem, index: number) => {
    setItemToDelete({ item, index });
    setDeleteDialogVisible(true);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    const deleted = itemToDelete;
    const nextList = allergies.filter((it) => it.id !== deleted.item.id);

    setDeleteDialogVisible(false);
    setItemToDelete(null);

    syncAllergies(nextList);
    showUndoToast(deleted);
  };

  // Helper for severity pill styling
  const getSeverityMeta = (sev: AllergySeverity) => {
    return SEVERITY_OPTIONS.find((s) => s.id === sev) || SEVERITY_OPTIONS[2];
  };

  const isFormValid = formAllergen.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* ========================================================================= */}
      {/* 1. MAIN CARD: RED ALERT (IF 1+ ALLERGIES) OR GREEN (IF 0 ALLERGIES)     */}
      {/* ========================================================================= */}
      {allergies.length === 0 ? (
        // ----------------- GREEN EMPTY STATE CARD -----------------
        <View style={styles.emptyGreenCard}>
          <View style={styles.emptyGreenLeft}>
            <View style={styles.shieldIconWrap}>
              <Ionicons name="shield-checkmark" size={26} color="#16a34a" />
            </View>
            <View style={styles.emptyGreenTextWrap}>
              <Text style={styles.emptyGreenTitle}>No known allergies</Text>
              <Text style={styles.emptyGreenSubtitle}>
                Confirm with the patient before prescribing
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.emptyGreenAddBtn}
            onPress={handleOpenAdd}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Add allergy"
          >
            <Ionicons name="add" size={17} color="#065f46" style={{ marginRight: 3 }} />
            <Text style={styles.emptyGreenAddText}>Add allergy</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // ----------------- RED-TINTED ALERT CARD -----------------
        <View style={styles.redAlertCard}>
          {/* Header Row */}
          <View style={styles.alertHeaderRow}>
            <View style={styles.alertHeaderLeft}>
              <View style={styles.warningIconBadge}>
                <Ionicons name="warning" size={19} color="#dc2626" />
              </View>
              <Text style={styles.alertHeaderTitle}>
                {allergies.length === 1 ? 'Allergy alert' : `Allergy alerts (${allergies.length})`}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerAddBtn}
              onPress={handleOpenAdd}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Add allergy"
            >
              <Ionicons name="add" size={16} color="#dc2626" style={{ marginRight: 2 }} />
              <Text style={styles.headerAddBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* List of Allergy Rows */}
          <View style={styles.rowsList}>
            {allergies.map((item, idx) => {
              const meta = getSeverityMeta(item.severity);
              const isLifeThreatening = item.severity === 'life-threatening';

              return (
                <View key={item.id} style={styles.allergyRowCard}>
                  {/* Row Top Header: Allergen name + Severity pill + Action buttons */}
                  <View style={styles.rowTopRow}>
                    <View style={styles.rowInfoCol}>
                      <View style={styles.rowTitleAndBadgeWrap}>
                        <Text style={styles.allergenNameText} numberOfLines={2}>
                          {item.allergen}
                        </Text>
                        <View
                          style={[
                            styles.severityPill,
                            {
                              backgroundColor: meta.badgeBg,
                              borderColor: meta.badgeBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.severityPillText,
                              {
                                color: meta.badgeText,
                                fontWeight: isLifeThreatening ? '800' : '700',
                              },
                            ]}
                          >
                            {meta.label}
                          </Text>
                        </View>
                      </View>

                      {/* Reaction line */}
                      <View style={styles.reactionRow}>
                        <Text style={styles.reactionLabel}>Reaction: </Text>
                        <Text style={styles.reactionValue}>{item.reaction}</Text>
                      </View>

                      {/* Optional Note line */}
                      {Boolean(item.note && item.note.trim()) && (
                        <View style={styles.noteBox}>
                          <Ionicons
                            name="information-circle-outline"
                            size={14}
                            color="#b91c1c"
                            style={{ marginRight: 4, marginTop: 1 }}
                          />
                          <Text style={styles.noteText}>{item.note}</Text>
                        </View>
                      )}
                    </View>

                    {/* Action buttons: Edit (pencil) & Delete (trash) - min 36px touch targets */}
                    <View style={styles.actionBtnsCol}>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => handleOpenEdit(item)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${item.allergen} allergy`}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Ionicons name="pencil" size={17} color="#475569" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.iconActionBtn, styles.deleteActionBtn]}
                        onPress={() => handleRequestDelete(item, idx)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${item.allergen} allergy`}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Ionicons name="trash-outline" size={17} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 2. ADD / EDIT BOTTOM SHEET MODAL                                         */}
      {/* ========================================================================= */}
      <Modal
        visible={isSheetOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSheetOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdropOverlay}
        >
          {/* Dimmed backdrop closes on tap */}
          <TouchableOpacity
            style={styles.backdropTapArea}
            activeOpacity={1}
            onPress={() => setIsSheetOpen(false)}
          />

          {/* Bottom Sheet Container */}
          <View style={styles.bottomSheetContainer}>
            {/* Top drag handle indicator */}
            <View style={styles.dragHandle} />

            {/* Header */}
            <View style={styles.sheetHeaderRow}>
              <View>
                <Text style={styles.sheetTitle}>
                  {sheetMode === 'edit' ? 'Edit allergy' : 'Add allergy'}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {sheetMode === 'edit'
                    ? 'Update allergen profile & risk reaction'
                    : 'Record new medical allergy for prescription safety'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setIsSheetOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close bottom sheet"
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Field 1: Allergen text input with autofocus */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Allergen / Drug name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View
                  style={[
                    styles.textInputWrap,
                    allergenFocused && styles.textInputWrapFocused,
                  ]}
                >
                  <Ionicons
                    name="medical"
                    size={17}
                    color={allergenFocused ? '#064e59' : '#94a3b8'}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    ref={allergenInputRef}
                    style={styles.textInput}
                    placeholder="e.g. Sulfa Drugs, Penicillin, Aspirin"
                    placeholderTextColor="#94a3b8"
                    value={formAllergen}
                    onChangeText={setFormAllergen}
                    onFocus={() => setAllergenFocused(true)}
                    onBlur={() => setAllergenFocused(false)}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                  {Boolean(formAllergen) && (
                    <TouchableOpacity
                      onPress={() => setFormAllergen('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={17} color="#cbd5e1" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Field 2: Reaction as single-select chips */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Reaction <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View
                  style={styles.chipsGrid}
                  accessibilityRole="radiogroup"
                  aria-label="Allergy Reaction"
                >
                  {REACTION_OPTIONS.map((reactionOpt) => {
                    const isSelected = formReaction === reactionOpt;
                    return (
                      <TouchableOpacity
                        key={reactionOpt}
                        style={[
                          styles.reactionChip,
                          isSelected && styles.reactionChipSelected,
                        ]}
                        onPress={() => setFormReaction(reactionOpt)}
                        activeOpacity={0.7}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        aria-checked={isSelected}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color="#ffffff"
                            style={{ marginRight: 4 }}
                          />
                        )}
                        <Text
                          style={[
                            styles.reactionChipText,
                            isSelected && styles.reactionChipTextSelected,
                          ]}
                        >
                          {reactionOpt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Field 3: Severity as a 2x2 Segmented Control */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Severity <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View
                  style={styles.severityGrid2x2}
                  accessibilityRole="radiogroup"
                  aria-label="Allergy Severity"
                >
                  {SEVERITY_OPTIONS.map((sev) => {
                    const isSelected = formSeverity === sev.id;
                    return (
                      <TouchableOpacity
                        key={sev.id}
                        style={[
                          styles.severitySegment,
                          isSelected && styles.severitySegmentSelected,
                          isSelected && {
                            borderColor:
                              sev.id === 'life-threatening'
                                ? '#7f1d1d'
                                : sev.id === 'severe'
                                ? '#dc2626'
                                : sev.id === 'moderate'
                                ? '#ea580c'
                                : '#d97706',
                          },
                        ]}
                        onPress={() => setFormSeverity(sev.id)}
                        activeOpacity={0.75}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        aria-checked={isSelected}
                      >
                        <View style={styles.segmentTopRow}>
                          <View
                            style={[
                              styles.segmentDot,
                              {
                                backgroundColor:
                                  sev.id === 'life-threatening'
                                    ? '#7f1d1d'
                                    : sev.id === 'severe'
                                    ? '#dc2626'
                                    : sev.id === 'moderate'
                                    ? '#ea580c'
                                    : '#d97706',
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.segmentLabel,
                              isSelected && styles.segmentLabelSelected,
                            ]}
                          >
                            {sev.label}
                          </Text>
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={15}
                              color="#064e59"
                              style={{ marginLeft: 'auto' }}
                            />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.segmentSub,
                            isSelected && styles.segmentSubSelected,
                          ]}
                        >
                          {sev.subtitle}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Field 4: Optional note input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Clinical note (Optional)</Text>
                <View
                  style={[
                    styles.textAreaWrap,
                    noteFocused && styles.textInputWrapFocused,
                  ]}
                >
                  <TextInput
                    style={styles.textArea}
                    placeholder="e.g. Do not administer. Patient experienced severe swelling in 2024."
                    placeholderTextColor="#94a3b8"
                    value={formNote}
                    onChangeText={setFormNote}
                    onFocus={() => setNoteFocused(true)}
                    onBlur={() => setNoteFocused(false)}
                    multiline={true}
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Modal Buttons: Cancel & Save (disabled if allergen empty) */}
              <View style={styles.sheetButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsSheetOpen(false)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel allergy changes"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    !isFormValid && styles.saveBtnDisabled,
                  ]}
                  onPress={handleSaveForm}
                  disabled={!isFormValid}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    sheetMode === 'edit' ? 'Save changes' : 'Add allergy'
                  }
                >
                  <Ionicons
                    name="checkmark"
                    size={17}
                    color="#ffffff"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.saveBtnText}>
                    {sheetMode === 'edit' ? 'Save changes' : 'Add allergy'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. CENTERED DELETE CONFIRMATION DIALOG                                    */}
      {/* ========================================================================= */}
      <Modal
        visible={deleteDialogVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setDeleteDialogVisible(false);
          setItemToDelete(null);
        }}
      >
        <View style={styles.dialogBackdropOverlay}>
          <TouchableOpacity
            style={styles.backdropTapArea}
            activeOpacity={1}
            onPress={() => {
              setDeleteDialogVisible(false);
              setItemToDelete(null);
            }}
          />

          <View
            style={styles.dialogCard}
            accessibilityRole="alert"
            aria-modal={true}
          >
            <View style={styles.dialogWarningIconWrap}>
              <Ionicons name="alert-circle" size={32} color="#dc2626" />
            </View>

            <Text style={styles.dialogTitle}>Remove this allergy?</Text>

            <Text style={styles.dialogBody}>
              <Text style={{ fontWeight: '700', color: '#0f172a' }}>
                {itemToDelete?.item.allergen || 'This allergy'}{' '}
              </Text>
              will no longer show a warning when you prescribe. Only remove it if it was entered by mistake.
            </Text>

            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity
                style={styles.dialogKeepBtn}
                onPress={() => {
                  setDeleteDialogVisible(false);
                  setItemToDelete(null);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Keep allergy"
              >
                <Text style={styles.dialogKeepBtnText}>Keep</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogRemoveBtn}
                onPress={handleConfirmDelete}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Remove allergy"
              >
                <Text style={styles.dialogRemoveBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 4. DARK UNDO TOAST (AUTO-DISMISSES AFTER 6s)                               */}
      {/* ========================================================================= */}
      {toastVisible && (
        <Animated.View
          style={[
            styles.darkToast,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}
          accessibilityRole="alert"
        >
          <View style={styles.toastLeft}>
            <View style={styles.toastIconWrap}>
              <Ionicons name="trash-bin-outline" size={17} color="#94a3b8" />
            </View>
            <Text style={styles.toastText}>Allergy removed</Text>
          </View>

          <View style={styles.toastRight}>
            <TouchableOpacity
              style={styles.undoBtn}
              onPress={handleUndoDelete}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Undo allergy removal"
            >
              <Ionicons name="arrow-undo" size={14} color="#0891b2" style={{ marginRight: 4 }} />
              <Text style={styles.undoBtnText}>Undo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toastDismissBtn}
              onPress={dismissToast}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
            >
              <Ionicons name="close" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },

  // ----------------- GREEN EMPTY STATE CARD -----------------
  emptyGreenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4', // green-50
    borderWidth: 1.5,
    borderColor: '#86efac', // green-300
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyGreenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  shieldIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7', // green-100
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emptyGreenTextWrap: {
    flex: 1,
  },
  emptyGreenTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534', // green-800
    letterSpacing: -0.2,
  },
  emptyGreenSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#15803d', // green-700
    marginTop: 2,
  },
  emptyGreenAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    minHeight: 36,
  },
  emptyGreenAddText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
  },

  // ----------------- RED-TINTED ALERT CARD -----------------
  redAlertCard: {
    backgroundColor: '#fef2f2', // red-50
    borderWidth: 1.5,
    borderColor: '#fca5a5', // red-300
    borderRadius: 22,
    padding: 14,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#b91c1c', // red-700
    letterSpacing: -0.2,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    minHeight: 36,
    shadowColor: 'rgba(220, 38, 38, 0.08)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
  },
  headerAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },

  // Rows List inside Red Card
  rowsList: {
    gap: 10,
  },
  allergyRowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
    shadowColor: 'rgba(15, 23, 42, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  rowTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  rowInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  rowTitleAndBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  allergenNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.1,
  },
  severityPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  severityPillText: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  reactionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  reactionValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff1f2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
    borderLeftWidth: 2.5,
    borderLeftColor: '#f43f5e',
  },
  noteText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9f1239',
    lineHeight: 15,
    flex: 1,
  },

  // Action buttons
  actionBtnsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconActionBtn: {
    minWidth: 36,
    minHeight: 36,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionBtn: {
    backgroundColor: '#fee2e2',
  },

  // ----------------- BOTTOM SHEET MODAL -----------------
  modalBackdropOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  backdropTapArea: {
    flex: 1,
  },
  bottomSheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  sheetCloseBtn: {
    minWidth: 36,
    minHeight: 36,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetScroll: {
    maxHeight: 460,
  },
  sheetScrollContent: {
    paddingBottom: 10,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#dc2626',
  },
  textInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
  },
  textInputWrapFocused: {
    borderColor: '#064e59',
    backgroundColor: '#ffffff',
    shadowColor: 'rgba(6, 78, 89, 0.15)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
  },
  reactionChipSelected: {
    backgroundColor: '#064e59',
    borderColor: '#064e59',
  },
  reactionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  reactionChipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // 2x2 Segmented Control for Severity
  severityGrid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  severitySegment: {
    width: '48.5%',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 10,
  },
  severitySegmentSelected: {
    backgroundColor: '#f0fdfa', // cyan-50 / teal-50
  },
  segmentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  segmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  segmentLabelSelected: {
    color: '#064e59',
    fontWeight: '800',
  },
  segmentSub: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  segmentSubSelected: {
    color: '#0d7685',
  },

  textAreaWrap: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 10,
    minHeight: 70,
  },
  textArea: {
    fontSize: 12,
    color: '#0f172a',
    minHeight: 54,
    padding: 0,
  },

  // Sheet Buttons Row
  sheetButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
    flex: 1.6,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#064e59', // teal-900 primary
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(6, 78, 89, 0.3)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  // ----------------- CENTERED DELETE CONFIRMATION DIALOG -----------------
  dialogBackdropOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 10,
  },
  dialogWarningIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogBody: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dialogKeepBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogKeepBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  dialogRemoveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#dc2626', // red
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(220, 38, 38, 0.25)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  dialogRemoveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  // ----------------- DARK UNDO TOAST -----------------
  darkToast: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: '#0f172a', // dark slate
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 9999,
  },
  toastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  toastIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  toastRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0e7490', // teal/cyan button
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  undoBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  toastDismissBtn: {
    padding: 4,
  },
});
