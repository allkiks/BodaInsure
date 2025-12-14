import { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge, ProgressBar } from '@/components/ui';
import { kycApi } from '@/services/api/kyc.api';
import { COLORS, SPACING, FONT_SIZES } from '@/config/constants';
import type { DocumentType } from '@/types';

type KycStep = 'intro' | 'capture' | 'review' | 'uploading' | 'complete';

interface CapturedDocuments {
  nationalIdFront?: string;
  nationalIdBack?: string;
  dlFront?: string;
  dlBack?: string;
  selfie?: string;
}

const DOCUMENT_TYPES: { key: keyof CapturedDocuments; type: DocumentType; label: string; icon: string }[] = [
  { key: 'nationalIdFront', type: 'national_id_front', label: 'kyc.nationalIdFront', icon: 'card-outline' },
  { key: 'nationalIdBack', type: 'national_id_back', label: 'kyc.nationalIdBack', icon: 'card-outline' },
  { key: 'dlFront', type: 'dl_front', label: 'kyc.dlFront', icon: 'car-outline' },
  { key: 'dlBack', type: 'dl_back', label: 'kyc.dlBack', icon: 'car-outline' },
  { key: 'selfie', type: 'selfie', label: 'kyc.selfie', icon: 'person-circle-outline' },
];

export default function KycScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const cameraRef = useRef<CameraView>(null);

  const [step, setStep] = useState<KycStep>('intro');
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [documents, setDocuments] = useState<CapturedDocuments>({});
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();

  const { data: kycStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['kycStatus'],
    queryFn: kycApi.getStatus,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ uri, type }: { uri: string; type: DocumentType }) =>
      kycApi.uploadDocument(uri, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kycStatus'] });
    },
  });

  const currentDoc = DOCUMENT_TYPES[currentDocIndex];
  const progress = ((currentDocIndex + 1) / DOCUMENT_TYPES.length) * 100;

  const handleStartKyc = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          t('kyc.cameraPermission'),
          t('kyc.cameraPermissionDesc'),
          [{ text: t('common.ok') }]
        );
        return;
      }
    }
    setStep('capture');
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo?.uri) {
        setDocuments((prev) => ({
          ...prev,
          [currentDoc.key]: photo.uri,
        }));
        setStep('review');
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('kyc.captureError'));
    }
  };

  const handlePickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: currentDoc.key === 'selfie' ? [1, 1] : [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setDocuments((prev) => ({
        ...prev,
        [currentDoc.key]: result.assets[0].uri,
      }));
      setStep('review');
    }
  };

  const handleRetake = () => {
    setDocuments((prev) => ({
      ...prev,
      [currentDoc.key]: undefined,
    }));
    setStep('capture');
  };

  const handleConfirm = () => {
    if (currentDocIndex < DOCUMENT_TYPES.length - 1) {
      setCurrentDocIndex((prev) => prev + 1);
      setStep('capture');
    } else {
      handleUploadAll();
    }
  };

  const handleUploadAll = async () => {
    setStep('uploading');

    try {
      for (const doc of DOCUMENT_TYPES) {
        const uri = documents[doc.key];
        if (uri) {
          await uploadMutation.mutateAsync({ uri, type: doc.type });
        }
      }
      await refetchStatus();
      setStep('complete');
    } catch (error) {
      Alert.alert(t('common.error'), t('kyc.uploadError'));
      setStep('review');
    }
  };

  const handleFinish = () => {
    router.replace('/(tabs)/home');
  };

  const toggleCameraFacing = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  // Already approved - show status
  if (kycStatus?.status === 'approved') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('kyc.title')}</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.centerContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
          </View>
          <Text style={styles.successTitle}>{t('kyc.statusApproved')}</Text>
          <Text style={styles.successDesc}>{t('kyc.approvedDesc')}</Text>
          <Button
            title={t('common.back')}
            onPress={() => router.back()}
            size="lg"
            style={styles.fullButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Intro step
  if (step === 'intro') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('kyc.title')}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Status Card */}
          {kycStatus?.status === 'pending' && (
            <Card style={styles.statusCard}>
              <View style={styles.statusContent}>
                <Ionicons name="time" size={32} color={COLORS.warning} />
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle}>{t('kyc.statusPending')}</Text>
                  <Text style={styles.statusDesc}>{t('kyc.pendingDesc')}</Text>
                </View>
              </View>
            </Card>
          )}

          {/* Instructions */}
          <Card style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>{t('kyc.documentsRequired')}</Text>

            <View style={styles.documentList}>
              {DOCUMENT_TYPES.map((doc, index) => (
                <View key={doc.key} style={styles.documentItem}>
                  <View style={styles.documentIcon}>
                    <Ionicons name={doc.icon as any} size={24} color={COLORS.primary} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentLabel}>{t(doc.label)}</Text>
                    <Text style={styles.documentHint}>
                      {doc.key === 'selfie' ? t('kyc.selfieHint') : t('kyc.documentHint')}
                    </Text>
                  </View>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Tips */}
          <Card variant="filled" style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>{t('kyc.tips')}</Text>
            <View style={styles.tipsList}>
              <TipItem text={t('kyc.tip1')} />
              <TipItem text={t('kyc.tip2')} />
              <TipItem text={t('kyc.tip3')} />
            </View>
          </Card>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={kycStatus?.status === 'pending' ? t('kyc.resubmit') : t('kyc.startVerification')}
            onPress={handleStartKyc}
            size="lg"
            style={styles.fullButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Camera capture step
  if (step === 'capture') {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <View style={styles.cameraHeader}>
          <TouchableOpacity onPress={() => setStep('intro')} style={styles.cameraBackButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.cameraProgress}>
            <Text style={styles.cameraStepText}>
              {currentDocIndex + 1} / {DOCUMENT_TYPES.length}
            </Text>
            <ProgressBar progress={progress} height={4} style={styles.progressBar} />
          </View>
          <TouchableOpacity onPress={toggleCameraFacing} style={styles.flipButton}>
            <Ionicons name="camera-reverse" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={currentDoc.key === 'selfie' ? 'front' : facing}
        >
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraTitle}>{t(currentDoc.label)}</Text>
            <View
              style={[
                styles.captureFrame,
                currentDoc.key === 'selfie' && styles.selfieFrame,
              ]}
            />
            <Text style={styles.cameraHint}>
              {currentDoc.key === 'selfie'
                ? t('kyc.alignFace')
                : t('kyc.alignDocument')}
            </Text>
          </View>
        </CameraView>

        <View style={styles.cameraControls}>
          <TouchableOpacity onPress={handlePickFromGallery} style={styles.galleryButton}>
            <Ionicons name="images" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCapture} style={styles.captureButton}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <View style={styles.galleryButton} />
        </View>
      </SafeAreaView>
    );
  }

  // Review step
  if (step === 'review') {
    const currentUri = documents[currentDoc.key];

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleRetake} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('kyc.reviewPhoto')}</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.reviewContent}>
          <View style={styles.progressSection}>
            <ProgressBar
              progress={progress}
              label={`${currentDocIndex + 1} ${t('common.of')} ${DOCUMENT_TYPES.length}`}
              showPercentage
            />
          </View>

          <Text style={styles.reviewLabel}>{t(currentDoc.label)}</Text>

          <View style={styles.imageContainer}>
            {currentUri && (
              <Image source={{ uri: currentUri }} style={styles.previewImage} />
            )}
          </View>

          <Text style={styles.reviewHint}>{t('kyc.reviewHint')}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.buttonRow}>
            <Button
              title={t('kyc.retake')}
              onPress={handleRetake}
              variant="outline"
              size="lg"
              style={styles.halfButton}
            />
            <Button
              title={currentDocIndex < DOCUMENT_TYPES.length - 1 ? t('common.next') : t('kyc.submit')}
              onPress={handleConfirm}
              size="lg"
              style={styles.halfButton}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Uploading step
  if (step === 'uploading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.uploadingIcon}>
            <Ionicons name="cloud-upload" size={64} color={COLORS.primary} />
          </View>
          <Text style={styles.uploadingTitle}>{t('kyc.uploading')}</Text>
          <Text style={styles.uploadingDesc}>{t('kyc.uploadingDesc')}</Text>
          <ProgressBar progress={0} height={8} style={styles.uploadProgress} />
        </View>
      </SafeAreaView>
    );
  }

  // Complete step
  if (step === 'complete') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
          </View>
          <Text style={styles.successTitle}>{t('kyc.submitted')}</Text>
          <Text style={styles.successDesc}>{t('kyc.submittedDesc')}</Text>
          <Badge label={t('kyc.statusPending')} variant="warning" />
          <Button
            title={t('common.done')}
            onPress={handleFinish}
            size="lg"
            style={styles.doneButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

function TipItem({ text }: { text: string }) {
  return (
    <View style={styles.tipItem}>
      <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
      <Text style={styles.tipText}>{text}</Text>
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
  statusCard: {
    backgroundColor: '#fef3c7',
    marginBottom: SPACING.lg,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  statusDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  instructionsCard: {
    marginBottom: SPACING.lg,
  },
  instructionsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  documentList: {
    gap: SPACING.md,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  documentHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.border,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  tipsCard: {
    marginBottom: SPACING.lg,
  },
  tipsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  tipsList: {
    gap: SPACING.sm,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  tipText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
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
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  halfButton: {
    flex: 1,
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  cameraBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraProgress: {
    flex: 1,
    marginHorizontal: SPACING.md,
  },
  cameraStepText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  progressBar: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  cameraTitle: {
    color: '#fff',
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    marginBottom: SPACING.xl,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  captureFrame: {
    width: '90%',
    aspectRatio: 1.6,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
    borderStyle: 'dashed',
  },
  selfieFrame: {
    width: 250,
    aspectRatio: 1,
    borderRadius: 125,
  },
  cameraHint: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    marginTop: SPACING.xl,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.xl,
    paddingBottom: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
  },
  // Review styles
  reviewContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  progressSection: {
    marginBottom: SPACING.lg,
  },
  reviewLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  imageContainer: {
    flex: 1,
    backgroundColor: COLORS.border,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  reviewHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  // Center content styles
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  uploadingIcon: {
    marginBottom: SPACING.lg,
  },
  uploadingTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  uploadingDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  uploadProgress: {
    width: '100%',
  },
  successIcon: {
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  successDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  doneButton: {
    width: '100%',
    marginTop: SPACING.xl,
  },
});
