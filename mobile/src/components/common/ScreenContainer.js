import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../config/theme';

/**
 * Standard screen shell: SafeAreaView + KeyboardAvoidingView, with an
 * optional scrollable body (default) or a fixed-layout body (scroll=false).
 */
export default function ScreenContainer({
  children,
  scroll = true,
  refreshControl,
  contentStyle,
  edges = ['top', 'bottom'],
}) {
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? {
        refreshControl,
        contentContainerStyle: [styles.scrollContent, contentStyle],
        keyboardShouldPersistTaps: 'handled',
        showsVerticalScrollIndicator: false,
      }
    : { style: [styles.flexContent, contentStyle] };

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <Body {...bodyProps}>{children}</Body>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxxl },
  flexContent: { flex: 1, padding: spacing.lg },
});
