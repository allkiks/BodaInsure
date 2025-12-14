import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, ProgressBar, Badge } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { userApi } from '@/services/api/user.api';
import { COLORS, SPACING, FONT_SIZES, PAYMENT_AMOUNTS } from '@/config/constants';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: userApi.getWallet,
  });

  const { data: progress, refetch: refetchProgress } = useQuery({
    queryKey: ['paymentProgress'],
    queryFn: userApi.getPaymentProgress,
  });

  const { data: activePolicy, refetch: refetchPolicy } = useQuery({
    queryKey: ['activePolicy'],
    queryFn: userApi.getActivePolicy,
  });

  const onRefresh = async () => {
    await Promise.all([refetchWallet(), refetchProgress(), refetchPolicy()]);
  };

  const greeting = user?.firstName
    ? t('home.greeting', { name: user.firstName })
    : t('home.greetingDefault');

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={walletLoading} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.subtitle}>Stay protected on the road</Text>
          </View>
          <View style={styles.notificationIcon}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
          </View>
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>{t('home.walletBalance')}</Text>
            <Badge
              label={activePolicy ? 'Active' : 'Inactive'}
              variant={activePolicy ? 'success' : 'warning'}
              size="sm"
            />
          </View>
          <Text style={styles.balanceAmount}>
            {formatCurrency(wallet?.balance ?? 0)}
          </Text>

          {/* Progress */}
          <View style={styles.progressSection}>
            <ProgressBar
              progress={((progress?.daysCompleted ?? 0) / PAYMENT_AMOUNTS.DAYS_REQUIRED) * 100}
              label={t('home.daysCompleted', {
                completed: progress?.daysCompleted ?? 0,
                total: PAYMENT_AMOUNTS.DAYS_REQUIRED,
              })}
              showPercentage
              height={8}
            />
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <Button
              title={t('home.payNow')}
              onPress={() => router.push('/payment')}
              size="md"
              style={styles.payButton}
            />
            <Button
              title={t('home.viewPolicy')}
              onPress={() => router.push('/(tabs)/policy')}
              variant="secondary"
              size="md"
              style={styles.policyButton}
            />
          </View>
        </Card>

        {/* Status Cards */}
        <View style={styles.statusCards}>
          {/* KYC Status */}
          {user?.kycStatus !== 'approved' && (
            <Card style={styles.statusCard} onPress={() => router.push('/kyc')}>
              <View style={styles.statusCardContent}>
                <View style={[styles.statusIcon, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="document-text" size={24} color="#f59e0b" />
                </View>
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle}>{t('home.kycPending')}</Text>
                  <Text style={styles.statusDesc}>{t('home.kycPendingDesc')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
              </View>
            </Card>
          )}

          {/* Deposit Needed */}
          {!progress?.depositPaid && (
            <Card style={styles.statusCard} onPress={() => router.push('/payment')}>
              <View style={styles.statusCardContent}>
                <View style={[styles.statusIcon, { backgroundColor: '#dbeafe' }]}>
                  <Ionicons name="wallet" size={24} color="#3b82f6" />
                </View>
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle}>{t('home.depositNeeded')}</Text>
                  <Text style={styles.statusDesc}>
                    {t('home.depositNeededDesc', { amount: PAYMENT_AMOUNTS.INITIAL_DEPOSIT })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
              </View>
            </Card>
          )}

          {/* Daily Payment */}
          {progress?.depositPaid && !progress?.eligibleForPolicy2 && (
            <Card style={styles.statusCard} onPress={() => router.push('/payment')}>
              <View style={styles.statusCardContent}>
                <View style={[styles.statusIcon, { backgroundColor: '#dcfce7' }]}>
                  <Ionicons name="calendar" size={24} color="#16a34a" />
                </View>
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle}>{t('home.dailyPayment')}</Text>
                  <Text style={styles.statusDesc}>
                    {t('home.dailyPaymentDesc', { amount: PAYMENT_AMOUNTS.DAILY_PAYMENT })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
              </View>
            </Card>
          )}
        </View>

        {/* How It Works */}
        <View style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>{t('policy.howItWorks.title')}</Text>
          <View style={styles.steps}>
            <StepItem
              number={1}
              title={t('policy.howItWorks.step1Title')}
              description={t('policy.howItWorks.step1Desc')}
              completed={progress?.depositPaid}
            />
            <StepItem
              number={2}
              title={t('policy.howItWorks.step2Title')}
              description={t('policy.howItWorks.step2Desc')}
              completed={(progress?.daysCompleted ?? 0) >= PAYMENT_AMOUNTS.DAYS_REQUIRED}
              inProgress={(progress?.daysCompleted ?? 0) > 0 && (progress?.daysCompleted ?? 0) < PAYMENT_AMOUNTS.DAYS_REQUIRED}
            />
            <StepItem
              number={3}
              title={t('policy.howItWorks.step3Title')}
              description={t('policy.howItWorks.step3Desc')}
              completed={progress?.eligibleForPolicy2}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StepItem({
  number,
  title,
  description,
  completed,
  inProgress,
}: {
  number: number;
  title: string;
  description: string;
  completed?: boolean;
  inProgress?: boolean;
}) {
  return (
    <View style={styles.stepItem}>
      <View
        style={[
          styles.stepNumber,
          completed && styles.stepNumberCompleted,
          inProgress && styles.stepNumberInProgress,
        ]}
      >
        {completed ? (
          <Ionicons name="checkmark" size={16} color="#fff" />
        ) : (
          <Text
            style={[
              styles.stepNumberText,
              (completed || inProgress) && styles.stepNumberTextActive,
            ]}
          >
            {number}
          </Text>
        )}
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginTop: 2,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    marginBottom: SPACING.lg,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  balanceLabel: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginBottom: SPACING.md,
  },
  progressSection: {
    marginBottom: SPACING.lg,
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  payButton: {
    flex: 1,
    backgroundColor: '#fff',
  },
  policyButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'transparent',
  },
  statusCards: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statusCard: {
    padding: SPACING.md,
  },
  statusCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  statusDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  howItWorks: {
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  steps: {
    gap: SPACING.md,
  },
  stepItem: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberCompleted: {
    backgroundColor: COLORS.primary,
  },
  stepNumberInProgress: {
    backgroundColor: COLORS.primary,
    opacity: 0.6,
  },
  stepNumberText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  stepNumberTextActive: {
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
});
