import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState, ErrorBanner } from '../../src/components/ui';
import { TeacherApi, TimetableGrid } from '../../src/lib/teacher.api';
import { colorForKey, colors, radius, spacing } from '../../src/theme';

export default function SectionTimetableScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [grid, setGrid] = useState<TimetableGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const years = await TeacherApi.academicYears();
        const ay = years.find((y) => y.isCurrent) ?? years[0];
        if (!ay) {
          setError('No academic year found.');
          return;
        }
        const res = await TeacherApi.timetable(id, ay.id);
        setGrid(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load timetable');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const subjectById = new Map((grid?.subjects ?? []).map((s) => [s.id, s]));
  const teacherById = new Map((grid?.teachers ?? []).map((t) => [t.id, t]));
  const hasCells = grid ? Object.keys(grid.cells).length > 0 : false;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <ErrorBanner message={error} />

      {!grid ? null : (
        <>
          <Text style={styles.className}>
            {grid.className} — {grid.section.name}
          </Text>

          {!hasCells ? (
            <EmptyState message="No timetable has been set up for this section yet." />
          ) : (
            <View style={styles.gridCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.headerRow}>
                    <View style={styles.periodCell} />
                    {grid.days.map((d) => (
                      <View key={d} style={styles.dayHeaderCell}>
                        <Text style={styles.dayHeaderText}>{d.slice(0, 3).toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                  {grid.periods.map((p) => (
                    <View key={p.periodNumber} style={styles.row}>
                      <View style={styles.periodCell}>
                        <Text style={styles.periodText}>P{p.periodNumber}</Text>
                        <Text style={styles.periodTime}>{p.startTime}</Text>
                      </View>
                      {grid.days.map((d) => {
                        const cell = grid.cells[`${d}:${p.periodNumber}`];
                        const subject = cell ? subjectById.get(cell.subjectId) : null;
                        const teacher = cell?.staffId ? teacherById.get(cell.staffId) : null;
                        const tone = subject ? colorForKey(subject.name) : colors.faint;
                        return (
                          <View key={d} style={styles.dayCell}>
                            {subject ? (
                              <View style={[styles.subjectChip, { backgroundColor: `${tone}1A`, borderColor: `${tone}40` }]}>
                                <Text style={[styles.subjectText, { color: tone }]} numberOfLines={1}>{subject.name}</Text>
                                {teacher && <Text style={styles.teacherText} numberOfLines={1}>{teacher.name}</Text>}
                              </View>
                            ) : (
                              <Text style={styles.dashText}>—</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const CELL_WIDTH = 104;

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  className: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: spacing.md },
  gridCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, overflow: 'hidden' },
  headerRow: { flexDirection: 'row' },
  row: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.divider },
  periodCell: { width: 56, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  periodText: { fontSize: 12.5, fontWeight: '800', color: colors.ink },
  periodTime: { fontSize: 10, color: colors.faint, marginTop: 1 },
  dayHeaderCell: { width: CELL_WIDTH, paddingVertical: 10, alignItems: 'center' },
  dayHeaderText: { fontSize: 11.5, fontWeight: '800', color: colors.muted, letterSpacing: 0.4 },
  dayCell: { width: CELL_WIDTH, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  subjectChip: { borderWidth: 1, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 8, width: '100%', alignItems: 'center' },
  subjectText: { fontSize: 12, fontWeight: '800' },
  teacherText: { fontSize: 10, color: colors.muted, marginTop: 1, fontWeight: '500' },
  dashText: { color: colors.faint },
});
