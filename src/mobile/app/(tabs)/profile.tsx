import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { COLORS, SPACING, FONT_SIZES } from '@/config/constants';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateLanguage } = useAuthStore();

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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.firstName?.[0]?.toUpperCase() || user?.phone?.[1] || 'U'}
            </Text>
          </View>
          <Text style={styles.name}>
            {user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : 'BodaInsure User'}
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
              label={t('profile.firstName')}
              value={user?.firstName || '-'}
            />
            <ProfileItem
              icon="person-outline"
              label={t('profile.lastName')}
              value={user?.lastName || '-'}
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
});
