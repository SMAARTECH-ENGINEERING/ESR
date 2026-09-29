import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, radius, spacing, typography } from '../../config/theme';

// displayFormat: 'date' (default, e.g. "01 Aug 2026") or 'month' (e.g. "Aug 2026")
export default function DatePickerField({ label, value, onChange, displayFormat = 'date', maximumDate }) {
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) onChange(selectedDate);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.field} onPress={() => setShowPicker(true)}>
        <Text style={styles.value}>{formatValue(value, displayFormat)}</Text>
        <Text style={styles.icon}>📅</Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleChange}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
}

function formatValue(value, displayFormat) {
  if (displayFormat === 'month') {
    return value.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  return value.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  value: { ...typography.body, color: colors.text },
  icon: { fontSize: 16 },
});
