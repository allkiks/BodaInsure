import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Card } from '@/components/ui';
import { authApi } from '@/services/api/auth.api';
import { getErrorMessage } from '@/services/api/client';
import { COLORS, SPACING, FONT_SIZES } from '@/config/constants';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validatePhone = (value: string): boolean => {
    // Kenya phone format: 07XX, 01XX, or 254XXX
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length < 9 || cleaned.length > 12) return false;
    if (!/^(07|01|254)/.test(cleaned)) return false;
    return true;
  };

  const formatPhone = (value: string): string => {
    // Keep only digits
    return value.replace(/\D/g, '');
  };

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
    setError('');
  };

  const handleContinue = async () => {
    if (!validatePhone(phone)) {
      setError(t('auth.invalidPhone'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Normalize phone to +254 format
      let normalizedPhone = phone;
      if (phone.startsWith('07') || phone.startsWith('01')) {
        normalizedPhone = '254' + phone.slice(1);
      }
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+' + normalizedPhone;
      }

      const response = await authApi.register({ phone: normalizedPhone });

      // Navigate to OTP screen with session data
      router.push({
        pathname: '/(auth)/otp',
        params: {
          sessionId: response.sessionId,
          phone: phone,
          expiresAt: response.expiresAt,
        },
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <View style={styles.header}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={COLORS.text}
              onPress={() => router.back()}
              style={styles.backButton}
            />
          </View>

          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Enter your phone number</Text>
            <Text style={styles.subtitle}>
              We'll send you a verification code via SMS
            </Text>
          </View>

          {/* Phone Input */}
          <Card variant="outlined" style={styles.inputCard}>
            <Input
              label={t('auth.phoneLabel')}
              placeholder={t('auth.phonePlaceholder')}
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={12}
              error={error}
              hint={t('auth.phoneHint')}
              leftIcon={
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>🇰🇪</Text>
                </View>
              }
            />
          </Card>

          {/* Continue Button */}
          <View style={styles.actions}>
            <Button
              title={t('auth.sendOtp')}
              onPress={handleContinue}
              loading={isLoading}
              disabled={phone.length < 9}
              size="lg"
            />
          </View>

          {/* Terms */}
          <Text style={styles.terms}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
  },
  header: {
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  backButton: {
    padding: SPACING.sm,
    marginLeft: -SPACING.sm,
  },
  titleSection: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
  },
  inputCard: {
    marginBottom: SPACING.lg,
  },
  phonePrefix: {
    paddingRight: SPACING.sm,
  },
  phonePrefixText: {
    fontSize: FONT_SIZES.lg,
  },
  actions: {
    marginTop: 'auto',
    paddingVertical: SPACING.lg,
  },
  terms: {
    textAlign: 'center',
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginBottom: SPACING.lg,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '500',
  },
});
