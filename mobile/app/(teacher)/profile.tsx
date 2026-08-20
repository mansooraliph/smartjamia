import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Avatar, Card, SectionLabel } from '../../src/components/ui';
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

export default function TeacherProfileScreen() {
  const user = useAuthStore((s) => s.teacherUser);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Avatar name={user.name} size={72} tone="rgba(255,255,255,0.24)" />
        <Text style={styles.heroName}>{user.name}</Text>
        <Text style={styles.heroMeta}>{user.email}</Text>
        <View style={styles.roleBadgeWrap}>
          <Text style={styles.roleBadge}>{user.role}</Text>
        </View>
      </View>

      <SectionLabel>STAFF DETAILS</SectionLabel>
      <Card>
        <DetailRow icon="mail-outline" label="Email" value={user.email} />
        <DetailRow icon="briefcase-outline" label="Role" value={user.role} />
        <DetailRow icon="business-outline" label="School" value={user.schoolSlug} />
      </Card>

      <Pressable style={styles.logout} onPress={() => { logout(); router.replace('/login'); }}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.lg },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroName: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 14 },
  heroMeta: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3, fontWeight: '600' },
  roleBadgeWrap: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  roleBadge: { fontSize: 12, fontWeight: '800', color: '#fff', textTransform: 'capitalize' },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  detailIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { flex: 1, fontSize: 13.5, color: colors.muted, fontWeight: '600' },
  detailValue: { fontSize: 13.5, color: colors.ink, fontWeight: '700', textTransform: 'capitalize' },
  logout: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
});
