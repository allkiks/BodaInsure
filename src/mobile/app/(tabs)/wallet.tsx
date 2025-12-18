import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, ProgressBar, Badge } from '@/components/ui';
import { userApi } from '@/services/api/user.api';
import { COLORS, SPACING, FONT_SIZES, PAYMENT_AMOUNTS } from '@/config/constants';
import type { Payment } from '@/types';

export default function WalletScreen() {
  const { t } = useTranslation();

  const { data: wallet, isLoading, refetch: refetchWallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: userApi.getWallet,
  });

  const { data: progress, refetch: refetchProgress } = useQuery({
    queryKey: ['paymentProgress'],
    queryFn: userApi.getPaymentProgress,
  });

  const { data: payments, refetch: refetchPayments } = useQuery({
    queryKey: ['payments'],
    queryFn: userApi.getPayments,
  });

  const onRefresh = async () => {
    await Promise.all([refetchWallet(), refetchProgress(), refetchPayments()]);
  };

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <Text style={styles.title}>{t('wallet.title')}</Text>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('wallet.balance')}</Text>
          <Text style={styles.balanceAmount}>
            {formatCurrency(wallet?.balance ?? 0)}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('wallet.totalPaid')}</Text>
              <Text style={styles.statValue}>
                {formatCurrency(wallet?.totalDeposited ?? 0)}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('wallet.remaining')}</Text>
              <Text style={styles.statValue}>
                {formatCurrency(progress?.amountRemaining ?? 0)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Progress Card */}
        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{t('wallet.progress')}</Text>
            <Text style={styles.daysLeft}>
              {t('wallet.daysLeft', {
                days: PAYMENT_AMOUNTS.DAYS_REQUIRED - (progress?.daysCompleted ?? 0),
              })}
            </Text>
          </View>

          <ProgressBar
            progress={((progress?.daysCompleted ?? 0) / PAYMENT_AMOUNTS.DAYS_REQUIRED) * 100}
            showPercentage
            height={12}
          />

          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>
                {progress?.daysCompleted ?? 0}
              </Text>
              <Text style={styles.progressStatLabel}>Days Paid</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>
                {PAYMENT_AMOUNTS.DAYS_REQUIRED - (progress?.daysCompleted ?? 0)}
              </Text>
              <Text style={styles.progressStatLabel}>Days Left</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>
                {formatCurrency(progress?.amountPaid ?? 0)}
              </Text>
              <Text style={styles.progressStatLabel}>Total Paid</Text>
            </View>
          </View>

          <Button
            title={t('wallet.makePayment')}
            onPress={() => router.push('/payment')}
            size="lg"
            style={styles.payButton}
          />
        </Card>

        {/* Payment History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>{t('payment.history')}</Text>

          {payments && payments.length > 0 ? (
            <View style={styles.paymentsList}>
              {payments.slice(0, 10).map((payment) => (
                <PaymentItem key={payment.id} payment={payment} />
              ))}
            </View>
          ) : (
            <Card variant="outlined" style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.emptyText}>{t('payment.noPayments')}</Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PaymentItem({ payment }: { payment: Payment }) {
  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString()}`;
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusVariant = payment.status === 'completed' ? 'success' :
    payment.status === 'pending' ? 'warning' : 'error';

  const typeIcon = payment.type === 'deposit' ? 'wallet' : 'calendar';

  return (
    <Card variant="outlined" style={styles.paymentItem}>
      <View style={styles.paymentContent}>
        <View style={[styles.paymentIcon, payment.status === 'completed' && styles.paymentIconSuccess]}>
          <Ionicons
            name={typeIcon}
            size={20}
            color={payment.status === 'completed' ? COLORS.primary : COLORS.textLight}
          />
        </View>
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentType}>
            {payment.type === 'deposit' ? 'Initial Deposit' : 'Daily Payment'}
          </Text>
          <Text style={styles.paymentDate}>{formatDate(payment.createdAt)}</Text>
        </View>
        <View style={styles.paymentAmountSection}>
          <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
          <Badge label={payment.status} variant={statusVariant} size="sm" />
        </View>
      </View>
    </Card>
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
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    marginBottom: SPACING.md,
  },
  balanceLabel: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    marginBottom: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: SPACING.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: SPACING.md,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: '#fff',
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
  daysLeft: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  progressStats: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
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
  payButton: {
    marginTop: SPACING.sm,
  },
  historySection: {
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  paymentsList: {
    gap: SPACING.sm,
  },
  paymentItem: {
    padding: SPACING.md,
  },
  paymentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIconSuccess: {
    backgroundColor: `${COLORS.primary}15`,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentType: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  paymentDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  paymentAmountSection: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  paymentAmount: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
  },
});
