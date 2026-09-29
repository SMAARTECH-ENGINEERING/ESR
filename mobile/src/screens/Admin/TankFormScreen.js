import React, { useLayoutEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, radius, spacing, typography } from '../../config/theme';
import { createTank, updateTank, deleteTank } from '../../api/tanks.api';
import { useToast } from '../../context/ToastContext';

const STATUS_OPTIONS = ['inactive', 'online', 'offline'];

export default function TankFormScreen({ route, navigation }) {
  const { mode, tankId, initialTank } = route.params ?? {};
  const isEdit = mode === 'edit';
  const toast = useToast();

  const [tankName, setTankName] = useState(initialTank?.tankName ?? '');
  const [deviceId, setDeviceId] = useState(initialTank?.deviceId ?? '');
  const [location, setLocation] = useState(initialTank?.location ?? '');
  const [status, setStatus] = useState(initialTank?.status ?? 'inactive');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Tank' : 'New Tank' });
  }, [navigation, isEdit]);

  const validate = () => {
    const e = {};
    if (tankName.trim().length < 2) e.tankName = 'Tank name must be at least 2 characters';
    if (deviceId.trim().length < 3) e.deviceId = 'Device ID must be at least 3 characters';
    if (!location.trim()) e.location = 'Location is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { tankName: tankName.trim(), deviceId: deviceId.trim(), location: location.trim(), status };
      if (isEdit) {
        await updateTank(tankId, payload);
        toast.success('Tank updated successfully');
      } else {
        await createTank(payload);
        toast.success('Tank created successfully');
      }
      navigation.goBack();
    } catch (err) {
      if (err?.errors?.length) {
        toast.error(err.errors[0]);
      } else {
        toast.error(err?.message || 'Failed to save tank');
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete Tank', `Are you sure you want to delete "${tankName}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDelete },
    ]);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTank(tankId);
      toast.success('Tank deleted');
      navigation.goBack();
    } catch (err) {
      toast.error(err?.message || 'Failed to delete tank');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenContainer edges={['bottom']}>
      <Input
        label="Tank Name"
        placeholder="e.g. North Sector ESR"
        value={tankName}
        onChangeText={setTankName}
        error={errors.tankName}
      />
      <Input
        label="Device ID"
        placeholder="e.g. ESR-DEV-001"
        autoCapitalize="characters"
        value={deviceId}
        onChangeText={setDeviceId}
        error={errors.deviceId}
      />
      <Input
        label="Location"
        placeholder="e.g. Sector 4, Main Road"
        value={location}
        onChangeText={setLocation}
        error={errors.location}
      />

      <Text style={styles.label}>Status</Text>
      <View style={styles.statusRow}>
        {STATUS_OPTIONS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setStatus(option)}
            style={[styles.statusChip, status === option && styles.statusChipActive]}
          >
            <Text style={[styles.statusLabel, status === option && styles.statusLabelActive]}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button title={isEdit ? 'Save Changes' : 'Create Tank'} onPress={handleSave} loading={saving} style={styles.save} />

      {isEdit ? (
        <Button title="Delete Tank" variant="danger" onPress={confirmDelete} loading={deleting} style={styles.delete} />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statusChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  statusLabel: { ...typography.label, color: colors.textSecondary },
  statusLabelActive: { color: colors.primary },
  save: { marginTop: spacing.sm },
  delete: { marginTop: spacing.md },
});
