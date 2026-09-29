import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { colors, radius, spacing, typography } from '../../config/theme';
import { getProfile } from '../../api/auth.api';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime, roleLabel } from '../../utils/formatters';

export default function ProfileScreen() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProfile();
      setProfile(res.data);
    } catch (err) {
      setError(err?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) return <LoadingState message="Loading profile..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const initials = (profile?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ScreenContainer edges={['bottom']}>
      <View style={styles.avatarBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{profile?.name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{roleLabel(profile?.role)}</Text>
        </View>
      </View>

      <Card style={styles.infoCard}>
        <InfoRow label="Email" value={profile?.email} />
        <InfoRow label="Role" value={roleLabel(profile?.role)} />
        <InfoRow label="Member Since" value={formatDateTime(profile?.createdAt)} last />
      </Card>

      <Button title="Log Out" variant="danger" onPress={confirmLogout} style={styles.logout} />
    </ScreenContainer>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value ?? '--'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarBlock: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.white, fontSize: 28, fontWeight: '700' },
  name: { ...typography.h2, color: colors.text },
  roleBadge: {
    marginTop: spacing.xs,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  roleText: { ...typography.label, color: colors.primary },
  infoCard: { marginBottom: spacing.xl },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { ...typography.body, color: colors.textSecondary },
  infoValue: { ...typography.bodyMedium, color: colors.text, flexShrink: 1, marginLeft: spacing.lg },
  logout: { marginTop: spacing.sm },
});
