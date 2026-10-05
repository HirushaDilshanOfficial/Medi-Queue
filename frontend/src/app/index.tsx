import { Redirect } from 'expo-router';

// App start වෙනකොට Login screen එකට direct යවනවා
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}


