import { useState, useCallback } from 'react';
import { isValidNIC, isValidSLPhone } from '../utils/validations';
import { QueuePriority, AppointmentType } from '../types';

export interface WalkInPatientState {
  fullName: string;
  name?: string;
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
  setPatient: (patientData: Partial<WalkInPatientState> & { name?: string }) => void;
  setExistingPatient: (
    patientId: string | null,
    patientData?: Partial<WalkInPatientState> & { name?: string }
  ) => void;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  clearError: (field: string) => void;
  reset: () => void;
  validate: () => boolean;
}

/**
 * Custom hook to manage walk-in / pre-booked intake form state and validation.
 */
export const useWalkInForm = (
  initialValues?: Partial<WalkInFormState> & {
    name?: string;
    fullName?: string;
    nic?: string;
    phone?: string;
    age?: string | number;
    gender?: string;
    existingPatientId?: string | null;
  }
): UseWalkInFormReturn => {
  const [form, setForm] = useState<WalkInFormState>(() => {
    const rawPatient: Partial<WalkInPatientState> & { name?: string } =
      initialValues?.patient || {};
    const resolvedFullName =
      rawPatient.fullName ||
      rawPatient.name ||
      initialValues?.fullName ||
      initialValues?.name ||
      '';
    const resolvedNic = rawPatient.nic || initialValues?.nic || '';
    const resolvedPhone = rawPatient.phone || initialValues?.phone || '';
    const resolvedAge =
      rawPatient.age !== undefined && rawPatient.age !== null
        ? String(rawPatient.age)
        : initialValues?.age !== undefined && initialValues?.age !== null
        ? String(initialValues.age)
        : '';
    const resolvedGender = (rawPatient.gender || initialValues?.gender || '') as any;
    const resolvedExistingId =
      initialValues?.existingPatientId !== undefined
        ? initialValues.existingPatientId
        : null;

    return {
      ...INITIAL_FORM_STATE,
      ...initialValues,
      existingPatientId: resolvedExistingId,
      patient: {
        ...INITIAL_PATIENT_STATE,
        ...rawPatient,
        fullName: resolvedFullName,
        nic: resolvedNic,
        phone: resolvedPhone,
        age: resolvedAge,
        gender: resolvedGender,
      },
      errors: initialValues?.errors || {},
    };
  });

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
      if (['fullName', 'name', 'nic', 'phone', 'age', 'gender'].includes(field)) {
        const targetField = field === 'name' ? 'fullName' : field;
        delete newErrors[targetField];
        delete newErrors[field];
        return {
          ...prev,
          patient: {
            ...prev.patient,
            [targetField]: value,
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
  const setPatient = useCallback(
    (patientData: Partial<WalkInPatientState> & { name?: string }) => {
      setForm((prev) => ({
        ...prev,
        patient: {
          ...prev.patient,
          ...patientData,
          fullName:
            patientData.fullName || patientData.name || prev.patient.fullName,
        },
        errors: Object.keys(patientData).reduce(
          (acc, key) => {
            delete acc[key];
            return acc;
          },
          { ...prev.errors }
        ),
      }));
    },
    []
  );

  // Set existing patient selection from search or navigation prefill
  const setExistingPatient = useCallback(
    (
      patientId: string | null,
      patientData?: Partial<WalkInPatientState> & { name?: string }
    ) => {
      setForm((prev) => ({
        ...prev,
        existingPatientId: patientId,
        patient: patientData
          ? {
              ...prev.patient,
              ...patientData,
              fullName:
                patientData.fullName || patientData.name || prev.patient.fullName,
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
