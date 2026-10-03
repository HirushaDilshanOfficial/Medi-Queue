import { Redirect } from 'expo-router';

// App start වෙනකොට Doctor Schedule එකට direct යවනවා
export default function Index() {
  return <Redirect href="/(doctor)/schedule" />;
}


