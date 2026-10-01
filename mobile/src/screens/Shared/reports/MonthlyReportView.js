import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import dayjs from 'dayjs';
import StatCard from '../../../components/common/StatCard';
import DatePickerField from '../../../components/common/DatePickerField';
import LoadingState from '../../../components/common/LoadingState';
import ErrorState from '../../../components/common/ErrorState';
import BarChartCard from '../../../components/charts/BarChartCard';
import { colors, spacing } from '../../../config/theme';
import { getMonthlyReport } from '../../../api/reports.api';
import { VOLUME_UNIT, formatVolume, toM3 } from '../../../utils/formatters';

export default function MonthlyReportView({ tankId }) {
  const [month, setMonth] = useState(new Date());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMonthlyReport(tankId, month.getFullYear(), month.getMonth() + 1);
      setReport(res.data);
    } catch (err) {
      setError(err?.message || 'Failed to load monthly report');
    } finally {
      setLoading(false);
    }
  }, [tankId, month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View>
      <DatePickerField label="Month" value={month} onChange={setMonth} displayFormat="month" maximumDate={new Date()} />

      {loading ? (
        <LoadingState inline message="Loading report..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <View style={styles.statGrid}>
            <StatCard label="Monthly Total" value={formatVolume(report?.monthlyTotal)} unit={VOLUME_UNIT} accent={colors.primary} />
          </View>
          <BarChartCard
            title="Daily Totals This Month"
            unit={VOLUME_UNIT}
            color={colors.navy}
            series={(report?.dailyBreakdown ?? []).map((d) => ({
              label: dayjs(d.date).format('D'),
              value: toM3(d.dailyTotal) ?? 0,
            }))}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
});
