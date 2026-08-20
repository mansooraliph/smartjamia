import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Field, Button, ErrorBanner } from '../src/components/ui';
import { AuthApi } from '../src/lib/auth.api';
import { useAuthStore } from '../src/stores/auth.store';
import { colors, radius, shadow, spacing } from '../src/theme';

type Mode = 'teacher' | 'student';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('teacher');
  const [schoolCode, setSchoolCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginAsTeacher = useAuthStore((s) => s.loginAsTeacher);
  const loginAsStudent = useAuthStore((s) => s.loginAsStudent);

  async function submit() {
    setError(null);
    if (!schoolCode.trim()) return setError('School code is required.');
    setLoading(true);
    try {
      if (mode === 'teacher') {
        const res = await AuthApi.teacherLogin(schoolCode.trim(), email.trim(), password);
        loginAsTeacher({ token: res.tokens.accessToken, user: res.user });
        router.replace('/(teacher)');
      } else {
        const res = await AuthApi.studentLogin(schoolCode.trim(), admissionNumber.trim(), pin);
        loginAsStudent({ token: res.token, user: res.user });
        router.replace('/(student)');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.primaryDark }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <Ionicons name="school" size={30} color="#fff" />
          </View>
          <Text style={styles.brandText}>EduPro</Text>
          <Text style={styles.brandSub}>Sign in to continue</Text>
        </View>

        <View style={styles.sheet}>
          <View style={styles.toggle}>
            <Pressable
              onPress={() => setMode('teacher')}
              style={[styles.toggleBtn, mode === 'teacher' && styles.toggleBtnActive]}
            >
              <Ionicons name="briefcase" size={14} color={mode === 'teacher' ? colors.primary : colors.muted} style={{ marginRight: 6 }} />
              <Text style={mode === 'teacher' ? styles.toggleTextActive : styles.toggleText}>Teacher / Staff</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('student')}
              style={[styles.toggleBtn, mode === 'student' && styles.toggleBtnActive]}
            >
              <Ionicons name="school-outline" size={14} color={mode === 'student' ? colors.primary : colors.muted} style={{ marginRight: 6 }} />
              <Text style={mode === 'student' ? styles.toggleTextActive : styles.toggleText}>Student</Text>
            </Pressable>
          </View>

          <ErrorBanner message={error} />

          <Field label="School Code" placeholder="e.g. demo-school" value={schoolCode} onChangeText={setSchoolCode} autoCapitalize="characters" />

          {mode === 'teacher' ? (
            <>
              <Field label="Email" placeholder="you@school.edu" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <Field label="Password" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />
            </>
          ) : (
            <>
              <Field label="Admission Number" placeholder="ADM2026001" value={admissionNumber} onChangeText={setAdmissionNumber} autoCapitalize="characters" />
              <Field label="PIN" placeholder="4–6 digits" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} />
            </>
          )}

          <Button title="Sign In" onPress={submit} loading={loading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', marginTop: 48, marginBottom: 32 },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  brandText: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  brandSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, fontWeight: '500' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    minHeight: 420,
    ...shadow.raised,
  },
  toggle: { flexDirection: 'row', backgroundColor: colors.divider, borderRadius: radius.sm, padding: 4, marginBottom: spacing.xl },
  toggleBtn: { flex: 1, flexDirection: 'row', paddingVertical: 11, borderRadius: radius.sm - 2, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: '#fff', ...shadow.card, shadowOpacity: 0.08 },
  toggleText: { color: colors.muted, fontWeight: '700', fontSize: 13.5 },
  toggleTextActive: { color: colors.ink, fontWeight: '800', fontSize: 13.5 },
});
