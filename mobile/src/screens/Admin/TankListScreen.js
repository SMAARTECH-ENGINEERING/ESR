import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Input from '../../components/common/Input';
import TankCard from '../../components/tanks/TankCard';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import { colors, radius, spacing, typography } from '../../config/theme';
import { getTanks } from '../../api/tanks.api';

const FILTERS = [
  { key: undefined, label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'inactive', label: 'Inactive' },
];
const PAGE_LIMIT = 20;

export default function TankListScreen({ navigation }) {
  const [tanks, setTanks] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState(undefined);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (targetPage, targetStatus, mode) => {
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'more') setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await getTanks({ page: targetPage, limit: PAGE_LIMIT, status: targetStatus });
        const list = res.data ?? [];
        setTanks((prev) => (mode === 'more' ? [...prev, ...list] : list));
        setPage(res.pagination?.page ?? targetPage);
        setPages(res.pagination?.pages ?? 1);
      } catch (err) {
        setError(err?.message || 'Failed to load tanks');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    load(1, status, 'initial');
  }, [status, load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => load(1, status, 'refresh'));
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, status]);

  const handleRefresh = () => load(1, status, 'refresh');
  const handleLoadMore = () => {
    if (!loadingMore && page < pages) load(page + 1, status, 'more');
  };

  const visibleTanks = tanks.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.tankName?.toLowerCase().includes(q) ||
      t.deviceId?.toLowerCase().includes(q) ||
      t.location?.toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingState message="Loading tanks..." />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.headerBar}>
        <Input
          placeholder="Search by name, device ID, location"
          value={search}
          onChangeText={setSearch}
          containerStyle={styles.searchInput}
        />
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(item) => item.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setStatus(item.key)}
              style={[styles.filterChip, status === item.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterLabel, status === item.key && styles.filterLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {error ? (
        <ErrorState message={error} onRetry={() => load(1, status, 'initial')} />
      ) : (
        <FlatList
          data={visibleTanks}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TankCard
              tank={item}
              onPress={() => navigation.navigate('TankDetail', { tankId: item._id, tankName: item.tankName })}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={handleLoadMore}
          ListEmptyComponent={
            <EmptyState
              icon="💧"
              title="No tanks found"
              message={search ? 'Try a different search term.' : 'Tap + to register your first tank.'}
            />
          }
          ListFooterComponent={loadingMore ? <LoadingState inline message="" /> : null}
        />
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate('TankForm', { mode: 'create' })}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  headerBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  searchInput: { marginBottom: spacing.sm },
  filterRow: { paddingBottom: spacing.md, gap: spacing.sm },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterLabel: { ...typography.label, color: colors.textSecondary },
  filterLabelActive: { color: colors.white },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: { color: colors.white, fontSize: 28, fontWeight: '600', marginTop: -2 },
});
