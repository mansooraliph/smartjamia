import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="(teacher)" />
        <Stack.Screen
          name="exam-marks/[id]"
          options={{
            headerShown: true,
            title: 'Enter Marks',
            headerStyle: { backgroundColor: colors.bg },
            headerTitleStyle: { fontWeight: '800', color: colors.ink },
            headerTintColor: colors.primary,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="section/[id]"
          options={{
            headerShown: true,
            title: 'Timetable',
            headerStyle: { backgroundColor: colors.bg },
            headerTitleStyle: { fontWeight: '800', color: colors.ink },
            headerTintColor: colors.primary,
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
