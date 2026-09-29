import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../common/Card';
import StatusBadge from '../common/StatusBadge';
import { colors, spacing, typography } from '../../config/theme';
import { formatNumber, relativeFromNow } from '../../utils/formatters';

// tank: { _id, tankName, deviceId, location, status, lastSeen, latestData? }
export default function TankCard({ tank, onPress }) {
  const latest = tank.latestData;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {tank.tankName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {tank.deviceId} · {tank.location}
          </Text>
        </View>
        <StatusBadge status={tank.status} size="sm" />
      </View>

      <View style={styles.metrics}>
        <Metric label="Flow Rate" value={formatNumber(latest?.flowRate)} unit="L/min" />
        <Metric label="Totalizer" value={formatNumber(latest?.totalizer)} unit="L" />
        <Metric
          label="Level"
          value={latest?.waterLevelPercent != null ? formatNumber(latest.waterLevelPercent, 0) : '--'}
          unit="%"
        />
      </View>

      <Text style={styles.lastSeen}>
        {tank.lastSeen ? `Last seen ${relativeFromNow(tank.lastSeen)}` : 'No data yet'}
      </Text>
    </Card>
  );
}

function Metric({ label, value, unit }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
        <Text style={styles.metricUnit}> {unit}</Text>
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerText: { flex: 1, marginRight: spacing.sm },
  name: { ...typography.h3, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metric: { flex: 1 },
  metricValue: { ...typography.bodyMedium, color: colors.text },
  metricUnit: { ...typography.caption, color: colors.textMuted },
  metricLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  lastSeen: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
