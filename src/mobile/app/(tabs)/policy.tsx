import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge } from '@/components/ui';
import { userApi } from '@/services/api/user.api';
import { COLORS, SPACING, FONT_SIZES } from '@/config/constants';
import type { Policy } from '@/types';

export default function PolicyScreen() {
  const { t } = useTranslation();

  const { data: policies, isLoading, refetch } = useQuery({
    queryKey: ['policies'],
    queryFn: userApi.getPolicies,
  });

  const activePolicy = policies?.find((p) => p.status === 'active');

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'info';
      case 'expired':
      case 'lapsed':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        {/* Header */}
        <Text style={styles.title}>{t('policy.title')}</Text>

        {activePolicy ? (
          <>
            {/* Active Policy Card */}
            <Card style={styles.policyCard}>
              <View style={styles.policyHeader}>
                <View style={styles.shieldIcon}>
                  <Ionicons name="shield-checkmark" size={32} color="#fff" />
                </View>
                <View style={styles.policyHeaderText}>
                  <Text style={styles.policyNumber}>
                    {t('policy.policyNumber', { number: activePolicy.policyNumber })}
                  </Text>
                  <Badge
                    label={t(`policy.status.${activePolicy.status}`)}
                    variant={getStatusVariant(activePolicy.status)}
                  />
                </View>
              </View>

              <Text style={styles.policyType}>
                {t(`policy.type.${activePolicy.type}`)}
              </Text>

              <View style={styles.policyDates}>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>{t('policy.validFrom')}</Text>
                  <Text style={styles.dateValue}>{formatDate(activePolicy.startDate)}</Text>
                </View>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>{t('policy.validUntil')}</Text>
                  <Text style={styles.dateValue}>{formatDate(activePolicy.endDate)}</Text>
                </View>
              </View>

              {activePolicy.daysRemaining > 0 && (
                <View style={styles.daysRemaining}>
                  <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.daysRemainingText}>
                    {t('policy.daysRemaining', { days: activePolicy.daysRemaining })}
                  </Text>
                </View>
              )}

              <View style={styles.policyActions}>
                <Button
                  title={t('policy.downloadCertificate')}
                  onPress={() => {}}
                  variant="outline"
                  size="md"
                  icon={<Ionicons name="download-outline" size={20} color={COLORS.primary} />}
                  style={styles.actionButton}
                />
                <Button
                  title={t('policy.shareWhatsApp')}
                  onPress={() => {}}
                  variant="secondary"
                  size="md"
                  icon={<Ionicons name="logo-whatsapp" size={20} color={COLORS.text} />}
                  style={styles.actionButton}
                />
              </View>
            </Card>

            {/* All Policies */}
            {policies && policies.length > 1 && (
              <View style={styles.allPolicies}>
                <Text style={styles.sectionTitle}>All Policies</Text>
                {policies
                  .filter((p) => p.id !== activePolicy.id)
                  .map((policy) => (
                    <PolicyListItem key={policy.id} policy={policy} />
                  ))}
              </View>
            )}
          </>
        ) : (
          /* No Active Policy */
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="shield-outline" size={64} color={COLORS.textLight} />
            </View>
            <Text style={styles.emptyTitle}>{t('policy.noPolicies')}</Text>
            <Text style={styles.emptyDesc}>{t('policy.getPolicyDesc')}</Text>
            <Button
              title={t('wallet.makePayment')}
              onPress={() => router.push('/payment')}
              size="lg"
              style={styles.emptyButton}
            />
          </Card>
        )}

        {/* How It Works */}
        <Card variant="filled" style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t('policy.howItWorks.title')}</Text>
          <View style={styles.infoSteps}>
            <InfoStep
              number={1}
              title={t('policy.howItWorks.step1Title')}
              description={t('policy.howItWorks.step1Desc')}
            />
            <InfoStep
              number={2}
              title={t('policy.howItWorks.step2Title')}
              description={t('policy.howItWorks.step2Desc')}
            />
            <InfoStep
              number={3}
              title={t('policy.howItWorks.step3Title')}
              description={t('policy.howItWorks.step3Desc')}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function PolicyListItem({ policy }: { policy: Policy }) {
  const { t } = useTranslation();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'info';
      case 'expired':
      case 'lapsed':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Card variant="outlined" style={styles.policyListItem}>
      <View style={styles.policyListContent}>
        <View style={styles.policyListIcon}>
          <Ionicons name="document-text" size={24} color={COLORS.textLight} />
        </View>
        <View style={styles.policyListInfo}>
          <Text style={styles.policyListNumber}>{policy.policyNumber}</Text>
          <Text style={styles.policyListDates}>
            {formatDate(policy.startDate)} - {formatDate(policy.endDate)}
          </Text>
        </View>
        <Badge label={t(`policy.status.${policy.status}`)} variant={getStatusVariant(policy.status)} size="sm" />
      </View>
    </Card>
  );
}

function InfoStep({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <View style={styles.infoStep}>
      <View style={styles.infoStepNumber}>
        <Text style={styles.infoStepNumberText}>{number}</Text>
      </View>
      <View style={styles.infoStepContent}>
        <Text style={styles.infoStepTitle}>{title}</Text>
        <Text style={styles.infoStepDesc}>{description}</Text>
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
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  policyCard: {
    backgroundColor: COLORS.primary,
    marginBottom: SPACING.lg,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  shieldIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyHeaderText: {
    flex: 1,
    gap: SPACING.xs,
  },
  policyNumber: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#fff',
  },
  policyType: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: '#fff',
    marginBottom: SPACING.lg,
  },
  policyDates: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: '#fff',
  },
  daysRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 100,
    alignSelf: 'flex-start',
    marginBottom: SPACING.lg,
  },
  daysRemainingText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  policyActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: 'transparent',
  },
  allPolicies: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  policyListItem: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  policyListContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  policyListIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyListInfo: {
    flex: 1,
  },
  policyListNumber: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  policyListDates: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  emptyIcon: {
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  emptyButton: {
    width: '100%',
  },
  infoCard: {
    marginTop: SPACING.md,
  },
  infoTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  infoSteps: {
    gap: SPACING.md,
  },
  infoStep: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  infoStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoStepNumberText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#fff',
  },
  infoStepContent: {
    flex: 1,
  },
  infoStepTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  infoStepDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
});
