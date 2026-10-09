const fs = require('fs');
const path = 'frontend/src/app/_layout.tsx';
let content = fs.readFileSync(path, 'utf8');

const useFontsLogic = `
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }
`;

// Remove from GlobalSafeArea
content = content.replace(/function GlobalSafeArea\(\) \{\s*const \[fontsLoaded\] = useFonts\(\{[\s\S]*?if \(!fontsLoaded\) \{\s*return null;\s*\}/, 'function GlobalSafeArea() {');

// Add to RootLayout
content = content.replace(/export default function RootLayout\(\) \{/, 'export default function RootLayout() {' + useFontsLogic);

fs.writeFileSync(path, content);
console.log('Fixed useFonts location in _layout.tsx');
