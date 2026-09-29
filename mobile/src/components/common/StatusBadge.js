import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../config/theme';

// Tank.status enum: online | offline | inactive (server/src/modules/tanks/tank.model.js)
const STATUS_MAP = {
  online: { color: colors.online, bg: colors.successLight, label: 'Online' },
  offline: { color: colors.offline, bg: colors.dangerLight, label: 'Offline' },
  inactive: { color: colors.inactive, bg: colors.background, label: 'Inactive' },
};

export default function StatusBadge({ status, size = 'md' }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.inactive;
  const small = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: s.bg }, small && styles.badgeSmall]}>
      <View style={[styles.dot, { backgroundColor: s.color }]} />
      <Text style={[styles.label, { color: s.color }, small && styles.labelSmall]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  badgeSmall: { paddingVertical: 3, paddingHorizontal: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: spacing.xs },
  label: { ...typography.label },
  labelSmall: { fontSize: 11 },
});
