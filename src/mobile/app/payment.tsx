import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge, ProgressBar } from '@/components/ui';
import { userApi } from '@/services/api/user.api';
import { paymentApi } from '@/services/api/payment.api';
import { COLORS, SPACING, FONT_SIZES, PAYMENT_AMOUNTS } from '@/config/constants';
import type { PaymentType } from '@/types';

type PaymentStep = 'select' | 'confirm' | 'processing' | 'success' | 'failed';

interface PaymentOption {
  type: PaymentType;
  amount: number;
  label: string;
  description: string;
  icon: string;
  days?: number;
}

export default function PaymentScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<PaymentStep>('select');
  const [selectedOption, setSelectedOption] = useState<PaymentOption | null>(null);
  const [selectedDays, setSelectedDays] = useState(1);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: userApi.getWallet,
  });

  const { data: progress, refetch: refetchProgress } = useQuery({
    queryKey: ['paymentProgress'],
    queryFn: userApi.getPaymentProgress,
  });

  const paymentMutation = useMutation({
    mutationFn: (data: { type: PaymentType; amount: number; days?: number }) =>
      paymentApi.initiatePayment(data.type, data.amount, data.days),
    onSuccess: (response) => {
      setCheckoutRequestId(response.checkoutRequestId);
      setStep('processing');
      startPolling(response.checkoutRequestId);
    },
    onError: (error: any) => {
      Alert.alert(
        t('common.error'),
        error.response?.data?.message || t('payment.initiateError')
      );
    },
  });

  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString()}`;

  const paymentOptions: PaymentOption[] = [
    {
      type: 'deposit',
      amount: PAYMENT_AMOUNTS.INITIAL_DEPOSIT,
      label: t('payment.initialDeposit'),
      description: t('payment.depositDesc'),
      icon: 'wallet',
    },
    {
      type: 'daily',
      amount: PAYMENT_AMOUNTS.DAILY_PAYMENT,
      label: t('payment.dailyPayment'),
      description: t('payment.dailyDesc'),
      icon: 'calendar',
      days: 1,
    },
    {
      type: 'bulk',
      amount: PAYMENT_AMOUNTS.DAILY_PAYMENT * 7,
      label: t('payment.weeklyPayment'),
      description: t('payment.weeklyDesc'),
      icon: 'calendar-outline',
      days: 7,
    },
  ];

  const availableOptions = progress?.depositPaid
    ? paymentOptions.filter((o) => o.type !== 'deposit')
    : [paymentOptions[0]];

  const startPolling = async (requestId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes at 2 second intervals

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setStep('failed');
        return;
      }

      try {
        const status = await paymentApi.getPaymentStatus(requestId);

        if (status.status === 'completed') {
          await queryClient.invalidateQueries({ queryKey: ['wallet'] });
          await queryClient.invalidateQueries({ queryKey: ['paymentProgress'] });
          await queryClient.invalidateQueries({ queryKey: ['payments'] });
          await refetchProgress();
          setStep('success');
        } else if (status.status === 'failed' || status.status === 'cancelled') {
          setStep('failed');
        } else {
          attempts++;
          setTimeout(poll, 2000);
        }
      } catch {
        attempts++;
        setTimeout(poll, 2000);
      }
    };

    poll();
  };

  const handleSelectOption = (option: PaymentOption) => {
    setSelectedOption(option);
    if (option.days) {
      setSelectedDays(option.days);
    }
    setStep('confirm');
  };

  const handleChangeDays = (days: number) => {
    setSelectedDays(days);
  };

  const getTotalAmount = () => {
    if (!selectedOption) return 0;
    if (selectedOption.type === 'deposit') return selectedOption.amount;
    return PAYMENT_AMOUNTS.DAILY_PAYMENT * selectedDays;
  };

  const handleConfirmPayment = () => {
    if (!selectedOption) return;

    paymentMutation.mutate({
      type: selectedOption.type === 'bulk' ? 'daily' : selectedOption.type,
      amount: getTotalAmount(),
      days: selectedOption.type !== 'deposit' ? selectedDays : undefined,
    });
  };

  const handleRetry = () => {
    setStep('select');
    setSelectedOption(null);
    setCheckoutRequestId(null);
  };

  const handleDone = () => {
    router.replace('/(tabs)/wallet');
  };

  const daysRemaining = PAYMENT_AMOUNTS.DAYS_REQUIRED - (progress?.daysCompleted ?? 0);

  // Select payment type
  if (step === 'select') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('payment.title')}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Progress Card */}
          <Card style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>{t('wallet.progress')}</Text>
              <Badge
                label={progress?.eligibleForPolicy2 ? t('policy.eligible') : `${daysRemaining} ${t('wallet.daysLeft')}`}
                variant={progress?.eligibleForPolicy2 ? 'success' : 'info'}
                size="sm"
              />
            </View>
            <ProgressBar
              progress={((progress?.daysCompleted ?? 0) / PAYMENT_AMOUNTS.DAYS_REQUIRED) * 100}
              height={10}
              showPercentage
            />
            <View style={styles.progressStats}>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{progress?.daysCompleted ?? 0}</Text>
                <Text style={styles.progressStatLabel}>{t('payment.daysPaid')}</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{daysRemaining}</Text>
                <Text style={styles.progressStatLabel}>{t('payment.daysRemaining')}</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{formatCurrency(progress?.amountPaid ?? 0)}</Text>
                <Text style={styles.progressStatLabel}>{t('payment.totalPaid')}</Text>
              </View>
            </View>
          </Card>

          {/* Payment Options */}
          <Text style={styles.sectionTitle}>{t('payment.selectPayment')}</Text>

          <View style={styles.optionsList}>
            {availableOptions.map((option) => (
              <Card
                key={option.type}
                variant="outlined"
                style={styles.optionCard}
                onPress={() => handleSelectOption(option)}
              >
                <View style={styles.optionContent}>
                  <View style={[styles.optionIcon, option.type === 'deposit' && styles.depositIcon]}>
                    <Ionicons
                      name={option.icon as any}
                      size={28}
                      color={option.type === 'deposit' ? '#fff' : COLORS.primary}
                    />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionDesc}>{option.description}</Text>
                  </View>
                  <View style={styles.optionAmount}>
                    <Text style={styles.amountText}>{formatCurrency(option.amount)}</Text>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
                  </View>
                </View>
              </Card>
            ))}
          </View>

          {/* Custom Days Option */}
          {progress?.depositPaid && (
            <Card variant="filled" style={styles.customCard}>
              <Text style={styles.customTitle}>{t('payment.customDays')}</Text>
              <Text style={styles.customDesc}>{t('payment.customDaysDesc')}</Text>

              <View style={styles.daysSelector}>
                {[1, 3, 5, 7, 14, 30].map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[styles.dayButton, selectedDays === days && styles.dayButtonSelected]}
                    onPress={() => handleChangeDays(days)}
                  >
                    <Text style={[styles.dayButtonText, selectedDays === days && styles.dayButtonTextSelected]}>
                      {days}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.customTotal}>
                <Text style={styles.customTotalLabel}>
                  {t('payment.total')}: {selectedDays} {selectedDays === 1 ? 'day' : 'days'}
                </Text>
                <Text style={styles.customTotalAmount}>
                  {formatCurrency(PAYMENT_AMOUNTS.DAILY_PAYMENT * selectedDays)}
                </Text>
              </View>

              <Button
                title={t('payment.payNow')}
                onPress={() =>
                  handleSelectOption({
                    type: 'daily',
                    amount: PAYMENT_AMOUNTS.DAILY_PAYMENT * selectedDays,
                    label: `${selectedDays} ${t('payment.days')}`,
                    description: '',
                    icon: 'calendar',
                    days: selectedDays,
                  })
                }
                size="lg"
              />
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Confirm payment
  if (step === 'confirm') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('select')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('payment.confirm')}</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.confirmContent}>
          <Card style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="phone-portrait" size={48} color={COLORS.primary} />
            </View>

            <Text style={styles.confirmTitle}>{t('payment.mpesaPrompt')}</Text>
            <Text style={styles.confirmDesc}>{t('payment.mpesaPromptDesc')}</Text>

            <View style={styles.confirmDetails}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>{t('payment.paymentType')}</Text>
                <Text style={styles.confirmValue}>{selectedOption?.label}</Text>
              </View>
              {selectedOption?.days && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>{t('payment.days')}</Text>
                  <Text style={styles.confirmValue}>{selectedDays}</Text>
                </View>
              )}
              <View style={[styles.confirmRow, styles.confirmRowTotal]}>
                <Text style={styles.confirmLabel}>{t('payment.amount')}</Text>
                <Text style={styles.confirmAmount}>{formatCurrency(getTotalAmount())}</Text>
              </View>
            </View>

            <View style={styles.mpesaInfo}>
              <Ionicons name="information-circle" size={20} color={COLORS.primary} />
              <Text style={styles.mpesaInfoText}>{t('payment.mpesaInfo')}</Text>
            </View>
          </Card>
        </View>

        <View style={styles.footer}>
          <Button
            title={t('payment.confirmPay', { amount: formatCurrency(getTotalAmount()) })}
            onPress={handleConfirmPayment}
            size="lg"
            loading={paymentMutation.isPending}
            disabled={paymentMutation.isPending}
            style={styles.fullButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Processing payment
  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.processingIcon}>
            <Ionicons name="phone-portrait" size={64} color={COLORS.primary} />
          </View>
          <Text style={styles.processingTitle}>{t('payment.processing')}</Text>
          <Text style={styles.processingDesc}>{t('payment.processingDesc')}</Text>

          <View style={styles.processingSteps}>
            <ProcessingStep
              number={1}
              text={t('payment.step1')}
              completed
            />
            <ProcessingStep
              number={2}
              text={t('payment.step2')}
              active
            />
            <ProcessingStep
              number={3}
              text={t('payment.step3')}
            />
          </View>

          <Text style={styles.waitingText}>{t('payment.waitingForConfirmation')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Success
  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={100} color={COLORS.success} />
          </View>
          <Text style={styles.successTitle}>{t('payment.success')}</Text>
          <Text style={styles.successAmount}>{formatCurrency(getTotalAmount())}</Text>
          <Text style={styles.successDesc}>{t('payment.successDesc')}</Text>

          <Card style={styles.successCard}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>{t('payment.paymentType')}</Text>
              <Text style={styles.successValue}>{selectedOption?.label}</Text>
            </View>
            {selectedOption?.days && (
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>{t('payment.daysAdded')}</Text>
                <Text style={styles.successValue}>{selectedDays}</Text>
              </View>
            )}
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>{t('payment.newBalance')}</Text>
              <Text style={styles.successValue}>{formatCurrency(wallet?.balance ?? 0)}</Text>
            </View>
          </Card>

          <Button
            title={t('common.done')}
            onPress={handleDone}
            size="lg"
            style={styles.doneButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Failed
  if (step === 'failed') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.failedIcon}>
            <Ionicons name="close-circle" size={100} color={COLORS.error} />
          </View>
          <Text style={styles.failedTitle}>{t('payment.failed')}</Text>
          <Text style={styles.failedDesc}>{t('payment.failedDesc')}</Text>

          <View style={styles.failedButtons}>
            <Button
              title={t('payment.tryAgain')}
              onPress={handleRetry}
              size="lg"
              style={styles.fullButton}
            />
            <Button
              title={t('common.cancel')}
              onPress={() => router.back()}
              variant="outline"
              size="lg"
              style={styles.fullButton}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

function ProcessingStep({
  number,
  text,
  completed,
  active,
}: {
  number: number;
  text: string;
  completed?: boolean;
  active?: boolean;
}) {
  return (
    <View style={styles.processingStep}>
      <View
        style={[
          styles.stepCircle,
          completed && styles.stepCircleCompleted,
          active && styles.stepCircleActive,
        ]}
      >
        {completed ? (
          <Ionicons name="checkmark" size={16} color="#fff" />
        ) : (
          <Text style={[styles.stepNumber, (completed || active) && styles.stepNumberActive]}>
            {number}
          </Text>
        )}
      </View>
      <Text style={[styles.stepText, active && styles.stepTextActive]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  progressCard: {
    marginBottom: SPACING.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  progressTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  progressStats: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
  },
  progressStat: {
    flex: 1,
    alignItems: 'center',
  },
  progressStatValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  progressStatLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  optionsList: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  optionCard: {
    padding: SPACING.md,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositIcon: {
    backgroundColor: COLORS.primary,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  optionAmount: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  amountText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  customCard: {
    marginBottom: SPACING.lg,
  },
  customTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  customDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginBottom: SPACING.md,
  },
  daysSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  dayButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  dayButtonTextSelected: {
    color: '#fff',
  },
  customTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  customTotalLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
  },
  customTotalAmount: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // Confirm styles
  confirmContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  confirmCard: {
    alignItems: 'center',
  },
  confirmIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  confirmTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  confirmDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  confirmDetails: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  confirmRowTotal: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
    paddingTop: SPACING.md,
  },
  confirmLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
  },
  confirmValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  confirmAmount: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  mpesaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: `${COLORS.primary}10`,
    padding: SPACING.md,
    borderRadius: 12,
  },
  mpesaInfoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  fullButton: {
    width: '100%',
  },
  // Center content
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  processingIcon: {
    marginBottom: SPACING.lg,
  },
  processingTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  processingDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  processingSteps: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  processingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCompleted: {
    backgroundColor: COLORS.success,
  },
  stepCircleActive: {
    backgroundColor: COLORS.primary,
  },
  stepNumber: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
  },
  stepTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  waitingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginTop: SPACING.md,
  },
  // Success
  successIcon: {
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.success,
    marginBottom: SPACING.sm,
  },
  successAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  successDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  successCard: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  successLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
  },
  successValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  doneButton: {
    width: '100%',
  },
  // Failed
  failedIcon: {
    marginBottom: SPACING.lg,
  },
  failedTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.error,
    marginBottom: SPACING.sm,
  },
  failedDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  failedButtons: {
    width: '100%',
    gap: SPACING.md,
  },
});
