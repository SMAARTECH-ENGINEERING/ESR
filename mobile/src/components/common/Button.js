import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../../config/theme';

const VARIANTS = {
  primary: { bg: colors.primary, bgPressed: colors.primaryDark, text: colors.white, border: 'transparent' },
  danger: { bg: colors.danger, bgPressed: colors.dangerDark, text: colors.white, border: 'transparent' },
  outline: { bg: 'transparent', bgPressed: colors.primaryLight, text: colors.primary, border: colors.primary },
  ghost: { bg: 'transparent', bgPressed: colors.background, text: colors.textSecondary, border: 'transparent' },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  fullWidth = true,
}) {
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        { backgroundColor: pressed && !isDisabled ? v.bgPressed : v.bg, borderColor: v.border },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: v.text }, icon && styles.textWithIcon]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  text: { ...typography.bodyMedium },
  textWithIcon: { marginLeft: spacing.sm },
});
