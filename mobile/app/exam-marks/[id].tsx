import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Avatar, Button, ErrorBanner } from '../../src/components/ui';
import { MarksGrid, TeacherApi } from '../../src/lib/teacher.api';
import { colors, radius, spacing } from '../../src/theme';

export default function ExamMarksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [grid, setGrid] = useState<MarksGrid | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, { marks: string; absent: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await TeacherApi.marksGrid(id);
        setGrid(res);
        setSubjectId(res.subjects[0]?.id ?? null);
        const initial: Record<string, { marks: string; absent: boolean }> = {};
        for (const st of res.students) {
          for (const subj of res.subjects) {
            const key = `${st.id}:${subj.id}`;
            const existing = res.marks[key];
            initial[key] = { marks: existing?.marksObtained != null ? String(existing.marksObtained) : '', absent: existing?.isAbsent ?? false };
          }
        }
        setValues(initial);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load marks grid');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function save() {
    if (!grid || !subjectId) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const entries = grid.students.map((st) => {
        const v = values[`${st.id}:${subjectId}`];
        return {
          studentId: st.id,
          subjectId,
          isAbsent: v?.absent ?? false,
          ...(v?.absent ? {} : { marksObtained: Number(v?.marks || 0) }),
        };
      });
      await TeacherApi.saveMarks(id, entries);
      setSavedMsg('Marks saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!grid) {
    return (
      <View style={styles.center}>
        <ErrorBanner message={error ?? 'Not found'} />
      </View>
    );
  }

  const subject = grid.subjects.find((s) => s.id === subjectId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.examName}>{grid.exam.name}</Text>
        <ErrorBanner message={error} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          {grid.subjects.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSubjectId(s.id)}
              style={[styles.chip, subjectId === s.id && styles.chipActive]}
            >
              <Text style={subjectId === s.id ? styles.chipTextActive : styles.chipText}>{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {subject && (
          <Text style={styles.maxMarks}>
            Max: {subject.maxMarks} · Pass: {subject.passMarks}
          </Text>
        )}
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={grid.students}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          savedMsg ? (
            <View style={styles.savedBanner}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.savedText}>{savedMsg}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const key = `${item.id}:${subjectId}`;
          const v = values[key] ?? { marks: '', absent: false };
          return (
            <View style={styles.studentRow}>
              <Avatar name={item.studentName} size={34} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.studentName}>{item.studentName}</Text>
                {item.rollNumber && <Text style={styles.rollNo}>Roll {item.rollNumber}</Text>}
              </View>
              {v.absent ? (
                <Text style={styles.absentText}>Absent</Text>
              ) : (
                <TextInput
                  style={styles.marksInput}
                  keyboardType="numeric"
                  value={v.marks}
                  onChangeText={(t) => setValues((prev) => ({ ...prev, [key]: { ...v, marks: t } }))}
                  placeholder="0"
                  placeholderTextColor={colors.faint}
                />
              )}
              <Pressable
                style={[styles.absentBtn, v.absent && styles.absentBtnActive]}
                onPress={() => setValues((prev) => ({ ...prev, [key]: { ...v, absent: !v.absent } }))}
              >
                <Text style={v.absent ? styles.absentBtnTextActive : styles.absentBtnText}>Abs</Text>
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={{ marginTop: 12 }}>
            <Button title="Save Marks" onPress={save} loading={saving} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { padding: spacing.xl, paddingBottom: 8, backgroundColor: colors.bg },
  examName: { fontSize: 18, fontWeight: '900', color: colors.ink, marginBottom: 12 },
  chip: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.body, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff', fontSize: 13, fontWeight: '800' },
  maxMarks: { fontSize: 12, color: colors.muted, marginTop: 6, fontWeight: '600' },
  list: { padding: spacing.xl, paddingTop: 4 },
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
    gap: 10,
  },
  studentName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  rollNo: { fontSize: 11.5, color: colors.faint, marginTop: 2, fontWeight: '600' },
  marksInput: {
    width: 60,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  absentText: { width: 60, textAlign: 'center', color: colors.danger, fontWeight: '800', fontSize: 12.5 },
  absentBtn: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 10 },
  absentBtnActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  absentBtnText: { fontSize: 11.5, fontWeight: '800', color: colors.body },
  absentBtnTextActive: { fontSize: 11.5, fontWeight: '800', color: '#fff' },
});
