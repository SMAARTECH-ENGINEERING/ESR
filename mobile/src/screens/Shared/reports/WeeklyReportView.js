import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import dayjs from 'dayjs';
import StatCard from '../../../components/common/StatCard';
import DatePickerField from '../../../components/common/DatePickerField';
import LoadingState from '../../../components/common/LoadingState';
import ErrorState from '../../../components/common/ErrorState';
import BarChartCard from '../../../components/charts/BarChartCard';
import { colors, spacing } from '../../../config/theme';
import { getWeeklyReport } from '../../../api/reports.api';
import { formatNumber } from '../../../utils/formatters';

export default function WeeklyReportView({ tankId }) {
  const [startDate, setStartDate] = useState(dayjs().startOf('week').toDate());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWeeklyReport(tankId, dayjs(startDate).format('YYYY-MM-DD'));
      setReport(res.data);
    } catch (err) {
      setError(err?.message || 'Failed to load weekly report');
    } finally {
      setLoading(false);
    }
  }, [tankId, startDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View>
      <DatePickerField label="Week Starting" value={startDate} onChange={setStartDate} maximumDate={new Date()} />

      {loading ? (
        <LoadingState inline message="Loading report..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <View style={styles.statGrid}>
            <StatCard label="Weekly Total" value={formatNumber(report?.weeklyTotal)} unit="L" accent={colors.primary} />
          </View>
          <BarChartCard
            title="Daily Totals This Week"
            unit="L"
            color={colors.navy}
            series={(report?.dailyBreakdown ?? []).map((d) => ({
              label: dayjs(d.date).format('ddd'),
              value: d.dailyTotal ?? 0,
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
