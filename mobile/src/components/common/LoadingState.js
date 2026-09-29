import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../config/theme';

export default function LoadingState({ message = 'Loading...', inline = false }) {
  return (
    <View style={[styles.container, inline && styles.inline]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  inline: { flex: 0, paddingVertical: spacing.xl },
  message: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
});
