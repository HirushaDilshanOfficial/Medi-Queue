const fs = require('fs');
const path = require('path');

const dir = 'frontend/src/screens/MOH';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find the first instance of <View style={{ flex: 1, backgroundColor: Colors.white }}>
  // or <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
  content = content.replace(/<(View|SafeAreaView)([^>]*)backgroundColor:\s*Colors\.white([^>]*)>/, '<$1$2backgroundColor: Colors.primaryDark$3>');
  
  fs.writeFileSync(filePath, content);
}
console.log('Fixed background colors');
