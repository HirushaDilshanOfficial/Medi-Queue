import { Redirect } from 'expo-router';

// App start වෙනකොට Doctor Dashboard එකට direct යවනවා (පසුව අවශ්‍ය නම් /(auth)/welcome ලෙස මාරු කළ හැක)
export default function Index() {
  return <Redirect href="/(doctor)/dashboard" />;
}


