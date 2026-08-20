import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, ErrorBanner, ProgressBar, ScreenTitle, StatTile } from '../../src/components/ui';
import { AttendanceSummary, PortalApi } from '../../src/lib/portal.api';
import { colors, radius, spacing, statusColors } from '../../src/theme';

const STATUS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  present: 'checkmark-circle',
  absent: 'close-circle',
  late: 'time',
  half_day: 'contrast',
  holiday: 'sunny',
};

export default function StudentAttendance() {
  const [data, setData] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setData(await PortalApi.attendance());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance');
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

  const pct = data?.summary.percentage ?? 0;
  const pctTone = pct >= 90 ? colors.success : pct >= 75 ? colors.warning : colors.danger;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      data={data?.recent ?? []}
      keyExtractor={(item, idx) => `${item.date}-${idx}`}
      ListHeaderComponent={
        <>
          <ScreenTitle subtitle="Your attendance record this year">Attendance</ScreenTitle>
          <ErrorBanner message={error} />
          {data && (
            <Card>
              <Text style={[styles.percentage, { color: pctTone }]}>
                {data.summary.percentage != null ? `${data.summary.percentage}%` : '—'}
              </Text>
              <Text style={styles.percentageLabel}>Overall attendance · {data.summary.workingDays} working days</Text>
              <View style={{ marginTop: 14, marginBottom: 18 }}>
                <ProgressBar value={pct} tone={pctTone} />
              </View>
              <View style={styles.chipsRow}>
                <StatTile label="Present" value={data.summary.present} tone={statusColors.present.fg} />
                <StatTile label="Absent" value={data.summary.absent} tone={statusColors.absent.fg} />
                <StatTile label="Late" value={data.summary.late} tone={statusColors.late.fg} />
                <StatTile label="Half Day" value={data.summary.half_day} tone={statusColors.half_day.fg} />
              </View>
            </Card>
          )}
          <Text style={styles.sectionHeading}>RECENT</Text>
        </>
      }
      renderItem={({ item }) => {
        const c = statusColors[item.status] ?? statusColors.holiday;
        return (
          <View style={styles.row}>
            <View style={[styles.statusIconWrap, { backgroundColor: c.bg }]}>
              <Ionicons name={STATUS_ICON[item.status] ?? 'ellipse'} size={16} color={c.fg} />
            </View>
            <Text style={styles.rowDate}>{item.date}</Text>
            <View style={[styles.statusPill, { backgroundColor: c.bg, borderColor: c.border }]}>
              <Text style={[styles.rowStatus, { color: c.fg }]}>{item.status.replace('_', ' ')}</Text>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={<EmptyState message="No attendance records yet." />}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  percentage: { fontSize: 40, fontWeight: '900', textAlign: 'center', letterSpacing: -1 },
  percentageLabel: { fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 4, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionHeading: { fontSize: 12.5, fontWeight: '800', color: colors.muted, marginBottom: 10, marginTop: spacing.sm, letterSpacing: 0.6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  statusIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowDate: { flex: 1, fontSize: 14, color: colors.ink, fontWeight: '600' },
  statusPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  rowStatus: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
});
