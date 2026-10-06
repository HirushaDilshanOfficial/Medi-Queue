import { useState, useCallback } from 'react';
import { isValidNIC, isValidSLPhone } from '../utils/validations';
import { QueuePriority, AppointmentType } from '../types';

export interface WalkInPatientState {
  fullName: string;
  nic: string;
  phone: string;
  age: string | number;
  gender: 'male' | 'female' | 'other' | '';
}

export interface WalkInFormState {
  query: string;
  patient: WalkInPatientState;
  existingPatientId: string | null;
  intakeType: AppointmentType;
  priority: QueuePriority;
  department: string;
  doctorId: string;
  slotTime: string;
  errors: Record<string, string>;
}

const INITIAL_PATIENT_STATE: WalkInPatientState = {
  fullName: '',
  nic: '',
  phone: '',
  age: '',
  gender: '',
};

const INITIAL_FORM_STATE: WalkInFormState = {
  query: '',
  patient: { ...INITIAL_PATIENT_STATE },
  existingPatientId: null,
  intakeType: 'walk_in',
  priority: 'normal',
  department: '',
  doctorId: '',
  slotTime: '',
  errors: {},
};

export interface UseWalkInFormReturn {
  // State
  query: string;
  patient: WalkInPatientState;
  existingPatientId: string | null;
  intakeType: AppointmentType;
  priority: QueuePriority;
  department: string;
  doctorId: string;
  slotTime: string;
  errors: Record<string, string>;
  formState: WalkInFormState;

  // Actions
  setField: (field: string, value: any) => void;
  setPatient: (patientData: Partial<WalkInPatientState>) => void;
  setExistingPatient: (patientId: string | null, patientData?: Partial<WalkInPatientState>) => void;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  clearError: (field: string) => void;
  reset: () => void;
  validate: () => boolean;
}

/**
 * Custom hook to manage walk-in / pre-booked intake form state and validation.
 */
export const useWalkInForm = (initialValues?: Partial<WalkInFormState>): UseWalkInFormReturn => {
  const [form, setForm] = useState<WalkInFormState>(() => ({
    ...INITIAL_FORM_STATE,
    ...initialValues,
    patient: {
      ...INITIAL_PATIENT_STATE,
      ...(initialValues?.patient || {}),
    },
    errors: initialValues?.errors || {},
  }));

  // Update a single field dynamically and clear its error
  const setField = useCallback((field: string, value: any) => {
    setForm((prev) => {
      const newErrors = { ...prev.errors };

      // Handle patient nested fields or aliases
      if (field.startsWith('patient.')) {
        const subField = field.replace('patient.', '') as keyof WalkInPatientState;
        delete newErrors[subField];
        return {
          ...prev,
          patient: {
            ...prev.patient,
            [subField]: value,
          },
          errors: newErrors,
        };
      }

      // Direct patient field aliases
      if (['fullName', 'nic', 'phone', 'age', 'gender'].includes(field)) {
        delete newErrors[field];
        return {
          ...prev,
          patient: {
            ...prev.patient,
            [field]: value,
          },
          errors: newErrors,
        };
      }

      // Top-level fields
      delete newErrors[field];
      return {
        ...prev,
        [field]: value,
        errors: newErrors,
      };
    });
  }, []);

  // Update partial or full patient information
  const setPatient = useCallback((patientData: Partial<WalkInPatientState>) => {
    setForm((prev) => ({
      ...prev,
      patient: {
        ...prev.patient,
        ...patientData,
      },
      errors: Object.keys(patientData).reduce(
        (acc, key) => {
          delete acc[key];
          return acc;
        },
        { ...prev.errors }
      ),
    }));
  }, []);

  // Set existing patient selection from search
  const setExistingPatient = useCallback(
    (patientId: string | null, patientData?: Partial<WalkInPatientState>) => {
      setForm((prev) => ({
        ...prev,
        existingPatientId: patientId,
        patient: patientData
          ? {
              ...prev.patient,
              ...patientData,
            }
          : prev.patient,
      }));
    },
    []
  );

  // Clear a specific validation error
  const clearError = useCallback((field: string) => {
    setForm((prev) => {
      if (!prev.errors[field]) return prev;
      const updated = { ...prev.errors };
      delete updated[field];
      return {
        ...prev,
        errors: updated,
      };
    });
  }, []);

  // Reset form back to initial state
  const reset = useCallback(() => {
    setForm({
      ...INITIAL_FORM_STATE,
      patient: { ...INITIAL_PATIENT_STATE },
      errors: {},
    });
  }, []);

  // Validate form state against Sri Lankan NIC, phone, and required business rules
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // 1. Full name is required
    if (!form.patient.fullName || !form.patient.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    // 2. Phone number is required and must be valid Sri Lankan format
    if (!form.patient.phone || !form.patient.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!isValidSLPhone(form.patient.phone)) {
      newErrors.phone = 'Enter a valid Sri Lankan phone number (e.g. 0771234567)';
    }

    // 3. NIC is optional, but if provided, must be valid
    if (form.patient.nic && form.patient.nic.trim()) {
      if (!isValidNIC(form.patient.nic)) {
        newErrors.nic = 'Enter a valid NIC (9 digits + V/X or 12 digits)';
      }
    }

    // 4. Age must be between 0 and 120 if provided
    if (
      form.patient.age !== '' &&
      form.patient.age !== undefined &&
      form.patient.age !== null
    ) {
      const ageNum = Number(form.patient.age);
      if (isNaN(ageNum) || ageNum < 0 || ageNum > 120) {
        newErrors.age = 'Age must be between 0 and 120';
      }
    }

    // 5. Department is required
    if (!form.department || !form.department.trim()) {
      newErrors.department = 'Department is required';
    }

    // 6. Doctor is required
    if (!form.doctorId || !form.doctorId.trim()) {
      newErrors.doctorId = 'Doctor is required';
    }

    // 7. Slot time is required
    if (!form.slotTime || !form.slotTime.trim()) {
      newErrors.slotTime = 'Slot time is required';
    }

    setForm((prev) => ({
      ...prev,
      errors: newErrors,
    }));

    return Object.keys(newErrors).length === 0;
  }, [form]);

  return {
    query: form.query,
    patient: form.patient,
    existingPatientId: form.existingPatientId,
    intakeType: form.intakeType,
    priority: form.priority,
    department: form.department,
    doctorId: form.doctorId,
    slotTime: form.slotTime,
    errors: form.errors,
    formState: form,

    setField,
    setPatient,
    setExistingPatient,
    setErrors: (errorsOrFn) =>
      setForm((prev) => ({
        ...prev,
        errors:
          typeof errorsOrFn === 'function'
            ? errorsOrFn(prev.errors)
            : errorsOrFn,
      })),
    clearError,
    reset,
    validate,
  };
};

export default useWalkInForm;
