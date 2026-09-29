import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../config/theme';
import EmptyState from '../common/EmptyState';

export default function TankPickerModal({ visible, tanks, selectedId, onSelect, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Tank</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>
        <FlatList
          data={tanks}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              style={[styles.row, item._id === selectedId && styles.rowActive]}
            >
              <View style={styles.rowText}>
                <Text style={styles.tankName}>{item.tankName}</Text>
                <Text style={styles.tankMeta}>
                  {item.deviceId} · {item.location}
                </Text>
              </View>
              {item._id === selectedId ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="💧" title="No tanks available" />}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h3, color: colors.text },
  close: { ...typography.bodyMedium, color: colors.primary },
  listContent: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  rowActive: { backgroundColor: colors.primaryLight },
  rowText: { flex: 1 },
  tankName: { ...typography.bodyMedium, color: colors.text },
  tankMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  check: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
