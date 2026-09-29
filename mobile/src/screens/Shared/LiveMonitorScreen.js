import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TankCard from '../../components/tanks/TankCard';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, typography } from '../../config/theme';
import { getDashboardOverview } from '../../api/dashboard.api';

const AUTO_REFRESH_MS = 30000;

export default function LiveMonitorScreen({ navigation }) {
  const [tanks, setTanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getDashboardOverview();
      setTanks(res.data?.tanks ?? []);
    } catch (err) {
      setError(err?.message || 'Failed to load live data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load({ silent: true }), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <LoadingState message="Loading live monitor..." />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Monitor</Text>
        <Text style={styles.subtitle}>Auto-refreshes every 30s</Text>
      </View>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={tanks}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TankCard
              tank={item}
              onPress={() => navigation.navigate('TankDetail', { tankId: item._id, tankName: item.tankName })}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load({ silent: true })} colors={[colors.primary]} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState icon="💧" title="No tanks yet" message="Tanks registered by an admin will appear here." />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
});
