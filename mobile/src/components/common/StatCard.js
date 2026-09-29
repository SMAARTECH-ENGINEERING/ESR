import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../config/theme';
import Card from './Card';

export default function StatCard({ label, value, unit, accent = colors.primary, style }) {
  return (
    <Card style={[styles.card, style]}>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 140, paddingTop: spacing.md, overflow: 'hidden' },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  value: { ...typography.h2, color: colors.text },
  unit: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.xs, marginBottom: 3 },
});
