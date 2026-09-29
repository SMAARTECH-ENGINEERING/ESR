import React from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import Card from '../common/Card';
import EmptyState from '../common/EmptyState';
import { colors, spacing, typography } from '../../config/theme';

const screenWidth = Dimensions.get('window').width;

// slices: [{ name, value, color }]
export default function PieChartCard({ title, slices }) {
  const data = (slices ?? []).filter((s) => s.value > 0);

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {data.length === 0 ? (
        <EmptyState icon="🥧" title="No tanks yet" message="Register a tank to see the status breakdown." />
      ) : (
        <PieChart
          data={data.map((s) => ({
            name: s.name,
            population: s.value,
            color: s.color,
            legendFontColor: colors.textSecondary,
            legendFontSize: 12,
          }))}
          width={screenWidth - spacing.lg * 4}
          height={180}
          chartConfig={{ color: () => colors.text }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="8"
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
});
