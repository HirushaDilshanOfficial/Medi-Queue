// Interpolated interface messages. Values remain patient and clinical data.
const copy = String.raw`
Welcome back, {value0}!|නැවත සාදරයෙන් පිළිගනිමු, {value0}!|மீண்டும் வரவேற்கிறோம், {value0}!
Logged in as {value0}, but dashboard is not created yet.|{value0} ලෙස පිවිස ඇත. පාලක පුවරුව තවම සාදා නැත.|{value0} ஆக உள்நுழைந்துள்ளீர்கள். முகப்புப் பலகை இன்னும் உருவாக்கப்படவில்லை.
 • NIC: {value0}| • ජාතික හැඳුනුම්පත: {value0}| • தேசிய அடையாள அட்டை: {value0}
Blood group {value0}|රුධිර කාණ්ඩය {value0}|இரத்த வகை {value0}
{value0} ahead|ඔබට ඉදිරියෙන් {value0}|உங்களுக்கு முன் {value0}
{value0} {value1} {value2}, {value3} slots free|{value0} {value1} {value2}, හිස් වේලාවන් {value3}|{value0} {value1} {value2}, காலி நேரங்கள் {value3}
View {value0}, {value1}|{value0}, {value1} බලන්න|{value0}, {value1} பார்க்கவும்
Call emergency helpline {value0}|හදිසි උපකාරක අංකය {value0} අමතන්න|அவசர உதவி எண் {value0} ஐ அழைக்கவும்
Queue number {value0}|පෝලිම් අංකය {value0}|வரிசை எண் {value0}
Estimated wait {value0}|ඇස්තමේන්තුගත රැඳී සිටීම {value0}|மதிப்பிடப்பட்ட காத்திருப்பு {value0}
Remove {value0}|{value0} ඉවත් කරන්න|{value0} ஐ அகற்றவும்
See all {value0}|සියලු {value0} බලන්න|அனைத்து {value0} ஐயும் பார்க்கவும்
{value0}, fully booked|{value0}, සියලු වේලාවන් වෙන්කර ඇත|{value0}, அனைத்து நேரங்களும் முன்பதிவு செய்யப்பட்டுள்ளன
{value0}, {value1} left|{value0}, ඉතිරි {value1}|{value0}, மீதம் {value1}
• {value0} yrs|• වයස අවුරුදු {value0}|• வயது {value0} ஆண்டுகள்
BP: {value0} mmHg|රුධිර පීඩනය: {value0} mmHg|இரத்த அழுத்தம்: {value0} mmHg
Manage queue entry for {value0}|{value0}ගේ පෝලිම් සටහන කළමනාකරණය කරන්න|{value0} இன் வரிசைப் பதிவை நிர்வகிக்கவும்
Enjoy your {value0}-minute rest. Shift status set to "On Break".|විනාඩි {value0}ක විවේකයක් ගන්න. සේවා තත්ත්වය විවේකයක ලෙස සකසා ඇත.|{value0} நிமிட ஓய்வை எடுத்துக்கொள்ளுங்கள். பணிநிலை ஓய்வில் என அமைக்கப்பட்டுள்ளது.
Walk-in slot assigned for {value0} with Token #{value1}|{value0} සඳහා අංක #{value1} සමඟ සෘජු පැමිණීමේ වේලාවක් පවරා ඇත|{value0} க்கு வரிசை எண் #{value1} உடன் நேரடி வருகை நேரம் ஒதுக்கப்பட்டுள்ளது
Token #{value0} - {value1}|පෝලිම් අංක #{value0} - {value1}|வரிசை எண் #{value0} - {value1}
Reason: {value0}\nStatus: {value1}\nTime: {value2}|හේතුව: {value0}\nතත්ත්වය: {value1}\nවේලාව: {value2}|காரணம்: {value0}\nநிலை: {value1}\nநேரம்: {value2}
Token #{value0}|පෝලිම් අංක #{value0}|வரிசை எண் #{value0}
Remove "{value0}"?|"{value0}" ඉවත් කරන්නද?|"{value0}" ஐ அகற்றவா?
Are you sure you want to remove {value0} from this prescription?|මෙම බෙහෙත් වට්ටෝරුවෙන් {value0} ඉවත් කිරීමට ඔබට අවශ්‍යද?|இந்த மருந்துச் சீட்டிலிருந்து {value0} ஐ அகற்ற விரும்புகிறீர்களா?
Referral request for {value0} recorded for patient.|රෝගියා සඳහා {value0} වෙත යොමු කිරීමේ ඉල්ලීම සටහන් කර ඇත.|நோயாளிக்கான {value0} பரிந்துரைக் கோரிக்கை பதிவு செய்யப்பட்டுள்ளது.
Reverted back to Token #{value0}.|පෝලිම් අංක #{value0} වෙත ආපසු ගෙන ඇත.|வரிசை எண் #{value0} க்கு மீட்டமைக்கப்பட்டது.
Chime broadcast: Token #{value0}, please enter {value1}|හඬ නිවේදනය: පෝලිම් අංක #{value0}, කරුණාකර {value1} වෙත පිවිසෙන්න|ஒலி அறிவிப்பு: வரிசை எண் #{value0}, தயவுசெய்து {value1} க்கு வரவும்
Ring chime sent to {value0} for Token #{value1}|පෝලිම් අංක #{value1} සඳහා {value0} වෙත හඬ දැනුම්දීම යවා ඇත|வரிசை எண் #{value1} க்காக {value0} க்கு ஒலி அறிவிப்பு அனுப்பப்பட்டது
Token #{value0} ({value1}) called into room.|පෝලිම් අංක #{value0} ({value1}) කාමරයට කැඳවා ඇත.|வரிசை எண் #{value0} ({value1}) அறைக்கு அழைக்கப்பட்டது.
Token #{value0} called into room.|පෝලිම් අංක #{value0} කාමරයට කැඳවා ඇත.|வரிசை எண் #{value0} அறைக்கு அழைக்கப்பட்டது.
Age: {value0}y, {value1}\nReason: {value2}\nStatus: {value3}|වයස: අවුරුදු {value0}, {value1}\nහේතුව: {value2}\nතත්ත්වය: {value3}|வயது: {value0} ஆண்டுகள், {value1}\nகாரணம்: {value2}\nநிலை: {value3}
Opening records for {value0}|{value0}ගේ වාර්තා විවෘත කරමින්|{value0} இன் பதிவுகள் திறக்கப்படுகின்றன
Switched active record to {value0}|සක්‍රිය වාර්තාව {value0} වෙත මාරු කර ඇත|செயலில் உள்ள பதிவு {value0} க்கு மாற்றப்பட்டது
Instructions successfully sent to the Receptionist at {value0}.|{value0}හි පිළිගැනීමේ නිලධාරියා වෙත උපදෙස් සාර්ථකව යවා ඇත.|{value0} இல் உள்ள வரவேற்பாளருக்கு அறிவுறுத்தல்கள் அனுப்பப்பட்டன.
Are you sure you want to delete {value0}?|{value0} මකා දැමීමට ඔබට අවශ්‍යද?|{value0} ஐ நீக்க விரும்புகிறீர்களா?
Are you sure you want to remove {value0}?|{value0} ඉවත් කිරීමට ඔබට අවශ්‍යද?|{value0} ஐ அகற்ற விரும்புகிறீர்களா?
{value0} at {value1}|{value1}හි {value0}|{value1} இல் {value0}
{value0}, {value1} slots available|{value0}, වේලාවන් {value1}ක් ඇත|{value0}, {value1} நேரங்கள் உள்ளன
{value0} · {value1} at {value2}\n\nYou can book another time from the doctor list.|{value0} · {value2}හි {value1}\n\nවෛද්‍ය ලැයිස්තුවෙන් වෙනත් වේලාවක් වෙන්කර ගත හැක.|{value0} · {value2} இல் {value1}\n\nமருத்துவர் பட்டியலிலிருந்து வேறு நேரத்தை முன்பதிவு செய்யலாம்.
Collect your queue number for {value0}.|{value0} සඳහා ඔබේ පෝලිම් අංකය ලබා ගන්න.|{value0} க்கான உங்கள் வரிசை எண்ணைப் பெறவும்.
“{value0}” will be taken off your list. The clinic's own copy of your record is not affected.|“{value0}” ඔබේ ලැයිස්තුවෙන් ඉවත් කෙරේ. සායනයේ ඇති ඔබේ වාර්තාවේ පිටපත වෙනස් නොවේ.|“{value0}” உங்கள் பட்டியலிலிருந்து அகற்றப்படும். மருத்துவமனையில் உள்ள உங்கள் பதிவின் நகல் பாதிக்கப்படாது.
Your queue #{value0} is {value1} at {value2}. Open Queue to follow your turn.|ඔබේ පෝලිම් අංක #{value0} {value2}හි {value1} තත්ත්වයේ ඇත. ඔබේ වාරය බැලීමට පෝලිම විවෘත කරන්න.|உங்கள் வரிசை எண் #{value0}, {value2} இல் {value1} நிலையில் உள்ளது. உங்கள் முறையைக் காண வரிசையைத் திறக்கவும்.
 • Est. {value0}| • ඇස්තමේන්තුව {value0}| • மதிப்பீடு {value0}
Export {value0} visit summary|{value0}ගේ පැමිණීමේ සාරාංශය අපනයනය කරන්න|{value0} இன் வருகைச் சுருக்கத்தை ஏற்றுமதி செய்யவும்
Queue {value0}: {value1}. This screen updates automatically while you wait.|පෝලිම {value0}: {value1}. ඔබ රැඳී සිටින අතරතුර මෙම තිරය ස්වයංක්‍රීයව යාවත්කාලීන වේ.|வரிசை {value0}: {value1}. நீங்கள் காத்திருக்கும்போது இந்தத் திரை தானாகப் புதுப்பிக்கப்படும்.
Ticket ID: {value0}|ප්‍රවේශපත් හැඳුනුම: {value0}|சீட்டு அடையாளம்: {value0}
Token {value0} called to Room {value1}|පෝලිම් අංක {value0} කාමර {value1}ට කැඳවා ඇත|வரிசை எண் {value0} அறை {value1} க்கு அழைக்கப்பட்டது
Are you sure you want to mark {value0} ({value1}) as No-Show?|{value0} ({value1}) නොපැමිණි ලෙස සටහන් කිරීමට අවශ්‍යද?|{value0} ({value1}) வரவில்லை எனக் குறிக்க விரும்புகிறீர்களா?
Token {value0} marked as No-Show|පෝලිම් අංක {value0} නොපැමිණි ලෙස සටහන් කර ඇත|வரிசை எண் {value0} வரவில்லை எனக் குறிக்கப்பட்டது
Move {value0} 3 positions back in the waiting queue?|{value0} පෝලිමේ ස්ථාන 3ක් පසුපසට ගෙන යන්නද?|{value0} ஐ வரிசையில் 3 இடங்கள் பின்னால் நகர்த்தவா?
Token {value0} moved back in queue|පෝලිම් අංක {value0} පෝලිමේ පසුපසට ගෙන ඇත|வரிசை எண் {value0} வரிசையில் பின்னால் நகர்த்தப்பட்டது
Call Next to Room {value0}|ඊළඟ රෝගියා කාමර {value0}ට කැඳවන්න|அடுத்த நோயாளியை அறை {value0} க்கு அழைக்கவும்
Move back token {value0}|පෝලිම් අංක {value0} පසුපසට ගෙන යන්න|வரிசை எண் {value0} ஐ பின்னால் நகர்த்தவும்
Mark token {value0} as no show|පෝලිම් අංක {value0} නොපැමිණි ලෙස සටහන් කරන්න|வரிசை எண் {value0} ஐ வரவில்லை எனக் குறிக்கவும்
Upcoming Patients ({value0})|ඉදිරි රෝගීන් ({value0})|அடுத்த நோயாளிகள் ({value0})
Change assigned doctor for {value0}|{value0}ට පැවරූ වෛද්‍යවරයා වෙනස් කරන්න|{value0} க்கு ஒதுக்கப்பட்ட மருத்துவரை மாற்றவும்
Assign doctor to {value0}|{value0}ට වෛද්‍යවරයෙකු පවරන්න|{value0} க்கு மருத்துவரை ஒதுக்கவும்
Assigned {value0} to {value1}|{value1}ට {value0} පවරා ඇත|{value1} க்கு {value0} ஒதுக்கப்பட்டது
Prefilling OPD registration for {value0}...|{value0} සඳහා බාහිර රෝගී ලියාපදිංචිය පුරවමින්...|{value0} க்கான வெளிநோயாளர் பதிவை நிரப்புகிறது...
Search Results ({value0})|සෙවුම් ප්‍රතිඵල ({value0})|தேடல் முடிவுகள் ({value0})
Patient Records ({value0})|රෝගී වාර්තා ({value0})|நோயாளர் பதிவுகள் ({value0})
Matching "{value0}"|"{value0}"ට ගැළපෙන|"{value0}" உடன் பொருந்தும்
No registered patients match "{value0}". Try searching with a different NIC or phone number.|"{value0}"ට ගැළපෙන ලියාපදිංචි රෝගීන් නැත. වෙනත් හැඳුනුම්පත් හෝ දුරකථන අංකයකින් සොයන්න.|"{value0}" உடன் பொருந்தும் பதிவு செய்யப்பட்ட நோயாளிகள் இல்லை. வேறு அடையாள அட்டை அல்லது தொலைபேசி எண்ணைக் கொண்டு தேடவும்.
Token {value0} recalled to consultation room|පෝලිම් අංක {value0} නැවත උපදේශන කාමරයට කැඳවා ඇත|வரிசை எண் {value0} மீண்டும் ஆலோசனை அறைக்கு அழைக்கப்பட்டது
Are you sure you want to mark token {value0} as No-Show? This patient will be removed from active queue.|පෝලිම් අංක {value0} නොපැමිණි ලෙස සටහන් කිරීමට අවශ්‍යද? මෙම රෝගියා සක්‍රිය පෝලිමෙන් ඉවත් කෙරේ.|வரிசை எண் {value0} ஐ வரவில்லை எனக் குறிக்க விரும்புகிறீர்களா? இந்த நோயாளி செயலில் உள்ள வரிசையிலிருந்து அகற்றப்படுவார்.
{value0} Walk-In · {value1} Pre-Booked|සෘජු පැමිණීම් {value0} · පෙර වෙන්කළ {value1}|நேரடி வருகை {value0} · முன்பதிவு {value1}
~{value0} min avg wait|සාමාන්‍ය රැඳී සිටීම ~විනාඩි {value0}|சராசரி காத்திருப்பு ~{value0} நிமிடங்கள்
{value0} in consultation|උපදේශනයේ සිටින {value0}|ஆலோசனையில் {value0}
{value0} yrs|අවුරුදු {value0}|{value0} ஆண்டுகள்
 · Room {value0}| · කාමරය {value0}| · அறை {value0}
{value0} patients waiting in queue.|රෝගීන් {value0}ක් පෝලිමේ රැඳී සිටිති.|{value0} நோயாளிகள் வரிசையில் காத்திருக்கின்றனர்.
Room {value0}|කාමරය {value0}|அறை {value0}
Prefilled with record for {value0}|{value0}ගේ වාර්තාවෙන් පුරවා ඇත|{value0} இன் பதிவுடன் நிரப்பப்பட்டது
Existing record found for {value0}|{value0} සඳහා පවතින වාර්තාවක් හමු විය|{value0} க்கான ஏற்கனவே உள்ள பதிவு கண்டறியப்பட்டது
Token #{value0} issued successfully!|පෝලිම් අංක #{value0} සාර්ථකව නිකුත් කර ඇත!|வரிசை எண் #{value0} வழங்கப்பட்டது!
NIC: {value0} • |ජාතික හැඳුනුම්පත: {value0} • |தேசிய அடையாள அட்டை: {value0} • 
Age: {value0} • |වයස: {value0} • |வயது: {value0} • 
Gender {value0}|ස්ත්‍රී පුරුෂ භාවය {value0}|பாலினம் {value0}
Intake {value0}|පැමිණීමේ වර්ගය {value0}|வருகை வகை {value0}
Priority {value0}|ප්‍රමුඛතාව {value0}|முன்னுரிமை {value0}
Department {value0}|අංශය {value0}|பிரிவு {value0}
Doctor {value0}|වෛද්‍යවරයා {value0}|மருத்துவர் {value0}
Slot {value0}, status: {value1}|වේලාව {value0}, තත්ත්වය: {value1}|நேரம் {value0}, நிலை: {value1}
{value0}% completed|{value0}% සම්පූර්ණයි|{value0}% முடிந்தது
{value0} missed visits|මඟහැරුණු පැමිණීම් {value0}|தவறவிட்ட வருகைகள் {value0}
All Hospitals ({count})|සියලු රෝහල් ({count})|அனைத்து மருத்துவமனைகள் ({count})
All Patients ({count})|සියලු රෝගීන් ({count})|அனைத்து நோயாளிகள் ({count})
All Staff ({count})|සියලු කාර්ය මණ්ඩලය ({count})|அனைத்து பணியாளர்கள் ({count})
Serving|සේවය ලබා දෙමින්|சேவை வழங்கப்படுகிறது
No Show|නොපැමිණි|வரவில்லை
About {minutes} min|විනාඩි {minutes}ක් පමණ|சுமார் {minutes} நிமிடங்கள்
About {hours}h {minutes} min|පැය {hours}යි විනාඩි {minutes}ක් පමණ|சுமார் {hours} மணி {minutes} நிமிடங்கள்
About {hours}h|පැය {hours}ක් පමණ|சுமார் {hours} மணி
Physiotherapy|භෞත චිකිත්සාව|இயன்முறை சிகிச்சை
Radiology (X-Ray/MRI)|විකිරණවේදය (X-Ray/MRI)|கதிரியக்கம் (X-Ray/MRI)
Laboratory / Blood|රසායනාගාරය / රුධිරය|ஆய்வகம் / இரத்தம்
File reference: {file}|ගොනු යොමුව: {file}|கோப்பு குறிப்பு: {file}
The original document is held by the clinic.|මුල් ලේඛනය සායනය සතුව ඇත.|அசல் ஆவணம் மருத்துவமனையில் உள்ளது.
{minutes} min|විනාඩි {minutes}|{minutes} நிமிடங்கள்
~{minutes} min|~විනාඩි {minutes}|~{minutes} நிமிடங்கள்
~{hours}h {minutes}m|~පැය {hours} විනාඩි {minutes}|~{hours} மணி {minutes} நிமிடங்கள்
~{hours}h|~පැය {hours}|~{hours} மணி
< 5 min|විනාඩි 5ට අඩු|5 நிமிடங்களுக்குக் குறைவு
No wait|රැඳී සිටීමක් නැත|காத்திருப்பு இல்லை
Not enough data to generate AI insights at the moment.|දැනට විශ්ලේෂණ තොරතුරු ජනනය කිරීමට ප්‍රමාණවත් දත්ත නොමැත.|தற்போது பகுப்பாய்வுத் தகவல்களை உருவாக்கப் போதுமான தரவு இல்லை.
Data suggests a consistent spike in "{category}" bottlenecks at {hospital}. Recommend reviewing resource allocation and transferring support staff to {hospital} to balance the load over the next period.|{hospital}හි "{category}" බාධක නිරන්තරයෙන් වැඩි වන බව දත්ත පෙන්වයි. ඉදිරි කාලයේ වැඩ ප්‍රමාණය සමතුලිත කිරීමට සම්පත් බෙදාහැරීම සමාලෝචනය කර සහායක කාර්ය මණ්ඩලය {hospital} වෙත මාරු කිරීම නිර්දේශ කෙරේ.|{hospital} இல் "{category}" தடைகள் தொடர்ந்து அதிகரிப்பதைத் தரவு காட்டுகிறது. அடுத்த காலத்தில் பணிச்சுமையைச் சமப்படுத்த வள ஒதுக்கீட்டை மதிப்பாய்வு செய்து உதவிப் பணியாளர்களை {hospital} க்கு மாற்றப் பரிந்துரைக்கப்படுகிறது.
Status: {status}|තත්ත්වය: {status}|நிலை: {status}
Queue #{number}|පෝලිම් අංක #{number}|வரிசை எண் #{number}
Visit reason: {reason}|පැමිණීමේ හේතුව: {reason}|வருகைக்கான காரணம்: {reason}
No clinical notes have been shared for this visit.|මෙම පැමිණීම සඳහා සායනික සටහන් බෙදාගෙන නොමැත.|இந்த வருகைக்கான மருத்துவக் குறிப்புகள் பகிரப்படவில்லை.
NIC: {nic}|ජාතික හැඳුනුම්පත: {nic}|தேசிய அடையாள அட்டை: {nic}
Blood: {group}|රුධිර කාණ්ඩය: {group}|இரத்த வகை: {group}
{age} Yrs|වයස අවුරුදු {age}|வயது {age} ஆண்டுகள்
{number} slots remaining|ඉතිරි වේලාවන් {number}|மீதமுள்ள நேரங்கள் {number}
fully booked|සියලු වේලාවන් වෙන්කර ඇත|அனைத்து நேரங்களும் முன்பதிவு செய்யப்பட்டுள்ளன
OPD visit summary|බාහිර රෝගී පැමිණීමේ සාරාංශය|வெளிநோயாளர் வருகைச் சுருக்கம்
Medi-Queue · OPD visit summary|Medi-Queue · බාහිර රෝගී පැමිණීමේ සාරාංශය|Medi-Queue · வெளிநோயாளர் வருகைச் சுருக்கம்
Your queue and token details are ready.|ඔබේ පෝලිම් අංකය සහ ප්‍රවේශපත් විස්තර සූදානම්.|உங்கள் வரிசை எண் மற்றும் சீட்டு விவரங்கள் தயாராக உள்ளன.
Show this QR code to the staff at your appointment.|ඔබේ හමුවීමේදී මෙම QR කේතය කාර්ය මණ්ඩලයට පෙන්වන්න.|உங்கள் சந்திப்பின்போது இந்த QR குறியீட்டை ஊழியர்களிடம் காட்டவும்.
Queue number: {value0}|පෝලිම් අංකය: {value0}|வரிசை எண்: {value0}
Appointment time: {time}|හමුවීමේ වේලාව: {time}|சந்திப்பு நேரம்: {time}
Uploading your medical document...|ඔබේ වෛද්‍ය ලේඛනය උඩුගත කරමින්...|உங்கள் மருத்துவ ஆவணம் பதிவேற்றப்படுகிறது...
The medical document could not be uploaded.|වෛද්‍ය ලේඛනය උඩුගත කළ නොහැකි විය.|மருத்துவ ஆவணத்தைப் பதிவேற்ற முடியவில்லை.
Please add the document from your reports page.|කරුණාකර ඔබේ වාර්තා පිටුවෙන් ලේඛනය එක් කරන්න.|உங்கள் அறிக்கைகள் பக்கத்திலிருந்து ஆவணத்தைச் சேர்க்கவும்.
Personal notification|පුද්ගලික දැනුම්දීම|தனிப்பட்ட அறிவிப்பு
Hospital message|රෝහල් පණිවිඩය|மருத்துவமனைச் செய்தி
Could not load notifications. Please try again.|දැනුම්දීම් ලබාගත නොහැකි විය. නැවත උත්සාහ කරන්න.|அறிவிப்புகளை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.
`;

export const templateCopy: Record<string, readonly [string, string]> = Object.fromEntries(
  copy.slice(1, -1).split('\n').filter(Boolean).map(line => {
    const [key, si, ta] = line.split('|').map(value => value.replace(/\\n/g, '\n'));
    return [key, [si, ta] as const];
  }),
);
