import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import dayjs from 'dayjs';
import StatCard from '../../../components/common/StatCard';
import DatePickerField from '../../../components/common/DatePickerField';
import LoadingState from '../../../components/common/LoadingState';
import ErrorState from '../../../components/common/ErrorState';
import EmptyState from '../../../components/common/EmptyState';
import Card from '../../../components/common/Card';
import { colors, spacing, typography } from '../../../config/theme';
import { getDailyReport } from '../../../api/reports.api';
import { formatDateTime, formatNumber } from '../../../utils/formatters';

export default function DailyReportView({ tankId }) {
  const [date, setDate] = useState(new Date());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDailyReport(tankId, dayjs(date).format('YYYY-MM-DD'));
      setReport(res.data?.report ?? null);
    } catch (err) {
      setError(err?.message || 'Failed to load daily report');
    } finally {
      setLoading(false);
    }
  }, [tankId, date]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View>
      <DatePickerField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />

      {loading ? (
        <LoadingState inline message="Loading report..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !report ? (
        <EmptyState icon="📄" title="No data for this day" message="No readings were recorded on the selected date." />
      ) : (
        <>
          <View style={styles.statGrid}>
            <StatCard label="Daily Total" value={formatNumber(report.dailyTotal)} unit="L" accent={colors.primary} />
            <StatCard label="Avg Flow Rate" value={formatNumber(report.avgFlowRate)} unit="L/min" accent={colors.navy} />
          </View>
          <View style={styles.statGrid}>
            <StatCard label="Max Flow Rate" value={formatNumber(report.maxFlowRate)} unit="L/min" accent={colors.success} />
            <StatCard label="Min Flow Rate" value={formatNumber(report.minFlowRate)} unit="L/min" accent={colors.warning} />
          </View>

          <Card style={styles.metaCard}>
            <MetaRow label="Total Readings" value={report.totalReadings} />
            <MetaRow label="First Reading" value={formatDateTime(report.firstReadingAt)} />
            <MetaRow label="Last Reading" value={formatDateTime(report.lastReadingAt)} last />
          </Card>
        </>
      )}
    </View>
  );
}

function MetaRow({ label, value, last }) {
  return (
    <View style={[styles.metaRow, !last && styles.metaRowBorder]}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  metaCard: { marginTop: spacing.sm },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  metaRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  metaLabel: { ...typography.body, color: colors.textSecondary },
  metaValue: { ...typography.bodyMedium, color: colors.text },
});
