import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Card, ErrorBanner, SectionLabel, ShortcutRow, ShortcutTile, StatTile } from '../../src/components/ui';
import { AttendanceSummary, ExamResult, PortalApi, StudentProfile } from '../../src/lib/portal.api';
import { colors, spacing, statusColors } from '../../src/theme';

export default function StudentHome() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [exams, setExams] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [me, att, res] = await Promise.all([PortalApi.me(), PortalApi.attendance(), PortalApi.results()]);
      setProfile(me.student);
      setAttendance(att);
      setExams(res.exams);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const pct = attendance?.summary.percentage ?? null;
  const pctTone = pct == null ? colors.muted : pct >= 90 ? colors.success : pct >= 75 ? colors.warning : colors.danger;
  const latestExam = exams[0] ?? null;
  const firstName = profile?.studentName.split(' ')[0] ?? '';

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <ErrorBanner message={error} />

      {profile && (
        <>
          <View style={styles.greetingWrap}>
            <Text style={styles.greetingHi}>Welcome back,</Text>
            <Text style={styles.greetingName}>{firstName} 👋</Text>
          </View>

          <SectionLabel>SHORTCUTS</SectionLabel>
          <ShortcutRow>
            <ShortcutTile icon="checkmark-done" label="Attendance" tone={colors.primary} onPress={() => router.push('/attendance')} />
            <ShortcutTile icon="school" label="Exams" tone={colors.accent} onPress={() => router.push('/results')} />
            <ShortcutTile icon="calendar" label="Timetable" tone={colors.success} onPress={() => router.push('/timetable')} />
          </ShortcutRow>

          <SectionLabel>SUMMARY</SectionLabel>
          <Card>
            <View style={styles.statsGrid}>
              <View style={styles.statCell}><StatTile label="Attendance" value={pct != null ? `${pct}%` : '—'} tone={pctTone} /></View>
              <View style={styles.statCell}><StatTile label="Present Days" value={attendance?.summary.present ?? 0} tone={statusColors.present.fg} /></View>
              <View style={styles.statCell}><StatTile label="Exams Taken" value={exams.length} tone={colors.primary} /></View>
              <View style={styles.statCell}>
                <StatTile
                  label="Latest Grade"
                  value={latestExam?.grade ?? '—'}
                  tone={latestExam?.passed ? colors.success : latestExam ? colors.danger : colors.muted}
                />
              </View>
            </View>
          </Card>

          {latestExam && (
            <>
              <SectionLabel>LATEST EXAM</SectionLabel>
              <Card>
                <View style={styles.latestRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.latestName}>{latestExam.name}</Text>
                    {latestExam.startDate && <Text style={styles.latestMeta}>{latestExam.startDate}</Text>}
                  </View>
                  <Text style={[styles.latestPct, { color: latestExam.passed ? colors.success : colors.danger }]}>
                    {latestExam.percentage}%
                  </Text>
                  <Badge label={latestExam.passed ? 'Passed' : 'Failed'} tone={latestExam.passed ? 'success' : 'danger'} />
                </View>
              </Card>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  greetingWrap: { marginBottom: spacing.lg },
  greetingHi: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  greetingName: { fontSize: 26, color: colors.ink, fontWeight: '900', marginTop: 2, letterSpacing: -0.3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', marginBottom: spacing.md },
  latestRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  latestName: { fontSize: 14.5, fontWeight: '800', color: colors.ink },
  latestMeta: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: '500' },
  latestPct: { fontSize: 17, fontWeight: '900' },
});
