const fs = require('fs');
const path = 'frontend/src/i18n/LocalizedText.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacement = `
  const resolvedStyle = StyleSheet.flatten(style) || {};
  let fontFamily = 'Poppins_400Regular';
  
  if (language === 'en') {
    const fw = String(resolvedStyle.fontWeight || '400');
    if (fw === 'bold' || fw === '700') fontFamily = 'Poppins_700Bold';
    else if (fw === '600') fontFamily = 'Poppins_600SemiBold';
    else if (fw === '800' || fw === '900') fontFamily = 'Poppins_800ExtraBold';
    else if (fw === '500') fontFamily = 'Poppins_500Medium';
  } else {
    fontFamily = Platform.OS === 'ios' ? 'System' : 'sans-serif';
  }

  // We should remove fontWeight from the style to prevent RN from trying to apply it to a custom font, which sometimes causes issues on Android
  const { fontWeight, ...safeStyle } = resolvedStyle;
`;

content = content.replace(
  "const resolvedStyle = StyleSheet.flatten(style);",
  replacement
);

content = content.replace(
  "style={[",
  "style={["
);

content = content.replace(
  "language !== 'en' && {",
  "{\n          fontFamily,\n        },\n        language !== 'en' && {"
);

content = content.replace(
  "{...props}",
  "{...props}\n      style={[safeStyle, { fontFamily }]}"
);

content = content.replace(
  /style=\s*\{\[\s*style,\s*\{/g, // This might not match, let me just rewrite the return block
  ""
);

// Actually, I'll just rewrite the whole return block safely
content = content.replace(
  /return \([\s\S]*?\);\n\}/,
  `return (
    <RNText
      {...props}
      style={[
        safeStyle,
        { fontFamily },
        language !== 'en' && { letterSpacing: 0 }
      ]}
    >
      {localizedChildren}
    </RNText>
  );
}`
);

fs.writeFileSync(path, content);
console.log('Updated LocalizedText.tsx to use Poppins');
