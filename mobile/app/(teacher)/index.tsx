import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card, ErrorBanner, SectionLabel, ShortcutRow, ShortcutTile, StatTile } from '../../src/components/ui';
import { ClassRow, ClassSection, ExamRow, TeacherApi } from '../../src/lib/teacher.api';
import { useAuthStore } from '../../src/stores/auth.store';
import { colorForKey, colors, radius, spacing } from '../../src/theme';

export default function TeacherHome() {
  const user = useAuthStore((s) => s.teacherUser);

  const [sections, setSections] = useState<ClassSection[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [s, c, e] = await Promise.all([TeacherApi.sections(), TeacherApi.classes(), TeacherApi.exams()]);
      setSections(s);
      setClasses(c);
      setExams(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  const mySections = sections.filter((s) => !!user?.id && s.classTeacherId === user.id);
  const ongoingExams = exams.filter((e) => e.status === 'ongoing' || e.status === 'scheduled').length;
  const firstName = user?.name.split(' ')[0] ?? '';

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      {user && (
        <>
          <View style={styles.greetingWrap}>
            <Text style={styles.greetingHi}>Welcome back,</Text>
            <Text style={styles.greetingName}>{firstName} 👋</Text>
          </View>

          <SectionLabel>SHORTCUTS</SectionLabel>
          <ShortcutRow>
            <ShortcutTile icon="people" label="Sections" tone={colors.primary} onPress={() => router.push('/sections')} />
            <ShortcutTile icon="checkmark-done" label="Attendance" tone={colors.accent} onPress={() => router.push('/attendance')} />
            <ShortcutTile icon="school" label="Exams" tone={colors.success} onPress={() => router.push('/exams')} />
          </ShortcutRow>

          <ErrorBanner message={error} />

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              <SectionLabel>SUMMARY</SectionLabel>
              <Card>
                <View style={styles.statsGrid}>
                  <View style={styles.statCell}><StatTile label="Sections" value={sections.length} tone={colors.primary} /></View>
                  <View style={styles.statCell}><StatTile label="Class Teacher" value={mySections.length} tone={colors.accent} /></View>
                  <View style={styles.statCell}><StatTile label="Exams" value={exams.length} tone={colors.success} /></View>
                  <View style={styles.statCell}><StatTile label="Upcoming" value={ongoingExams} tone={colors.warning} /></View>
                </View>
              </Card>

              <SectionLabel>MY CLASSES</SectionLabel>
              {sections.length === 0 ? (
                <Card>
                  <Text style={styles.emptyText}>No sections assigned yet.</Text>
                </Card>
              ) : (
                sections.slice(0, 4).map((s) => {
                  const className = classNameById.get(s.classId) ?? 'Class';
                  const tone = colorForKey(className);
                  const isMine = !!user?.id && s.classTeacherId === user.id;
                  return (
                    <Pressable key={s.id} style={styles.classRow} onPress={() => router.push(`/section/${s.id}`)}>
                      <View style={[styles.iconWrap, { backgroundColor: `${tone}1A` }]}>
                        <Ionicons name="people" size={16} color={tone} />
                      </View>
                      <Text style={styles.className}>{className} — {s.name}</Text>
                      {isMine && <Ionicons name="star" size={14} color={colors.warning} />}
                      <Ionicons name="chevron-forward" size={14} color={colors.faint} />
                    </Pressable>
                  );
                })
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.lg },
  greetingWrap: { marginBottom: spacing.lg },
  greetingHi: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  greetingName: { fontSize: 26, color: colors.ink, fontWeight: '900', marginTop: 2, letterSpacing: -0.3 },
  loadingBox: { paddingVertical: 30, alignItems: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', marginBottom: spacing.md },
  emptyText: { fontSize: 13.5, color: colors.muted, fontWeight: '500', textAlign: 'center' },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  className: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
});
