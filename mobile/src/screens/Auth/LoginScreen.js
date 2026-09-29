import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, radius, spacing, typography } from '../../config/theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function LoginScreen() {
  const { login, isSigningIn } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!email.trim()) errors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email';
    if (!password) errors.password = 'Password is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      await login(email.trim(), password);
    } catch (err) {
      toast.error(err?.message || 'Invalid email or password');
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <LinearGradient colors={[colors.navy, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <SafeAreaView edges={['top']} style={styles.heroSafeArea}>
              <View style={styles.logoCard}>
                <Image source={require('../../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
              </View>
              <Text style={styles.appTitle}>ESR Tank Management</Text>
              <View style={styles.accentBar} />
              <Text style={styles.appSubtitle}>Smart Elevated Reservoir Monitoring</Text>
            </SafeAreaView>
          </LinearGradient>

          <View style={styles.body}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Welcome back</Text>
              <Text style={styles.formSubtitle}>Sign in to continue to your dashboard</Text>

              <Input
                label="Email"
                placeholder="you@company.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                error={fieldErrors.email}
                returnKeyType="next"
                leftIcon={<Ionicons name="mail-outline" size={19} color={colors.textMuted} />}
              />
              <Input
                label="Password"
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                error={fieldErrors.password}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                leftIcon={<Ionicons name="lock-closed-outline" size={19} color={colors.textMuted} />}
                rightElement={
                  <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={10}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={19}
                      color={colors.textMuted}
                    />
                  </Pressable>
                }
              />
              <Button title="Log In" onPress={handleLogin} loading={isSigningIn} style={styles.submit} />
            </View>

            <View style={styles.footerRow}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
              <Text style={styles.footer}>SEPL · Secure IoT Water Monitoring</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, backgroundColor: colors.background },
  hero: {
    paddingBottom: spacing.xxxl + spacing.xl,
  },
  heroSafeArea: { alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.xl },
  logoCard: {
    width: 100,
    height: 100,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: { width: 72, height: 72 },
  appTitle: {
    ...typography.h1,
    color: colors.white,
    textAlign: 'center',
  },
  accentBar: {
    width: 44,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.danger,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  appSubtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  body: { flexGrow: 1, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  formCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl * 1.3,
    borderTopRightRadius: radius.xl * 1.3,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    padding: spacing.xl,
    marginTop: -spacing.xxxl,
    shadowColor: '#0B1130',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  formTitle: { ...typography.h2, color: colors.text },
  formSubtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  submit: { marginTop: spacing.sm },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  footer: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
