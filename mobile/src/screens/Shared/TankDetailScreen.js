import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import Card from '../../components/common/Card';
import LineChartCard from '../../components/charts/LineChartCard';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { colors, spacing, typography } from '../../config/theme';
import { getDashboardTank } from '../../api/dashboard.api';
import { getReadingHistory } from '../../api/iot.api';
import { getSocket } from '../../api/socket';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime, formatNumber, formatTime } from '../../utils/formatters';

const MAX_HISTORY_POINTS = 288; // 24h at 5-min cadence, matches web client

export default function TankDetailScreen({ route, navigation }) {
  const { tankId, tankName } = route.params;
  const { role } = useAuth();
  const [tank, setTank] = useState(null);
  const [latestData, setLatestData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: tankName ?? 'Tank Detail',
      headerRight:
        role === 'admin'
          ? () => (
              <Pressable onPress={() => navigation.navigate('TankForm', { mode: 'edit', tankId, initialTank: tank })}>
                <Text style={styles.editLink}>Edit</Text>
              </Pressable>
            )
          : undefined,
    });
  }, [navigation, tankName, role, tankId, tank]);

  const fetchDetail = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [dashRes, histRes] = await Promise.all([
          getDashboardTank(tankId),
          getReadingHistory(tankId, 24, MAX_HISTORY_POINTS),
        ]);
        setTank(dashRes.data.tank);
        setLatestData(dashRes.data.latestData);
        setHistory(formatHistory(histRes.data ?? []));
      } catch (err) {
        setError(err?.message || 'Failed to load tank data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tankId]
  );

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    const handleConnect = () => {
      setLiveConnected(true);
      socket.emit('subscribe:tank', tankId);
    };
    const handleDisconnect = () => setLiveConnected(false);
    const handleTankData = (payload) => {
      if (payload.tankId !== tankId) return;
      setLatestData({
        flowRate: payload.flowRate,
        totalizer: payload.totalizer,
        waterLevelPercent: payload.waterLevelPercent,
        timestamp: payload.timestamp,
      });
      setHistory((prev) => {
        const point = {
          time: formatTime(payload.timestamp),
          flowRate: Number((payload.flowRate || 0).toFixed(2)),
          totalizer: payload.totalizer || 0,
          waterLevelPercent: payload.waterLevelPercent ?? null,
          timestamp: new Date(payload.timestamp).getTime(),
        };
        return [...prev, point].slice(-MAX_HISTORY_POINTS);
      });
    };
    const handleTankStatus = (payload) => {
      if (payload.tankId !== tankId) return;
      setTank((prev) => (prev ? { ...prev, status: payload.status } : prev));
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('tank:data', handleTankData);
    socket.on('tank:status', handleTankStatus);

    return () => {
      socket.emit('unsubscribe:tank', tankId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('tank:data', handleTankData);
      socket.off('tank:status', handleTankStatus);
      socket.disconnect();
    };
  }, [tankId]);

  if (loading) return <LoadingState message="Loading tank..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDetail} />;
  if (!tank) return <ErrorState title="Tank not found" onRetry={fetchDetail} />;

  return (
    <ScreenContainer
      edges={['bottom']}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchDetail({ silent: true })}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      <Card style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={styles.infoText}>
            <Text style={styles.tankName}>{tank.tankName}</Text>
            <Text style={styles.tankMeta}>
              {tank.deviceId} · {tank.location}
            </Text>
          </View>
          <StatusBadge status={tank.status} />
        </View>
        <View style={styles.liveRow}>
          <View style={[styles.liveDot, { backgroundColor: liveConnected ? colors.success : colors.textMuted }]} />
          <Text style={styles.liveLabel}>{liveConnected ? 'Live' : 'Connecting...'}</Text>
          {latestData?.timestamp ? (
            <Text style={styles.liveTimestamp}>· Updated {formatDateTime(latestData.timestamp)}</Text>
          ) : null}
        </View>
      </Card>

      <View style={styles.statGrid}>
        <StatCard label="Flow Rate" value={formatNumber(latestData?.flowRate)} unit="L/min" accent={colors.primary} />
        <StatCard label="Totalizer" value={formatNumber(latestData?.totalizer)} unit="L" accent={colors.navy} />
      </View>
      <View style={styles.statGridSingle}>
        <StatCard
          label="Water Level"
          value={latestData?.waterLevelPercent != null ? formatNumber(latestData.waterLevelPercent, 0) : '--'}
          unit="%"
          accent={colors.success}
        />
      </View>

      <LineChartCard
        title="Flow Rate (24h)"
        unit="L/min"
        color={colors.primary}
        series={history.map((h) => ({ label: h.time, value: h.flowRate }))}
      />
      <LineChartCard
        title="Totalizer (24h)"
        unit="L"
        color={colors.navy}
        series={history.map((h) => ({ label: h.time, value: h.totalizer }))}
      />
    </ScreenContainer>
  );
}

function formatHistory(records) {
  return (records ?? [])
    .map((r) => ({
      time: formatTime(r.timestamp),
      flowRate: Number((r.flowRate || 0).toFixed(2)),
      totalizer: r.totalizer || 0,
      waterLevelPercent: r.waterLevelPercent ?? null,
      timestamp: new Date(r.timestamp).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

const styles = StyleSheet.create({
  infoCard: { marginBottom: spacing.md },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoText: { flex: 1, marginRight: spacing.sm },
  tankName: { ...typography.h2, color: colors.text },
  tankMeta: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  liveLabel: { ...typography.caption, color: colors.textSecondary },
  liveTimestamp: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.xs },
  statGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statGridSingle: { marginBottom: spacing.lg },
  editLink: { color: colors.primary, ...typography.bodyMedium, marginRight: spacing.md },
});
