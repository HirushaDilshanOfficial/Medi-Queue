const fs = require('fs');
const path = require('path');

const dir = 'frontend/src/screens/MOH';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

let modifiedCount = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if this screen has a teal status bar
  if (content.includes('barStyle="light-content"') && content.includes('backgroundColor={Colors.primaryDark}')) {
    
    // Find the first <View> or <SafeAreaView> return wrapper and change its background to Colors.primaryDark
    // We look for 'return (' followed by the view
    const returnIndex = content.indexOf('return (');
    if (returnIndex !== -1) {
      const startToReturn = content.substring(0, returnIndex);
      let afterReturn = content.substring(returnIndex);
      
      // Replace only the first instance of backgroundColor: Colors.white or backgroundColor: Colors.background
      // after the return statement
      afterReturn = afterReturn.replace(/<(View|SafeAreaView)([^>]*)backgroundColor:\s*Colors\.(white|background)([^>]*)>/, '<$1$2backgroundColor: Colors.primaryDark$4>');
      
      const newContent = startToReturn + afterReturn;
      if (newContent !== content) {
        fs.writeFileSync(filePath, newContent);
        console.log(`Modified ${file}`);
        modifiedCount++;
      }
    }
  }
}

console.log(`Successfully fixed ${modifiedCount} files.`);
