import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, EmptyState, ErrorBanner, ProgressBar, ScreenTitle } from '../../src/components/ui';
import { ExamResult, PortalApi } from '../../src/lib/portal.api';
import { colors, radius, spacing } from '../../src/theme';

export default function StudentResults() {
  const [exams, setExams] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    setError(null);
    try {
      const res = await PortalApi.results();
      setExams(res.exams);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load results');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      data={exams}
      keyExtractor={(item) => item.examId}
      ListHeaderComponent={
        <>
          <ScreenTitle subtitle="Exam performance and subject-wise marks">Exams & Results</ScreenTitle>
          <ErrorBanner message={error} />
        </>
      }
      renderItem={({ item }) => {
        const isOpen = expanded.has(item.examId);
        return (
          <Card>
            <Pressable onPress={() => toggle(item.examId)}>
              <View style={styles.headRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.examName}>{item.name}</Text>
                  {item.startDate && <Text style={styles.examMeta}>{item.startDate}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.percentage, { color: item.passed ? colors.success : colors.danger }]}>{item.percentage}%</Text>
                  {item.grade && <Badge label={`Grade ${item.grade}`} tone={item.passed ? 'success' : 'danger'} />}
                  {item.rank != null && <Text style={styles.examMeta}>Rank #{item.rank}</Text>}
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.faint} style={{ marginLeft: 8, marginTop: 4 }} />
              </View>
            </Pressable>

            {isOpen && (
              <View style={styles.subjects}>
                {item.subjects.map((s) => (
                  <View key={s.code + s.subject} style={styles.subjectRow}>
                    <View style={styles.subjectHead}>
                      <Text style={styles.subjectName}>{s.subject}</Text>
                      <Text style={[styles.subjectMarks, { color: s.passed ? colors.success : colors.danger }]}>
                        {s.isAbsent ? 'Absent' : `${s.marksObtained}/${s.maxMarks}`}
                      </Text>
                    </View>
                    {!s.isAbsent && (
                      <ProgressBar
                        value={(s.marksObtained! / s.maxMarks) * 100}
                        tone={s.passed ? colors.success : colors.danger}
                      />
                    )}
                  </View>
                ))}
                {item.reportCardUrl && (
                  <Pressable style={styles.pdfBtn} onPress={() => Linking.openURL(item.reportCardUrl!)}>
                    <Ionicons name="download-outline" size={15} color={colors.primary} />
                    <Text style={styles.pdfBtnText}>Download Report Card</Text>
                  </Pressable>
                )}
              </View>
            )}
          </Card>
        );
      }}
      ListEmptyComponent={<EmptyState message="No exam results yet." />}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  examName: { fontSize: 16, fontWeight: '800', color: colors.ink },
  examMeta: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: '500' },
  percentage: { fontSize: 19, fontWeight: '900' },
  subjects: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, gap: 12 },
  subjectRow: { gap: 6 },
  subjectHead: { flexDirection: 'row', justifyContent: 'space-between' },
  subjectName: { fontSize: 13.5, color: colors.body, fontWeight: '600' },
  subjectMarks: { fontSize: 13.5, fontWeight: '800' },
  pdfBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    paddingVertical: 11,
  },
  pdfBtnText: { color: colors.primary, fontWeight: '800', fontSize: 13.5 },
});
