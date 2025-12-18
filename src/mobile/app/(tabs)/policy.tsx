import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, Linking, Modal, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Card, Button, Badge } from '@/components/ui';
import { userApi } from '@/services/api/user.api';
import { COLORS, SPACING, FONT_SIZES } from '@/config/constants';
import type { Policy } from '@/types';

// 30-day free-look period
const FREE_LOOK_DAYS = 30;

export default function PolicyScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [policyToCancel, setPolicyToCancel] = useState<Policy | null>(null);

  const { data: policies, isLoading, refetch } = useQuery({
    queryKey: ['policies'],
    queryFn: userApi.getPolicies,
  });

  const cancelMutation = useMutation({
    mutationFn: ({ policyId, reason }: { policyId: string; reason: string }) =>
      userApi.cancelPolicy(policyId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      setShowCancelModal(false);
      setCancelReason('');
      setPolicyToCancel(null);
      Alert.alert(
        t('common.done'),
        t('policy.cancelSuccess')
      );
    },
    onError: () => {
      Alert.alert(t('common.error'), t('policy.cancelError'));
    },
  });

  const activePolicy = policies?.find((p) => p.status === 'active');

  /**
   * Check if policy is within free-look period
   */
  const isWithinFreeLookPeriod = (policy: Policy) => {
    const startDate = new Date(policy.startDate);
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceStart <= FREE_LOOK_DAYS && policy.status === 'active';
  };

  const getDaysInFreeLookPeriod = (policy: Policy) => {
    const startDate = new Date(policy.startDate);
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return FREE_LOOK_DAYS - daysSinceStart;
  };

  const handleCancelPress = (policy: Policy) => {
    setPolicyToCancel(policy);
    setShowCancelModal(true);
  };

  const handleConfirmCancel = () => {
    if (!policyToCancel || !cancelReason.trim()) {
      Alert.alert(t('common.error'), t('policy.cancelReasonRequired'));
      return;
    }
    cancelMutation.mutate({ policyId: policyToCancel.id, reason: cancelReason.trim() });
  };

  /**
   * Download policy certificate PDF
   */
  const handleDownload = async (policyId: string, policyNumber: string) => {
    setIsDownloading(true);
    try {
      // Get the download URL from the API
      const result = await userApi.getPolicyDocument(policyId);

      if (!result.downloadUrl) {
        Alert.alert(
          t('common.info'),
          result.message || t('policy.documentNotReady')
        );
        return;
      }

      // Download the file
      const filename = `BodaInsure_Policy_${policyNumber}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(
        result.downloadUrl,
        fileUri
      );

      if (downloadResult.status === 200) {
        // Check if sharing is available and share/save the file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: t('policy.downloadCertificate'),
          });
        } else {
          Alert.alert(
            t('common.success'),
            t('policy.downloadSuccess', { filename })
          );
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert(
        t('common.error'),
        t('policy.downloadError')
      );
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * Share policy via WhatsApp
   */
  const handleShareWhatsApp = async (policyId: string, policyNumber: string) => {
    setIsSharing(true);
    try {
      // Get the download URL from the API
      const result = await userApi.getPolicyDocument(policyId);

      if (!result.downloadUrl) {
        Alert.alert(
          t('common.info'),
          result.message || t('policy.documentNotReady')
        );
        return;
      }

      // Download the file first
      const filename = `BodaInsure_Policy_${policyNumber}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(
        result.downloadUrl,
        fileUri
      );

      if (downloadResult.status === 200) {
        // Check if sharing is available
        if (await Sharing.isAvailableAsync()) {
          // Share the file - this will open the share sheet where user can select WhatsApp
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: t('policy.shareWhatsApp'),
          });
        } else {
          // Fallback: Open WhatsApp with a message (without attachment)
          const message = encodeURIComponent(
            t('policy.shareMessage', { policyNumber })
          );
          const whatsappUrl = `whatsapp://send?text=${message}`;

          const canOpen = await Linking.canOpenURL(whatsappUrl);
          if (canOpen) {
            await Linking.openURL(whatsappUrl);
          } else {
            Alert.alert(
              t('common.error'),
              t('policy.whatsappNotInstalled')
            );
          }
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert(
        t('common.error'),
        t('policy.shareError')
      );
    } finally {
      setIsSharing(false);
    }
  };

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
                  onPress={() => handleDownload(activePolicy.id, activePolicy.policyNumber)}
                  variant="outline"
                  size="md"
                  icon={<Ionicons name="download-outline" size={20} color={COLORS.primary} />}
                  style={styles.actionButton}
                  loading={isDownloading}
                  disabled={isDownloading || isSharing}
                />
                <Button
                  title={t('policy.shareWhatsApp')}
                  onPress={() => handleShareWhatsApp(activePolicy.id, activePolicy.policyNumber)}
                  variant="secondary"
                  size="md"
                  icon={<Ionicons name="logo-whatsapp" size={20} color={COLORS.text} />}
                  style={styles.actionButton}
                  loading={isSharing}
                  disabled={isDownloading || isSharing}
                />
              </View>

              {/* Free Look Period Cancel Option */}
              {isWithinFreeLookPeriod(activePolicy) && (
                <View style={styles.freeLookSection}>
                  <View style={styles.freeLookInfo}>
                    <Ionicons name="information-circle-outline" size={18} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.freeLookText}>
                      {t('policy.freeLookRemaining', { days: getDaysInFreeLookPeriod(activePolicy) })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cancelLink}
                    onPress={() => handleCancelPress(activePolicy)}
                  >
                    <Text style={styles.cancelLinkText}>{t('policy.cancelPolicy')}</Text>
                  </TouchableOpacity>
                </View>
              )}
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

      {/* Cancel Policy Modal */}
      <Modal
        visible={showCancelModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('policy.cancelPolicy')}</Text>
              <TouchableOpacity
                onPress={() => setShowCancelModal(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={24} color={COLORS.warning} />
              <Text style={styles.warningText}>
                {t('policy.cancelWarning')}
              </Text>
            </View>

            <Text style={styles.modalLabel}>{t('policy.cancelReasonLabel')}</Text>
            <TextInput
              style={styles.reasonInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder={t('policy.cancelReasonPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <Button
                title={t('common.cancel')}
                onPress={() => setShowCancelModal(false)}
                variant="outline"
                size="lg"
                style={styles.modalButton}
              />
              <Button
                title={cancelMutation.isPending ? t('common.loading') : t('policy.confirmCancel')}
                onPress={handleConfirmCancel}
                size="lg"
                style={[styles.modalButton, styles.cancelButton]}
                textStyle={{ color: '#fff' }}
                disabled={cancelMutation.isPending || !cancelReason.trim()}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  freeLookSection: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  freeLookInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  freeLookText: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  cancelLink: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  cancelLinkText: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
    textDecorationLine: 'underline',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#fef3c7',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.lg,
  },
  warningText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  modalLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  reasonInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 100,
    marginBottom: SPACING.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
});
