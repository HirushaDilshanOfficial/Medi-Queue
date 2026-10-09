const fs = require('fs');
const pathLayout = 'frontend/src/app/_layout.tsx';
let layoutContent = fs.readFileSync(pathLayout, 'utf8');

layoutContent = layoutContent.replace(
  /@expo-google-fonts\/poppins/g,
  '@expo-google-fonts/inter'
);

layoutContent = layoutContent.replace(/Poppins_/g, 'Inter_');

fs.writeFileSync(pathLayout, layoutContent);

const pathLocalText = 'frontend/src/i18n/LocalizedText.tsx';
let localTextContent = fs.readFileSync(pathLocalText, 'utf8');

localTextContent = localTextContent.replace(/Poppins_/g, 'Inter_');

fs.writeFileSync(pathLocalText, localTextContent);

console.log('Switched fonts to Inter');
