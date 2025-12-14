import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { notificationService } from '@/services/notifications';
import { useAuthStore } from '@/store/authStore';

interface UseNotificationsOptions {
  onNotification?: (notification: Notifications.Notification) => void;
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void;
}

export function useNotifications(options?: UseNotificationsOptions) {
  const { isAuthenticated } = useAuthStore();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Register for push notifications
    const registerPushNotifications = async () => {
      const tokenData = await notificationService.registerForPushNotifications();

      if (tokenData) {
        setExpoPushToken(tokenData.token);
        setPermissionGranted(true);

        // Register token with backend
        await notificationService.registerTokenWithServer(tokenData);
      } else {
        setPermissionGranted(false);
      }
    };

    registerPushNotifications();

    // Initialize notification listeners
    notificationService.initializeListeners(
      (notification) => {
        options?.onNotification?.(notification);
        handleNotification(notification);
      },
      (response) => {
        options?.onNotificationResponse?.(response);
        handleNotificationResponse(response);
      }
    );

    // Handle app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - clear badge
        notificationService.setBadgeCount(0);
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      notificationService.removeListeners();
      subscription.remove();
    };
  }, [isAuthenticated]);

  const handleNotification = (notification: Notifications.Notification) => {
    // Handle incoming notification while app is in foreground
    const data = notification.request.content.data;
    console.log('Received notification:', data);
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    // Handle user tapping on notification
    const data = response.notification.request.content.data;

    if (data?.type) {
      switch (data.type) {
        case 'payment_success':
        case 'payment_failed':
        case 'payment_reminder':
          router.push('/(tabs)/wallet');
          break;
        case 'policy_issued':
        case 'policy_expiring':
          router.push('/(tabs)/policy');
          break;
        case 'kyc_approved':
        case 'kyc_rejected':
          router.push('/kyc');
          break;
        default:
          router.push('/(tabs)/home');
          break;
      }
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    const tokenData = await notificationService.registerForPushNotifications();
    if (tokenData) {
      setExpoPushToken(tokenData.token);
      setPermissionGranted(true);
      await notificationService.registerTokenWithServer(tokenData);
      return true;
    }
    setPermissionGranted(false);
    return false;
  };

  const schedulePaymentReminder = async (daysRemaining: number): Promise<string | null> => {
    if (!permissionGranted) return null;

    // Schedule daily reminder at 8 AM
    const trigger = {
      hour: 8,
      minute: 0,
      repeats: true,
    };

    const id = await notificationService.scheduleLocalNotification(
      'Payment Reminder',
      `You have ${daysRemaining} days left to complete your 30-day payment plan.`,
      { type: 'payment_reminder', daysRemaining },
      trigger
    );

    return id;
  };

  return {
    expoPushToken,
    permissionGranted,
    requestPermission,
    schedulePaymentReminder,
    scheduleLocalNotification: notificationService.scheduleLocalNotification.bind(notificationService),
    cancelScheduledNotification: notificationService.cancelScheduledNotification.bind(notificationService),
    cancelAllScheduledNotifications: notificationService.cancelAllScheduledNotifications.bind(notificationService),
  };
}
