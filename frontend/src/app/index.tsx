import { Redirect } from 'expo-router';

// App start වෙනකොට Welcome screen 
export default function Index() {
  return <Redirect href="/(auth)/welcome" />;
}


