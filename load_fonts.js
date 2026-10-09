const fs = require('fs');
const path = 'frontend/src/app/_layout.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add import
content = content.replace(
  "import { Ionicons } from '@expo/vector-icons';",
  "import { Ionicons } from '@expo/vector-icons';\nimport {\n  useFonts,\n  Poppins_400Regular,\n  Poppins_500Medium,\n  Poppins_600SemiBold,\n  Poppins_700Bold,\n  Poppins_800ExtraBold,\n} from '@expo-google-fonts/poppins';\nimport * as SplashScreen from 'expo-splash-screen';\nimport { useEffect } from 'react';"
);

// Add useFonts logic inside RootLayout
const logic = `
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

content = content.replace(
  "export default function RootLayout() {",
  "// Prevent auto hide\nSplashScreen.preventAutoHideAsync();\n\nexport default function RootLayout() {"
);

content = content.replace(
  "const segments = useSegments();",
  logic + "\n  const segments = useSegments();"
);

fs.writeFileSync(path, content);
console.log('Fonts loaded in _layout.tsx');
