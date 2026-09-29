import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import TankPickerModal from '../../components/tanks/TankPickerModal';
import DailyReportView from './reports/DailyReportView';
import WeeklyReportView from './reports/WeeklyReportView';
import MonthlyReportView from './reports/MonthlyReportView';
import { colors, radius, spacing, typography } from '../../config/theme';
import { getDashboardOverview } from '../../api/dashboard.api';

const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

export default function ReportsScreen() {
  const [tanks, setTanks] = useState([]);
  const [selectedTank, setSelectedTank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [period, setPeriod] = useState('daily');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboardOverview();
      const list = res.data?.tanks ?? [];
      setTanks(list);
      setSelectedTank((prev) => prev ?? list[0] ?? null);
    } catch (err) {
      setError(err?.message || 'Failed to load tanks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState message="Loading reports..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!selectedTank) {
    return <EmptyState icon="📊" title="No tanks available" message="Reports will appear once tanks are registered." />;
  }

  return (
    <ScreenContainer edges={['bottom']}>
      <Pressable style={styles.tankSelector} onPress={() => setPickerVisible(true)}>
        <View>
          <Text style={styles.tankLabel}>Tank</Text>
          <Text style={styles.tankName}>{selectedTank.tankName}</Text>
        </View>
        <Text style={styles.changeLink}>Change</Text>
      </Pressable>

      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPeriod(p.key)}
            style={[styles.periodChip, period === p.key && styles.periodChipActive]}
          >
            <Text style={[styles.periodLabel, period === p.key && styles.periodLabelActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {period === 'daily' && <DailyReportView tankId={selectedTank._id} />}
      {period === 'weekly' && <WeeklyReportView tankId={selectedTank._id} />}
      {period === 'monthly' && <MonthlyReportView tankId={selectedTank._id} />}

      <TankPickerModal
        visible={pickerVisible}
        tanks={tanks}
        selectedId={selectedTank._id}
        onSelect={setSelectedTank}
        onClose={() => setPickerVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tankSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  tankLabel: { ...typography.caption, color: colors.textMuted },
  tankName: { ...typography.h3, color: colors.text, marginTop: 2 },
  changeLink: { ...typography.bodyMedium, color: colors.primary },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  periodChip: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  periodChipActive: { backgroundColor: colors.surface, ...cardShadow() },
  periodLabel: { ...typography.bodyMedium, color: colors.textSecondary },
  periodLabelActive: { color: colors.primary },
});

function cardShadow() {
  return {
    shadowColor: '#0B1130',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  };
}
