import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, ErrorBanner, Field, ScreenTitle } from '../../src/components/ui';
import { AcademicYear, ClassRow, ClassSection, SectionAttendance, TeacherApi } from '../../src/lib/teacher.api';
import { colors, radius, spacing, statusColors } from '../../src/theme';

const STATUSES = [
  { key: 'present', label: 'P' },
  { key: 'absent', label: 'A' },
  { key: 'late', label: 'L' },
  { key: 'half_day', label: 'HD' },
] as const;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherAttendance() {
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [roster, setRoster] = useState<SectionAttendance | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, c, years] = await Promise.all([TeacherApi.sections(), TeacherApi.classes(), TeacherApi.academicYears()]);
        setSections(s);
        setClasses(c);
        setAcademicYear(years.find((y) => y.isCurrent) ?? years[0] ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load sections');
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, []);

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  async function loadRoster() {
    if (!sectionId) return setError('Pick a section first.');
    setError(null);
    setSavedMsg(null);
    setLoadingRoster(true);
    try {
      const res = await TeacherApi.sectionAttendance(sectionId, date);
      setRoster(res);
      const initial: Record<string, string> = {};
      for (const row of res.rows) initial[row.studentId] = row.status ?? 'present';
      setMarks(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roster');
      setRoster(null);
    } finally {
      setLoadingRoster(false);
    }
  }

  async function save() {
    if (!roster || !sectionId || !academicYear) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await TeacherApi.markAttendance({
        sectionId,
        academicYearId: academicYear.id,
        date,
        entries: roster.rows.map((r) => ({ studentId: r.studentId, status: marks[r.studentId] as any })),
      });
      setSavedMsg('Attendance saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  }

  if (loadingMeta) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        contentContainerStyle={styles.rosterContainer}
        keyboardShouldPersistTaps="handled"
        data={roster?.rows ?? []}
        keyExtractor={(item) => item.studentId}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenTitle subtitle="Pick a section and date to mark attendance">Mark Attendance</ScreenTitle>
            <ErrorBanner message={error} />

            <Text style={styles.label}>Section</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {sections.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSectionId(s.id)}
                  style={[styles.chip, sectionId === s.id && styles.chipActive]}
                >
                  <Text style={sectionId === s.id ? styles.chipTextActive : styles.chipText}>
                    {classNameById.get(s.classId) ?? 'Class'} {s.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder={todayISO()} />
            <Button title="Load Roster" onPress={loadRoster} loading={loadingRoster} />

            {savedMsg && (
              <View style={styles.savedBanner}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.savedText}>{savedMsg}</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.studentRow}>
            <Avatar name={item.studentName} size={36} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.studentName}>{item.studentName}</Text>
              {item.rollNumber && <Text style={styles.rollNo}>Roll {item.rollNumber}</Text>}
            </View>
            <View style={styles.statusGroup}>
              {STATUSES.map((st) => {
                const active = marks[item.studentId] === st.key;
                const c = statusColors[st.key];
                return (
                  <Pressable
                    key={st.key}
                    onPress={() => setMarks((m) => ({ ...m, [item.studentId]: st.key }))}
                    style={[styles.statusBtn, active && { backgroundColor: c.fg, borderColor: c.fg }]}
                  >
                    <Text style={[styles.statusBtnText, active && { color: '#fff' }]}>{st.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        ListFooterComponent={
          roster ? (
            <View style={{ marginTop: 12 }}>
              <Button title="Save Attendance" onPress={save} loading={saving} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { marginBottom: 10 },
  rosterContainer: { padding: spacing.xl },
  label: { fontSize: 13, fontWeight: '700', color: colors.body, marginBottom: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.body, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff', fontSize: 13, fontWeight: '800' },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 11,
    marginBottom: 10,
  },
  savedText: { color: colors.success, fontSize: 13, fontWeight: '700' },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  studentName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  rollNo: { fontSize: 11.5, color: colors.faint, marginTop: 2, fontWeight: '600' },
  statusGroup: { flexDirection: 'row', gap: 6 },
  statusBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBtnText: { fontSize: 11.5, fontWeight: '800', color: colors.body },
});
