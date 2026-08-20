import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Badge, EmptyState, ErrorBanner, ScreenTitle } from '../../src/components/ui';
import { ClassRow, ClassSection, TeacherApi } from '../../src/lib/teacher.api';
import { useAuthStore } from '../../src/stores/auth.store';
import { colorForKey, colors, radius, spacing } from '../../src/theme';

/** No "my sections only" endpoint exists — /school/sections is open to all roles, filtered client-side by classTeacherId to flag which ones this teacher owns. Every section is still shown (a subject teacher may need a section they don't own). */
export default function TeacherSections() {
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const myId = useAuthStore((s) => s.teacherUser?.id);

  async function load() {
    setError(null);
    try {
      const [s, c] = await Promise.all([TeacherApi.sections(), TeacherApi.classes()]);
      setSections(s);
      setClasses(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sections');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

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
      data={sections}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <ScreenTitle subtitle="Classes and sections you teach">Sections</ScreenTitle>
          <ErrorBanner message={error} />
        </>
      }
      renderItem={({ item }) => {
        const isMine = !!myId && item.classTeacherId === myId;
        const className = classNameById.get(item.classId) ?? 'Class';
        const tone = colorForKey(className);
        return (
          <Pressable style={styles.row} onPress={() => router.push(`/section/${item.id}`)}>
            <View style={[styles.iconWrap, { backgroundColor: `${tone}1A` }]}>
              <Ionicons name="people" size={18} color={tone} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionName}>
                {className} — {item.name}
              </Text>
              {isMine && <Badge label="Class Teacher" tone="primary" />}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </Pressable>
        );
      }}
      ListEmptyComponent={<EmptyState message="No sections found." />}
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
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionName: { fontSize: 14.5, fontWeight: '700', color: colors.ink, marginBottom: 5 },
});
