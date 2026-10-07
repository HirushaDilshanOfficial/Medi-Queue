const CLINIC_CATALOGUE = [
  ['General Medical Clinic', 'General medical conditions', 'General Medical'],
  ['General Surgery Clinic', 'Surgical conditions and follow-ups', 'General Surgery'],
  ['Orthopaedic Clinic', 'Bone, joint and fracture problems', 'Orthopaedic'],
  ['ENT Clinic', 'Ear, nose and throat problems', 'ENT'],
  ['Eye Clinic', 'Eye and vision problems', 'Eye'],
  ['Cardiology Clinic', 'Heart-related conditions', 'Cardiology'],
  ['Neurology Clinic', 'Brain and nerve conditions', 'Neurology'],
  ['Neurosurgery Clinic', 'Brain, spine and nerve surgery', 'Neurosurgery'],
  ['Diabetes Clinic', 'Diabetes treatment and monitoring', 'Diabetes'],
  ['Nephrology Clinic', 'Kidney-related conditions', 'Nephrology'],
  ['Respiratory / Chest Clinic', 'Lung and breathing conditions', 'Respiratory / Chest'],
  ['Dermatology Clinic', 'Skin, hair and nail conditions', 'Dermatology'],
  ['Paediatric Clinic', "Children's medical care", 'Paediatric'],
  ['Gynaecology Clinic', "Women's reproductive health", 'Gynaecology'],
  ['Obstetrics / Antenatal Clinic', 'Pregnancy and maternity care', 'Obstetrics / Antenatal'],
  ['Psychiatry Clinic', 'Mental-health care', 'Psychiatry'],
  ['Oncology Clinic', 'Cancer treatment and follow-up', 'Oncology'],
  ['Urology Clinic', 'Urinary-system conditions', 'Urology'],
  ['Dental Clinic', 'Teeth and oral-health problems', 'Dental'],
  ['Physiotherapy & Rehabilitation Clinic', 'Rehabilitation and physical therapy', 'Physiotherapy & Rehabilitation'],
  ['Plastic & Reconstructive Surgery Clinic', 'Reconstructive surgical care', 'Plastic & Reconstructive Surgery'],
  ['Vascular Surgery Clinic', 'Blood-vessel conditions', 'Vascular Surgery'],
  ['Sports Medicine Clinic', 'Sports injuries and related conditions', 'Sports Medicine'],
  ['Stroke Clinic', 'Stroke assessment and follow-up', 'Stroke'],
  ['Nutrition & Dietetic Clinic', 'Diet and nutrition management', 'Nutrition & Dietetic'],
  ['Fertility Clinic', 'Fertility-related consultation', 'Fertility'],
  ['Wound Care Clinic', 'Wound assessment and treatment', 'Wound Care'],
  ['Vaccination Clinic', 'Vaccination services', 'Vaccination'],
];

const FEATURED_CLINICS = [
  'General Medical Clinic', 'General Surgery Clinic', 'Orthopaedic Clinic',
  'ENT Clinic', 'Eye Clinic', 'Cardiology Clinic', 'Neurology Clinic',
  'Diabetes Clinic', 'Dermatology Clinic', 'Paediatric Clinic',
  'Gynaecology Clinic', 'Psychiatry Clinic', 'Nephrology Clinic',
  'Respiratory / Chest Clinic', 'Urology Clinic', 'Dental Clinic',
];

function clinicDocuments(hospital) {
  return CLINIC_CATALOGUE.map(([name, description, department], index) => ({
    hospital,
    name,
    description,
    department,
    priority: FEATURED_CLINICS.includes(name) ? index : 100 + index,
  }));
}

module.exports = { CLINIC_CATALOGUE, FEATURED_CLINICS, clinicDocuments };
