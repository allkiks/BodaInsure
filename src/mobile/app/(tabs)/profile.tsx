import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking, Modal, TextInput, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Badge } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { userApi } from '@/services/api/user.api';
import { COLORS, SPACING, FONT_SIZES } from '@/config/constants';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateLanguage, updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [editForm, setEditForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { fullName?: string; email?: string }) =>
      userApi.updateProfile(data),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      setIsEditModalVisible(false);
      Alert.alert(t('common.done'), t('profile.saved'));
    },
    onError: () => {
      Alert.alert(t('common.error'), t('errors.unknown'));
    },
  });

  const handleEditProfile = () => {
    setEditForm({
      fullName: user?.fullName || '',
      email: user?.email || '',
    });
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = () => {
    const updates: { fullName?: string; email?: string } = {};
    if (editForm.fullName.trim()) {
      updates.fullName = editForm.fullName.trim();
    }
    if (editForm.email.trim()) {
      updates.email = editForm.email.trim();
    }
    updateProfileMutation.mutate(updates);
  };

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: { reminderOptOut?: boolean; language?: string }) =>
      userApi.updatePreferences(data),
    onSuccess: (_, variables) => {
      if (variables.reminderOptOut !== undefined) {
        updateUser({ reminderOptOut: variables.reminderOptOut });
      }
    },
    onError: () => {
      Alert.alert(t('common.error'), t('errors.unknown'));
    },
  });

  const requestDeletionMutation = useMutation({
    mutationFn: (reason?: string) => userApi.requestDeletion(reason),
    onSuccess: (response) => {
      setIsDeleteModalVisible(false);
      setDeleteReason('');
      Alert.alert(
        t('profile.deleteAccount'),
        t('profile.deleteScheduled', {
          date: new Date(response.deletionScheduledFor).toLocaleDateString(),
        }),
        [{ text: t('common.ok') }]
      );
    },
    onError: () => {
      Alert.alert(t('common.error'), t('profile.deleteError'));
    },
  });

  const handleToggleReminders = (value: boolean) => {
    updatePreferencesMutation.mutate({ reminderOptOut: !value });
  };

  const handleLogout = () => {
    Alert.alert(t('auth.logout'), t('auth.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const handleLanguageChange = (language: 'en' | 'sw') => {
    updateLanguage(language);
    i18n.changeLanguage(language);
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:+254700000000');
  };

  const handleWhatsAppSupport = () => {
    Linking.openURL('https://wa.me/254700000000');
  };

  const handleDeleteAccount = () => {
    setIsDeleteModalVisible(true);
  };

  const handleConfirmDelete = () => {
    requestDeletionMutation.mutate(deleteReason.trim() || undefined);
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    return phone.replace(/(\+\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
  };

  const kycStatusVariant = user?.kycStatus === 'approved' ? 'success' :
    user?.kycStatus === 'pending' ? 'warning' : 'error';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <Text style={styles.title}>{t('profile.title')}</Text>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Ionicons name="pencil" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.fullName?.[0]?.toUpperCase() || user?.phone?.[1] || 'U'}
            </Text>
          </View>
          <Text style={styles.name}>
            {user?.fullName || 'BodaInsure User'}
          </Text>
          <Text style={styles.phone}>{formatPhone(user?.phone || '')}</Text>
          <Badge
            label={t(`kyc.status${user?.kycStatus?.charAt(0).toUpperCase()}${user?.kycStatus?.slice(1)}`)}
            variant={kycStatusVariant}
          />
        </Card>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.personalInfo')}</Text>
          <Card variant="outlined">
            <ProfileItem
              icon="person-outline"
              label={t('profile.fullName')}
              value={user?.fullName || '-'}
            />
            <ProfileItem
              icon="call-outline"
              label={t('profile.phone')}
              value={formatPhone(user?.phone || '')}
            />
            <ProfileItem
              icon="mail-outline"
              label={t('profile.email')}
              value={user?.email || '-'}
              isLast
            />
          </Card>
        </View>

        {/* Language Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
          <Card variant="outlined" style={styles.languageCard}>
            <View style={styles.languageOptions}>
              <LanguageButton
                label={t('profile.english')}
                flag="🇬🇧"
                selected={i18n.language === 'en'}
                onPress={() => handleLanguageChange('en')}
              />
              <LanguageButton
                label={t('profile.swahili')}
                flag="🇰🇪"
                selected={i18n.language === 'sw'}
                onPress={() => handleLanguageChange('sw')}
              />
            </View>
          </Card>
        </View>

        {/* Notification Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.notifications')}</Text>
          <Card variant="outlined">
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <View style={styles.preferenceIcon}>
                  <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.preferenceText}>
                  <Text style={styles.preferenceLabel}>{t('profile.paymentReminders')}</Text>
                  <Text style={styles.preferenceDesc}>{t('profile.paymentRemindersDesc')}</Text>
                </View>
              </View>
              <Switch
                value={!user?.reminderOptOut}
                onValueChange={handleToggleReminders}
                trackColor={{ false: COLORS.border, true: `${COLORS.primary}50` }}
                thumbColor={!user?.reminderOptOut ? COLORS.primary : COLORS.textLight}
                disabled={updatePreferencesMutation.isPending}
              />
            </View>
          </Card>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.support')}</Text>
          <Card variant="outlined">
            <MenuItem
              icon="call-outline"
              label={t('profile.callSupport')}
              onPress={handleCallSupport}
            />
            <MenuItem
              icon="logo-whatsapp"
              label={t('profile.whatsappSupport')}
              onPress={handleWhatsAppSupport}
              isLast
            />
          </Card>
        </View>

        {/* Account Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.accountManagement')}</Text>
          <Card variant="outlined">
            <TouchableOpacity
              style={styles.deleteAccountItem}
              onPress={handleDeleteAccount}
            >
              <View style={styles.deleteAccountIcon}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              </View>
              <View style={styles.deleteAccountText}>
                <Text style={styles.deleteAccountLabel}>{t('profile.deleteAccount')}</Text>
                <Text style={styles.deleteAccountDesc}>{t('profile.deleteAccountDesc')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Logout */}
        <Button
          title={t('auth.logout')}
          onPress={handleLogout}
          variant="outline"
          size="lg"
          style={styles.logoutButton}
          icon={<Ionicons name="log-out-outline" size={20} color={COLORS.error} />}
          textStyle={{ color: COLORS.error }}
        />

        {/* Version */}
        <Text style={styles.version}>BodaInsure v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.editProfile')}</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('profile.fullName')}</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.fullName}
                onChangeText={(text) =>
                  setEditForm((prev) => ({ ...prev, fullName: text }))
                }
                placeholder={t('profile.fullNamePlaceholder')}
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('profile.email')}</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.email}
                onChangeText={(text) =>
                  setEditForm((prev) => ({ ...prev, email: text }))
                }
                placeholder={t('profile.emailPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Button
              title={
                updateProfileMutation.isPending
                  ? t('common.loading')
                  : t('profile.saveChanges')
              }
              onPress={handleSaveProfile}
              size="lg"
              disabled={updateProfileMutation.isPending}
              style={styles.saveButton}
            />
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={isDeleteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.deleteAccount')}</Text>
              <TouchableOpacity
                onPress={() => setIsDeleteModalVisible(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.deleteWarningBox}>
              <Ionicons name="warning" size={24} color={COLORS.error} />
              <Text style={styles.deleteWarningText}>
                {t('profile.deleteWarning')}
              </Text>
            </View>

            <View style={styles.deleteInfoBox}>
              <Text style={styles.deleteInfoTitle}>{t('profile.deleteInfoTitle')}</Text>
              <Text style={styles.deleteInfoItem}>• {t('profile.deleteInfo1')}</Text>
              <Text style={styles.deleteInfoItem}>• {t('profile.deleteInfo2')}</Text>
              <Text style={styles.deleteInfoItem}>• {t('profile.deleteInfo3')}</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('profile.deleteReasonLabel')}</Text>
              <TextInput
                style={[styles.formInput, styles.deleteReasonInput]}
                value={deleteReason}
                onChangeText={setDeleteReason}
                placeholder={t('profile.deleteReasonPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <Button
              title={
                requestDeletionMutation.isPending
                  ? t('common.loading')
                  : t('profile.confirmDelete')
              }
              onPress={handleConfirmDelete}
              size="lg"
              disabled={requestDeletionMutation.isPending}
              style={styles.deleteButton}
              textStyle={styles.deleteButtonText}
            />

            <TouchableOpacity
              onPress={() => setIsDeleteModalVisible(false)}
              style={styles.cancelDeleteButton}
            >
              <Text style={styles.cancelDeleteText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ProfileItem({
  icon,
  label,
  value,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.profileItem, !isLast && styles.profileItemBorder]}>
      <View style={styles.profileItemIcon}>
        <Ionicons name={icon} size={20} color={COLORS.textLight} />
      </View>
      <View style={styles.profileItemContent}>
        <Text style={styles.profileItemLabel}>{label}</Text>
        <Text style={styles.profileItemValue}>{value}</Text>
      </View>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Card
      variant="filled"
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
      onPress={onPress}
    >
      <View style={styles.menuItemContent}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
        <Text style={styles.menuItemLabel}>{label}</Text>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
      </View>
    </Card>
  );
}

function LanguageButton({
  label,
  flag,
  selected,
  onPress,
}: {
  label: string;
  flag: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Card
      style={[styles.languageButton, selected && styles.languageButtonSelected]}
      onPress={onPress}
    >
      <Text style={styles.languageFlag}>{flag}</Text>
      <Text style={[styles.languageLabel, selected && styles.languageLabelSelected]}>
        {label}
      </Text>
      {selected && (
        <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
      )}
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
  profileCard: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  editButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  name: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  phone: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    marginBottom: SPACING.md,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  profileItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileItemContent: {
    flex: 1,
  },
  profileItemLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  profileItemValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  languageCard: {
    padding: SPACING.sm,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  preferenceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceText: {
    flex: 1,
  },
  preferenceLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  preferenceDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  languageOptions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  languageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  languageButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  languageFlag: {
    fontSize: 24,
  },
  languageLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  languageLabelSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  menuItem: {
    padding: 0,
    backgroundColor: 'transparent',
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  logoutButton: {
    marginTop: SPACING.md,
    borderColor: COLORS.error,
  },
  version: {
    textAlign: 'center',
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginTop: SPACING.lg,
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
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  formInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  saveButton: {
    marginTop: SPACING.md,
  },
  // Delete Account styles
  deleteAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  deleteAccountIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${COLORS.error}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: {
    flex: 1,
  },
  deleteAccountLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.error,
    marginBottom: 2,
  },
  deleteAccountDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  deleteWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${COLORS.error}10`,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  deleteWarningText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    lineHeight: 20,
  },
  deleteInfoBox: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.lg,
  },
  deleteInfoTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  deleteInfoItem: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    lineHeight: 22,
  },
  deleteReasonInput: {
    minHeight: 80,
    paddingTop: SPACING.md,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    marginTop: SPACING.md,
  },
  deleteButtonText: {
    color: '#fff',
  },
  cancelDeleteButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  cancelDeleteText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    fontWeight: '500',
  },
});
