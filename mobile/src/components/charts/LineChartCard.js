import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
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

// series: [{ label, value }]  — value must be numeric
export default function LineChartCard({ title, series, unit, color = colors.primary }) {
  const points = (series ?? []).filter((p) => typeof p.value === 'number' && !Number.isNaN(p.value));

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {points.length < 2 ? (
        <EmptyState
          icon="📈"
          title="Not enough data"
          message="Live readings will appear here once the sensor reports more data."
        />
      ) : (
        <LineChart
          data={{
            labels: points.map((p) => p.label),
            datasets: [{ data: points.map((p) => p.value) }],
          }}
          width={screenWidth - spacing.lg * 4}
          height={200}
          yAxisSuffix={unit ? ` ${unit}` : ''}
          withInnerLines={false}
          withOuterLines={false}
          bezier
          chartConfig={{
            backgroundGradientFrom: colors.surface,
            backgroundGradientTo: colors.surface,
            decimalPlaces: 1,
            color: (opacity = 1) => hexToRgba(color, opacity),
            labelColor: () => colors.textMuted,
            propsForDots: { r: '2.5', strokeWidth: '0', fill: color },
            propsForBackgroundLines: { stroke: colors.border },
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
