import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Avatar, Badge, Card, ErrorBanner, SectionLabel } from '../../src/components/ui';
import { PortalApi, StudentProfile } from '../../src/lib/portal.api';
import { useAuthStore } from '../../src/stores/auth.store';
import { colors, radius, spacing } from '../../src/theme';

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function StudentProfileScreen() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logout = useAuthStore((s) => s.logout);

  async function load() {
    setError(null);
    try {
      const me = await PortalApi.me();
      setProfile(me.student);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
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
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <ErrorBanner message={error} />

      {profile && (
        <>
          <View style={styles.heroCard}>
            <Avatar name={profile.studentName} size={72} tone="rgba(255,255,255,0.24)" />
            <Text style={styles.heroName}>{profile.studentName}</Text>
            <Text style={styles.heroMeta}>Admission No. {profile.admissionNumber}</Text>
            {profile.className && (
              <View style={styles.heroClassPill}>
                <Text style={styles.heroClassText}>
                  {profile.className}
                  {profile.sectionName ? ` — ${profile.sectionName}` : ''}
                </Text>
              </View>
            )}
          </View>

          <SectionLabel>STUDENT DETAILS</SectionLabel>
          <Card>
            {profile.rollNumber && <DetailRow icon="bookmark-outline" label="Roll Number" value={String(profile.rollNumber)} />}
            <DetailRow icon="person-outline" label="Gender" value={profile.gender ?? '—'} />
            {profile.bloodGroup && <DetailRow icon="water-outline" label="Blood Group" value={profile.bloodGroup} />}
            {profile.dateOfBirth && <DetailRow icon="calendar-outline" label="Date of Birth" value={profile.dateOfBirth} />}
            <View style={styles.statusRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Badge label={profile.status} tone={profile.status === 'active' ? 'success' : 'neutral'} />
            </View>
          </Card>

          <Pressable style={styles.logout} onPress={() => { logout(); router.replace('/login'); }}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroName: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 14 },
  heroMeta: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3, fontWeight: '600' },
  heroClassPill: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  heroClassText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  detailIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { flex: 1, fontSize: 13.5, color: colors.muted, fontWeight: '600' },
  detailValue: { fontSize: 13.5, color: colors.ink, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9 },
  logout: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
});
