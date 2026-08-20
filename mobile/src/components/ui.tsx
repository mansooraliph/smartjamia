import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, initials as getInitials, radius, shadow, spacing, colorForKey } from '../theme';

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, props.style]}
        placeholderTextColor={colors.faint}
        autoCapitalize={props.autoCapitalize ?? 'none'}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' ? styles.buttonSecondary : styles.buttonPrimary,
        (pressed || disabled) && { opacity: 0.75 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.primary} />
      ) : (
        <Text style={variant === 'primary' ? styles.buttonTextPrimary : styles.buttonTextSecondary}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function ScreenTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <View style={styles.titleWrap}>
      <Text style={styles.screenTitle}>{children}</Text>
      {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

export function Avatar({ name, size = 48, tone }: { name: string; size?: number; tone?: string }) {
  const bg = tone ?? colorForKey(name);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{getInitials(name)}</Text>
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'primary';
}) {
  const map: Record<string, { fg: string; bg: string; border: string }> = {
    neutral: { fg: colors.body, bg: colors.divider, border: colors.border },
    success: { fg: colors.success, bg: colors.successBg, border: colors.successBorder },
    danger: { fg: colors.danger, bg: colors.dangerBg, border: colors.dangerBorder },
    warning: { fg: colors.warning, bg: colors.warningBg, border: colors.warningBorder },
    info: { fg: colors.info, bg: colors.infoBg, border: colors.infoBorder },
    primary: { fg: colors.primary, bg: colors.primaryLight, border: colors.primarySoft },
  };
  const c = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, tone = colors.primary }: { value: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: tone }]} />
    </View>
  );
}

export function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function ShortcutTile({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: string;
  onPress: () => void;
}) {
  const c = tone ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.shortcutTile, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.shortcutIconWrap, { backgroundColor: `${c}1A` }]}>
        <Ionicons name={icon} size={22} color={c} />
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </Pressable>
  );
}

export function ShortcutRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.shortcutRow}>{children}</View>;
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: colors.body, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  button: {
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.primary, ...shadow.raised, shadowColor: colors.primary, shadowOpacity: 0.28 },
  buttonSecondary: { backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primarySoft },
  buttonTextPrimary: { color: '#fff', fontWeight: '800', fontSize: 15.5, letterSpacing: 0.2 },
  buttonTextSecondary: { color: colors.primary, fontWeight: '800', fontSize: 15.5, letterSpacing: 0.2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 13,
    marginBottom: spacing.lg,
  },
  errorText: { color: colors.danger, fontSize: 13.5, fontWeight: '600' },
  titleWrap: { marginBottom: spacing.lg },
  screenTitle: { fontSize: 25, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 },
  screenSubtitle: { fontSize: 13.5, color: colors.muted, marginTop: 3, fontWeight: '500' },
  empty: { padding: 36, alignItems: 'center', gap: 10 },
  emptyText: { color: colors.muted, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11.5, fontWeight: '800', textTransform: 'capitalize' },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.divider, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  statTile: { alignItems: 'center', flex: 1, gap: 2 },
  statValue: { fontSize: 19, fontWeight: '900', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: colors.body, marginBottom: spacing.md, marginTop: spacing.xs, letterSpacing: 0.2, textTransform: 'uppercase' },
  shortcutRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  shortcutTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 16,
    ...shadow.card,
  },
  shortcutIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'center' },
});
