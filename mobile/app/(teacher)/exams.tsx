import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Badge, EmptyState, ErrorBanner, ScreenTitle } from '../../src/components/ui';
import { ExamRow, TeacherApi } from '../../src/lib/teacher.api';
import { colors, radius, spacing } from '../../src/theme';

const STATUS_TONE: Record<string, 'success' | 'primary' | 'neutral'> = {
  completed: 'success',
  ongoing: 'primary',
  scheduled: 'neutral',
  draft: 'neutral',
};

export default function TeacherExams() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setExams(await TeacherApi.exams());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load exams');
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

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      data={exams}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <ScreenTitle subtitle="Tap an exam to enter marks">Exams</ScreenTitle>
          <ErrorBanner message={error} />
        </>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/exam-marks/${item.id}`)}>
          <View style={styles.iconWrap}>
            <Ionicons name="document-text" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.examName}>{item.name}</Text>
            <Text style={styles.examMeta}>
              {item.examType.replace('_', ' ')} · {item.startDate} → {item.endDate}
            </Text>
          </View>
          <Badge label={item.status} tone={STATUS_TONE[item.status] ?? 'neutral'} />
        </Pressable>
      )}
      ListEmptyComponent={<EmptyState message="No exams found." />}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  iconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  examName: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  examMeta: { fontSize: 12, color: colors.muted, marginTop: 2, textTransform: 'capitalize', fontWeight: '500' },
});
