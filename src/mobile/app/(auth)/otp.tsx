import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '@/components/ui';
import { authApi } from '@/services/api/auth.api';
import { getErrorMessage } from '@/services/api/client';
import { useAuthStore } from '@/store/authStore';
import { COLORS, SPACING, FONT_SIZES, OTP_CONFIG } from '@/config/constants';

export default function OtpScreen() {
  const { t } = useTranslation();
  const { sessionId, phone, expiresAt } = useLocalSearchParams<{
    sessionId: string;
    phone: string;
    expiresAt: string;
  }>();
  const { login } = useAuthStore();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-submit when all digits entered
  useEffect(() => {
    const otpValue = otp.join('');
    if (otpValue.length === OTP_CONFIG.LENGTH) {
      handleVerify(otpValue);
    }
  }, [otp]);

  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < OTP_CONFIG.LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpValue?: string) => {
    const code = otpValue || otp.join('');
    if (code.length !== OTP_CONFIG.LENGTH) {
      setError(t('auth.invalidOtp'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.verifyOtp({
        sessionId: currentSessionId || '',
        otp: code,
      });

      await login(response.user, response.token);
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(getErrorMessage(err));
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    try {
      let normalizedPhone = phone || '';
      if (normalizedPhone.startsWith('07') || normalizedPhone.startsWith('01')) {
        normalizedPhone = '254' + normalizedPhone.slice(1);
      }
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+' + normalizedPhone;
      }

      const response = await authApi.register({ phone: normalizedPhone });
      setCurrentSessionId(response.sessionId);
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const formatPhone = (p: string) => {
    if (!p) return '';
    return p.replace(/(\d{4})(\d{3})(\d{3})/, '$1***$3');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
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
          <Text style={styles.title}>Verify your number</Text>
          <Text style={styles.subtitle}>
            {t('auth.otpSent', { phone: formatPhone(phone || '') })}
          </Text>
        </View>

        {/* OTP Input */}
        <Card variant="outlined" style={styles.otpCard}>
          <Text style={styles.otpLabel}>{t('auth.otpLabel')}</Text>
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.otpInput,
                  digit && styles.otpInputFilled,
                  error && styles.otpInputError,
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </Card>

        {/* Resend */}
        <View style={styles.resendContainer}>
          {resendCooldown > 0 ? (
            <Text style={styles.resendText}>
              {t('auth.resendIn', { seconds: resendCooldown })}
            </Text>
          ) : (
            <Pressable onPress={handleResend}>
              <Text style={styles.resendLink}>{t('auth.resendOtp')}</Text>
            </Pressable>
          )}
        </View>

        {/* Verify Button */}
        <View style={styles.actions}>
          <Button
            title={t('auth.verifyOtp')}
            onPress={() => handleVerify()}
            loading={isLoading}
            disabled={otp.join('').length !== OTP_CONFIG.LENGTH}
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
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
  otpCard: {
    marginBottom: SPACING.lg,
  },
  otpLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  otpInputError: {
    borderColor: COLORS.error,
  },
  error: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  resendText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  resendLink: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  actions: {
    marginTop: 'auto',
    paddingVertical: SPACING.lg,
  },
});
