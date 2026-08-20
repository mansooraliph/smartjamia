import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/auth.store';
import { colors } from '../src/theme';

export default function Index() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const roleKind = useAuthStore((s) => s.roleKind);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/login" />;
  if (roleKind === 'teacher') return <Redirect href="/(teacher)" />;
  if (roleKind === 'student') return <Redirect href="/(student)" />;
  return <Redirect href="/login" />;
}
