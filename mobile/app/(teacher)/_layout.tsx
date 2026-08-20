import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth.store';
import { colors } from '../../src/theme';

export default function TeacherTabsLayout() {
  const roleKind = useAuthStore((s) => s.roleKind);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const insets = useSafeAreaInsets();

  if (!isAuthenticated) return <Redirect href="/login" />;
  if (roleKind !== 'teacher') return <Redirect href="/" />;

  // Guaranteed clearance below the label even when the OS reports a 0 safe-area
  // inset (some simulators/browsers do) — never rely on insets.bottom alone.
  const bottomPad = Math.max(18, insets.bottom + 10);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#1e2a5e',
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          height: 8 + 48 + bottomPad,
          paddingTop: 8,
          paddingBottom: bottomPad,
        },
        headerShown: true,
        headerStyle: { backgroundColor: colors.bg, elevation: 0, shadowOpacity: 0 },
        headerTitleStyle: { fontWeight: '800', color: colors.ink },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="sections" options={{ title: 'Sections', tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done" size={size} color={color} /> }} />
      <Tabs.Screen name="exams" options={{ title: 'Exams', tabBarIcon: ({ color, size }) => <Ionicons name="school" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}
