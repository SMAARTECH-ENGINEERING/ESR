import React, { useCallback, useEffect } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import SectionHeader from '../../components/common/SectionHeader';
import StatCard from '../../components/common/StatCard';
import TankCard from '../../components/tanks/TankCard';
import PieChartCard from '../../components/charts/PieChartCard';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing } from '../../config/theme';
import { useApi } from '../../hooks/useApi';
import { getDashboardOverview } from '../../api/dashboard.api';
import { VOLUME_UNIT, formatVolume } from '../../utils/formatters';

const AUTO_REFRESH_MS = 60000;

export default function DashboardScreen({ navigation }) {
  const fetcher = useCallback(() => getDashboardOverview(), []);
  const { data, loading, refreshing, error, refetch, refresh } = useApi(fetcher, [fetcher]);

  useEffect(() => {
    const interval = setInterval(() => refresh(), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) return <LoadingState message="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const summary = data?.data?.summary ?? { totalTanks: 0, online: 0, offline: 0, inactive: 0 };
  const tanks = data?.data?.tanks ?? [];
  const totalTotalizer = tanks.reduce((sum, t) => sum + (t.latestData?.totalizer ?? 0), 0);

  return (
    <ScreenContainer
      edges={['bottom']}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />
      }
    >
      <SectionHeader title="ESR Overview" />
      <View style={styles.statGrid}>
        <StatCard label="Total Tanks" value={summary.totalTanks} accent={colors.primary} />
        <StatCard label="Online" value={summary.online} accent={colors.online} />
      </View>
      <View style={styles.statGrid}>
        <StatCard label="Offline" value={summary.offline} accent={colors.danger} />
        <StatCard label="Inactive" value={summary.inactive} accent={colors.inactive} />
      </View>
      <View style={styles.statGridSingle}>
        <StatCard label="Total Totalizer" value={formatVolume(totalTotalizer)} unit={VOLUME_UNIT} accent={colors.navy} />
      </View>

      <PieChartCard
        title="ESR Status Breakdown"
        slices={[
          { name: 'Online', value: summary.online, color: colors.online },
          { name: 'Offline', value: summary.offline, color: colors.danger },
          { name: 'Inactive', value: summary.inactive, color: colors.inactive },
        ]}
      />

      <SectionHeader title="Tanks" style={styles.tanksHeader} />
      {tanks.length === 0 ? (
        <EmptyState icon="💧" title="No tanks registered" message="Add a tank from the Tanks tab to get started." />
      ) : (
        tanks.map((tank) => (
          <TankCard
            key={tank._id}
            tank={tank}
            onPress={() => navigation.navigate('TankDetail', { tankId: tank._id, tankName: tank.tankName })}
          />
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statGridSingle: { marginBottom: spacing.lg },
  tanksHeader: { marginTop: spacing.sm },
});
