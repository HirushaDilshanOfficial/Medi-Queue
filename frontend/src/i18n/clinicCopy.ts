// Display labels only. The original department values remain in API requests.
const departmentCopy = `
General Medical|සාමාන්‍ය වෛද්‍ය|பொது மருத்துவம்
General Surgery|සාමාන්‍ය ශල්‍ය|பொது அறுவை சிகிச்சை
Orthopaedic|අස්ථි හා සන්ධි|எலும்பு மற்றும் மூட்டு சிகிச்சை
ENT|කන, නාසය හා උගුර|காது, மூக்கு மற்றும் தொண்டை
Eye|අක්ෂි|கண் சிகிச்சை
Cardiology|හෘද රෝග|இதய சிகிச்சை
Neurology|ස්නායු රෝග|நரம்பியல்
Neurosurgery|ස්නායු ශල්‍ය|நரம்பியல் அறுவை சிகிச்சை
Diabetes|දියවැඩියාව|நீரிழிவு
Nephrology|වකුගඩු රෝග|சிறுநீரக சிகிச்சை
Respiratory / Chest|ශ්වසන හා ළය රෝග|சுவாசம் மற்றும் மார்பு சிகிச்சை
Dermatology|චර්ම රෝග|தோல் சிகிச்சை
Paediatric|ළමා රෝග|குழந்தைகள் சிகிச்சை
Gynaecology|නාරිවේද|மகளிர் சிகிச்சை
Obstetrics / Antenatal|ප්‍රසව හා ගර්භණී සත්කාර|மகப்பேறு மற்றும் கர்ப்பகால பராமரிப்பு
Psychiatry|මානසික සෞඛ්‍ය|மனநல சிகிச்சை
Oncology|පිළිකා රෝග|புற்றுநோய் சிகிச்சை
Urology|මුත්‍රා පද්ධති රෝග|சிறுநீர் மண்டல சிகிச்சை
Dental|දන්ත|பல் சிகிச்சை
Physiotherapy & Rehabilitation|භෞතචිකිත්සා හා පුනරුත්ථාපනය|இயன்முறை சிகிச்சை மற்றும் மறுவாழ்வு
Plastic & Reconstructive Surgery|ප්ලාස්ටික් හා ප්‍රතිනිර්මාණ ශල්‍ය|பிளாஸ்டிக் மற்றும் மறுசீரமைப்பு அறுவை சிகிச்சை
Vascular Surgery|රුධිර නාල ශල්‍ය|இரத்த நாள அறுவை சிகிச்சை
Sports Medicine|ක්‍රීඩා වෛද්‍ය|விளையாட்டு மருத்துவம்
Stroke|ආඝාත|பக்கவாத சிகிச்சை
Nutrition & Dietetic|පෝෂණ හා ආහාරවේද|ஊட்டச்சத்து மற்றும் உணவியல்
Fertility|සරුභාවය|கருவுறுதல் சிகிச்சை
Wound Care|තුවාල සත්කාර|காய பராமரிப்பு
Vaccination|එන්නත්කරණය|தடுப்பூசி
`;
const descriptionCopy = `
General medical conditions|සාමාන්‍ය රෝග තත්ත්ව|பொதுவான மருத்துவ நிலைகள்
Surgical conditions and follow-ups|ශල්‍ය රෝග හා පසු විපරම්|அறுவை சிகிச்சை நிலைகள் மற்றும் தொடர் பராமரிப்பு
Bone, joint and fracture problems|අස්ථි, සන්ධි හා අස්ථි බිඳීම්|எலும்பு, மூட்டு மற்றும் முறிவு பிரச்சினைகள்
Ear, nose and throat problems|කන, නාසය හා උගුරේ රෝග|காது, மூக்கு மற்றும் தொண்டை பிரச்சினைகள்
Eye and vision problems|ඇස් හා පෙනීමේ ගැටලු|கண் மற்றும் பார்வை பிரச்சினைகள்
Heart-related conditions|හෘදය ආශ්‍රිත රෝග|இதயம் தொடர்பான நிலைகள்
Brain and nerve conditions|මොළය හා ස්නායු ආශ්‍රිත රෝග|மூளை மற்றும் நரம்பு தொடர்பான நிலைகள்
Brain, spine and nerve surgery|මොළය, කොඳු ඇට පෙළ හා ස්නායු ශල්‍ය|மூளை, முதுகெலும்பு மற்றும் நரம்பு அறுவை சிகிச்சை
Diabetes treatment and monitoring|දියවැඩියා ප්‍රතිකාර හා අධීක්ෂණය|நீரிழிவு சிகிச்சை மற்றும் கண்காணிப்பு
Kidney-related conditions|වකුගඩු ආශ්‍රිත රෝග|சிறுநீரகம் தொடர்பான நிலைகள்
Lung and breathing conditions|පෙනහළු හා ශ්වසන රෝග|நுரையீரல் மற்றும் சுவாச நிலைகள்
Skin, hair and nail conditions|සම, හිසකෙස් හා නිය ආශ්‍රිත රෝග|தோல், முடி மற்றும் நகங்கள் தொடர்பான நிலைகள்
Children's medical care|ළමා වෛද්‍ය සත්කාර|குழந்தைகளுக்கான மருத்துவ பராமரிப்பு
Women's reproductive health|කාන්තා ප්‍රජනන සෞඛ්‍ය|பெண்களின் இனப்பெருக்க ஆரோக்கியம்
Pregnancy and maternity care|ගර්භණී හා මාතෘ සත්කාර|கர்ப்பகால மற்றும் மகப்பேறு பராமரிப்பு
Mental-health care|මානසික සෞඛ්‍ය සත්කාර|மனநல பராமரிப்பு
Cancer treatment and follow-up|පිළිකා ප්‍රතිකාර හා පසු විපරම්|புற்றுநோய் சிகிச்சை மற்றும் தொடர் பராமரிப்பு
Urinary-system conditions|මුත්‍රා පද්ධති රෝග|சிறுநீர் மண்டல நிலைகள்
Teeth and oral-health problems|දත් හා මුඛ සෞඛ්‍ය ගැටලු|பல் மற்றும் வாய்ச் சுகாதாரப் பிரச்சினைகள்
Rehabilitation and physical therapy|පුනරුත්ථාපන හා භෞතචිකිත්සා|மறுவாழ்வு மற்றும் இயன்முறை சிகிச்சை
Reconstructive surgical care|ප්‍රතිනිර්මාණ ශල්‍ය සත්කාර|மறுசீரமைப்பு அறுவை சிகிச்சை பராமரிப்பு
Blood-vessel conditions|රුධිර නාල රෝග|இரத்த நாள நிலைகள்
Sports injuries and related conditions|ක්‍රීඩා අනතුරු හා ආශ්‍රිත රෝග|விளையாட்டு காயங்கள் மற்றும் தொடர்புடைய நிலைகள்
Stroke assessment and follow-up|ආඝාත ඇගයීම හා පසු විපරම්|பக்கவாத மதிப்பீடு மற்றும் தொடர் பராமரிப்பு
Diet and nutrition management|ආහාර හා පෝෂණ කළමනාකරණය|உணவு மற்றும் ஊட்டச்சத்து மேலாண்மை
Fertility-related consultation|සරුභාවය පිළිබඳ උපදේශනය|கருவுறுதல் தொடர்பான ஆலோசனை
Wound assessment and treatment|තුවාල ඇගයීම හා ප්‍රතිකාර|காய மதிப்பீடு மற்றும் சிகிச்சை
Vaccination services|එන්නත් සේවා|தடுப்பூசி சேவைகள்
`;

export const clinicCopy: Record<string, readonly [string, string]> = {};
const departmentLabels = new Set(departmentCopy.trim().split('\n').map(line => line.split('|')[0]));
for (const line of [...departmentCopy.trim().split('\n'), ...descriptionCopy.trim().split('\n')]) {
  const [english, sinhala, tamil] = line.split('|');
  clinicCopy[english] = [sinhala, tamil];
  if (departmentLabels.has(english)) {
    clinicCopy[`${english} Clinic`] = [`${sinhala} සායනය`, `${tamil} மருத்துவ நிலையம்`];
  }
}
const aliases: Record<string, string> = {
  Orthopedic: 'Orthopaedic', Orthopedics: 'Orthopaedic', Orthopaedics: 'Orthopaedic', Orthopedist: 'Orthopaedic',
  Pediatrics: 'Paediatric', Paediatrics: 'Paediatric', Pediatric: 'Paediatric', Pediatrician: 'Paediatric',
  Gynaecologist: 'Gynaecology', Gynecology: 'Gynaecology', Gynecologist: 'Gynaecology',
  Cardiologist: 'Cardiology', Neurologist: 'Neurology', Dermatologist: 'Dermatology',
  Psychiatrist: 'Psychiatry', Nephrologist: 'Nephrology', Ophthalmology: 'Eye', Ophthalmologist: 'Eye',
  'General Medicine': 'General Medical', 'Internal Medicine': 'General Medical', 'General Practitioner': 'General Medical',
  OPD: 'General Medical', 'General OPD': 'General Medical', 'Hospital OPD': 'General Medical',
};
for (const [alias, key] of Object.entries(aliases)) {
  clinicCopy[alias] = clinicCopy[key];
  clinicCopy[`${alias} Clinic`] = clinicCopy[`${key} Clinic`];
}
