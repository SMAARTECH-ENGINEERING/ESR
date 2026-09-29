import React from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import Card from '../common/Card';
import EmptyState from '../common/EmptyState';
import { colors, spacing, typography } from '../../config/theme';

const screenWidth = Dimensions.get('window').width;

function hexToRgba(hex, opacity) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// series: [{ label, value }]
export default function BarChartCard({ title, series, unit, color = colors.navy }) {
  const points = (series ?? []).filter((p) => typeof p.value === 'number' && !Number.isNaN(p.value));

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {points.length === 0 ? (
        <EmptyState icon="📊" title="No data" message="No readings for this period yet." />
      ) : (
        <BarChart
          data={{
            labels: points.map((p) => p.label),
            datasets: [{ data: points.map((p) => p.value) }],
          }}
          width={screenWidth - spacing.lg * 4}
          height={200}
          yAxisSuffix={unit ? ` ${unit}` : ''}
          yAxisLabel=""
          fromZero
          withInnerLines={false}
          chartConfig={{
            backgroundGradientFrom: colors.surface,
            backgroundGradientTo: colors.surface,
            decimalPlaces: 1,
            color: (opacity = 1) => hexToRgba(color, opacity),
            labelColor: () => colors.textMuted,
            propsForBackgroundLines: { stroke: colors.border },
            barPercentage: 0.6,
          }}
          style={styles.chart}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  chart: { borderRadius: 8, marginLeft: -spacing.lg },
});
