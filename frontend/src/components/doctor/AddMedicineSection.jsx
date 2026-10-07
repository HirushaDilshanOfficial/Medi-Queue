import React, { useState } from 'react';
import {
  Search,
  X,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Check,
  Plus,
  Minus,
  Pill,
  Download,
  UserPlus,
  Clock,
  Utensils,
  AlertCircle,
} from 'lucide-react';

/**
 * Frequency presets & their default suggested slot mapping
 */
const FREQUENCIES = [
  {
    id: 'OD',
    label: 'OD',
    subtitle: 'Once',
    defaultSlots: ['morning'],
  },
  {
    id: 'BD',
    label: 'BD',
    subtitle: 'Twice',
    defaultSlots: ['morning', 'dinner'],
  },
  {
    id: 'TDS',
    label: 'TDS',
    subtitle: '3 times',
    defaultSlots: ['morning', 'lunch', 'dinner'],
  },
  {
    id: 'QDS',
    label: 'QDS',
    subtitle: '4 times',
    defaultSlots: ['morning', 'lunch', 'dinner', 'night'],
  },
];

const MEAL_OPTIONS = [
  { id: 'before', label: 'Before meal' },
  { id: 'after', label: 'After meal' },
];

const TIME_SLOTS = [
  {
    id: 'morning',
    label: 'Morning',
    timeHint: '8:00 AM',
    icon: Sunrise,
  },
  {
    id: 'lunch',
    label: 'Lunch',
    timeHint: '1:00 PM',
    icon: Sun,
  },
  {
    id: 'dinner',
    label: 'Dinner',
    timeHint: '8:00 PM',
    icon: Sunset,
  },
  {
    id: 'night',
    label: 'Night',
    timeHint: '10:30 PM',
    icon: Moon,
  },
];

const DURATION_PRESETS = [3, 5, 7, 14];

const POPULAR_SUGGESTIONS = [
  'Paracetamol 500mg',
  'Amoxicillin 500mg',
  'Metformin 500mg',
  'Omeprazole 20mg',
  'Cetirizine 10mg',
  'Atorvastatin 20mg',
];

/**
 * AddMedicineSection - Redesigned Mobile-First Prescription Component
 *
 * @param {Object} props
 * @param {(med: { name: string, frequency: string, meal: string, slots: string[], days: number }) => void} props.onAdd
 * @param {() => void} [props.onSave]
 * @param {() => void} [props.onRefer]
 */
export default function AddMedicineSection({ onAdd, onSave, onRefer }) {
  const [medicineName, setMedicineName] = useState('');
  const [frequency, setFrequency] = useState('BD');
  const [meal, setMeal] = useState('after');
  const [selectedSlots, setSelectedSlots] = useState(['morning', 'dinner']);
  const [days, setDays] = useState(5);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Auto-fill suggested time slots when frequency changes
  const handleFrequencyChange = (freqId) => {
    setFrequency(freqId);
    const targetFreq = FREQUENCIES.find((f) => f.id === freqId);
    if (targetFreq) {
      setSelectedSlots([...targetFreq.defaultSlots]);
    }
  };

  // Toggle individual time slot freely (multi-select)
  const toggleSlot = (slotId) => {
    setSelectedSlots((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  // Stepper handlers (bounded between 1 and 90)
  const decrementDays = () => setDays((d) => Math.max(1, d - 1));
  const incrementDays = () => setDays((d) => Math.min(90, d + 1));

  // Validation
  const isNameValid = medicineName.trim().length > 0;
  const isSlotsValid = selectedSlots.length > 0;
  const isDaysValid = days > 0;
  const canAdd = isNameValid && isSlotsValid && isDaysValid;

  // Add medicine action
  const handleAdd = () => {
    if (!canAdd) return;
    if (onAdd) {
      onAdd({
        name: medicineName.trim(),
        frequency,
        meal: meal === 'before' ? 'Before meal' : 'After meal',
        slots: [...selectedSlots],
        days,
      });
    }
    // Reset name for next entry while preserving sensible defaults
    setMedicineName('');
    setShowSuggestions(false);
  };

  // Human-readable summary calculation
  const formattedSlots = selectedSlots.length > 0 ? selectedSlots.join(', ') : 'none selected';
  const mealLabel = meal === 'before' ? 'before meals' : 'after meals';
  const summaryText = isNameValid
    ? `${medicineName.trim()} – ${frequency}, ${mealLabel} (${formattedSlots}), ${days} day${days > 1 ? 's' : ''}`
    : `Enter medicine name – ${frequency}, ${mealLabel} (${formattedSlots}), ${days} day${days > 1 ? 's' : ''}`;

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen pb-28 text-slate-800 antialiased font-sans">
      <div className="p-4 space-y-4">
        {/* ======================================================== */}
        {/* CARD CONTAINER: Add Medicine Form                         */}
        {/* ======================================================== */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-5">
          {/* Card Header */}
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-900">
                <Pill className="w-5 h-5 text-teal-900" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">Add Medicine</h2>
                <p className="text-xs text-slate-500">Prescribe dosage, timing & duration</p>
              </div>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-100">
              Rx Item
            </span>
          </div>

          {/* 1. Medicine Name & Strength Input */}
          <div className="space-y-1.5 relative">
            <label htmlFor="medicine-search" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Medicine Name & Strength
            </label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                id="medicine-search"
                type="text"
                value={medicineName}
                onChange={(e) => {
                  setMedicineName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g. Paracetamol 500mg, Amoxicillin..."
                className="w-full pl-10 pr-10 py-3 bg-slate-50/80 hover:bg-slate-50 text-slate-900 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20 focus:bg-white transition-all placeholder:text-slate-400"
              />
              {medicineName.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMedicineName('');
                    setShowSuggestions(false);
                  }}
                  aria-label="Clear medicine name"
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 focus:outline-none focus:ring-2 focus:ring-teal-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Autocomplete Suggestions Dropdown */}
            {showSuggestions && !medicineName && (
              <div className="pt-1 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-slate-400 mr-1 self-center">Frequent:</span>
                {POPULAR_SUGGESTIONS.slice(0, 3).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setMedicineName(item);
                      setShowSuggestions(false);
                    }}
                    className="text-xs bg-slate-100 hover:bg-teal-50 hover:text-teal-900 text-slate-600 px-2.5 py-1 rounded-xl transition"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. How often: 4-Option Segmented Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span id="frequency-label" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                How Often
              </span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Auto-syncs timing
              </span>
            </div>

            <div
              role="radiogroup"
              aria-labelledby="frequency-label"
              className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/70"
            >
              {FREQUENCIES.map((freq) => {
                const isSelected = frequency === freq.id;
                return (
                  <button
                    key={freq.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleFrequencyChange(freq.id)}
                    className={`py-2 px-1 rounded-xl text-center transition-all focus:outline-none focus:ring-2 focus:ring-teal-800 ${
                      isSelected
                        ? 'bg-teal-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <span className="block text-xs font-bold leading-tight">{freq.label}</span>
                    <span
                      className={`block text-[10px] leading-tight font-normal mt-0.5 ${
                        isSelected ? 'text-teal-100' : 'text-slate-400'
                      }`}
                    >
                      {freq.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. With Meals: 2-Option Segmented Control */}
          <div className="space-y-1.5">
            <span id="meal-label" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              With Meals
            </span>
            <div
              role="radiogroup"
              aria-labelledby="meal-label"
              className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/70"
            >
              {MEAL_OPTIONS.map((opt) => {
                const isSelected = meal === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setMeal(opt.id)}
                    className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-800 ${
                      isSelected
                        ? 'bg-teal-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Utensils className={`w-3.5 h-3.5 ${isSelected ? 'text-teal-200' : 'text-slate-400'}`} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Time of Day: 4 Icon Tiles (Multi-Select) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Time of Day
              </span>
              {selectedSlots.length === 0 ? (
                <span className="text-[11px] font-medium text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Pick at least one
                </span>
              ) : (
                <span className="text-[11px] font-medium text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                  {selectedSlots.length} selected
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedSlots.includes(slot.id);
                const Icon = slot.icon;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleSlot(slot.id)}
                    className={`relative p-3 rounded-2xl border text-left flex flex-col justify-between transition-all focus:outline-none focus:ring-2 focus:ring-teal-800 ${
                      isSelected
                        ? 'border-teal-800 bg-teal-50/90 text-teal-950 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {/* Top row: Icon + check badge */}
                    <div className="flex items-center justify-between w-full mb-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-teal-900 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    {/* Slot Name & approximate time */}
                    <div>
                      <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-teal-950' : 'text-slate-800'}`}>
                        {slot.label}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-teal-700' : 'text-slate-400'}`}>
                        {slot.timeHint}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Duration: Stepper + Quick Chips */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Duration
            </span>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              {/* Stepper control (1 to 90 days) */}
              <div className="w-full sm:w-auto flex items-center justify-between bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={decrementDays}
                  disabled={days <= 1}
                  aria-label="Decrease days"
                  className="w-9 h-9 rounded-xl bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-xs hover:bg-slate-50 active:scale-95 transition focus:outline-none focus:ring-2 focus:ring-teal-800"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="px-4 text-center">
                  <span className="text-sm font-bold text-slate-900">{days}</span>
                  <span className="text-[11px] text-slate-500 ml-1">days</span>
                </div>

                <button
                  type="button"
                  onClick={incrementDays}
                  disabled={days >= 90}
                  aria-label="Increase days"
                  className="w-9 h-9 rounded-xl bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-xs hover:bg-slate-50 active:scale-95 transition focus:outline-none focus:ring-2 focus:ring-teal-800"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Preset Chips */}
              <div className="w-full flex items-center justify-between sm:justify-start gap-1.5 flex-1">
                {DURATION_PRESETS.map((d) => {
                  const isPresetActive = days === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      className={`flex-1 sm:flex-none py-2 px-3 text-xs font-medium rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-teal-800 ${
                        isPresetActive
                          ? 'bg-teal-900 border-teal-900 text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {d}d
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 6. Live Summary Strip */}
          <div className="p-3.5 bg-gradient-to-r from-sky-50 to-teal-50/60 rounded-2xl border border-sky-100 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-teal-900/10 text-teal-900 flex items-center justify-center shrink-0 mt-0.5">
              <Pill className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold tracking-wider uppercase text-teal-800">
                Prescription Preview
              </p>
              <p className="text-xs font-medium text-slate-800 mt-0.5 truncate">
                {summaryText}
              </p>
            </div>
          </div>

          {/* 7. Primary Add Button */}
          <div>
            <button
              type="button"
              disabled={!canAdd}
              onClick={handleAdd}
              className={`w-full py-3.5 px-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal-800 focus:ring-offset-2 ${
                canAdd
                  ? 'bg-teal-900 text-white hover:bg-teal-950 active:scale-[0.99] cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add to prescription</span>
            </button>
            {!isNameValid && (
              <p className="text-[11px] text-center text-slate-400 mt-1.5">
                Type or select a medicine name above to enable
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 8. Sticky Bottom Action Bar (Above Tab Navigation)        */}
      {/* ======================================================== */}
      <aside
        aria-label="Prescription Actions"
        className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-8px_20px_rgba(0,0,0,0.04)] px-4 py-3"
      >
        <div className="max-w-md mx-auto flex items-center gap-2.5">
          {/* Secondary Outline: Refer */}
          <button
            type="button"
            onClick={onRefer}
            className="flex-1 py-3 px-3.5 rounded-2xl border border-teal-900 text-teal-900 font-semibold text-xs sm:text-sm hover:bg-teal-50 active:scale-[0.98] transition flex items-center justify-center gap-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-800"
          >
            <UserPlus className="w-4 h-4" />
            <span>Refer</span>
          </button>

          {/* Primary Filled: Save and download (Wider flex-[2]) */}
          <button
            type="button"
            onClick={onSave}
            className="flex-[2] py-3 px-4 rounded-2xl bg-teal-900 text-white font-semibold text-xs sm:text-sm hover:bg-teal-950 active:scale-[0.98] shadow-sm transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-teal-800 focus:ring-offset-2"
          >
            <Download className="w-4 h-4" />
            <span>Save and download</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
