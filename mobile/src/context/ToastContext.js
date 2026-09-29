import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../config/theme';

const ToastContext = createContext(null);

const VARIANTS = {
  success: { bg: colors.success, icon: '✓' },
  error: { bg: colors.danger, icon: '✕' },
  info: { bg: colors.navy, icon: 'ⓘ' },
};

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const hideTimer = useRef(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setToast(null);
    });
  }, [opacity]);

  const show = useCallback(
    (message, variant = 'info', duration = 3000) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ message, variant });
      opacity.setValue(0);
      translateY.setValue(-20);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      hideTimer.current = setTimeout(hide, duration);
    },
    [opacity, translateY, hide]
  );

  const api = useRef({
    success: (msg, duration) => show(msg, 'success', duration),
    error: (msg, duration) => show(msg, 'error', duration),
    info: (msg, duration) => show(msg, 'info', duration),
  }).current;

  const variant = VARIANTS[toast?.variant ?? 'info'];

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <SafeAreaView pointerEvents="none" style={styles.overlay}>
          <Animated.View
            style={[
              styles.toast,
              { backgroundColor: variant.bg, opacity, transform: [{ translateY }] },
            ]}
          >
            <Text style={styles.icon}>{variant.icon}</Text>
            <Text style={styles.message} numberOfLines={3}>
              {toast.message}
            </Text>
          </Animated.View>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  icon: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginRight: spacing.sm,
  },
  message: {
    color: colors.white,
    flexShrink: 1,
    ...typography.bodyMedium,
  },
});
