import { Redirect } from 'expo-router';

export default function Index() {
  // Normally you'd check auth state here, for now we redirect to login
  return <Redirect href={"/(auth)/login" as any} />;
}
