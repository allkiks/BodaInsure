import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from './api/client';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationToken {
  token: string;
  platform: 'ios' | 'android';
}

class NotificationService {
  private static instance: NotificationService;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Register for push notifications and get the device token
   */
  async registerForPushNotifications(): Promise<PushNotificationToken | null> {
    // Check if we're on a physical device
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get the Expo push token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const platform = Platform.OS === 'ios' ? 'ios' : 'android';

      // Configure Android channel
      if (Platform.OS === 'android') {
        await this.configureAndroidChannel();
      }

      return {
        token: token.data,
        platform,
      };
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  /**
   * Configure Android notification channel
   */
  private async configureAndroidChannel(): Promise<void> {
    // Main channel for general notifications
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16a34a',
    });

    // Payment channel
    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Payments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16a34a',
      description: 'Notifications about payments and wallet balance',
    });

    // Policy channel
    await Notifications.setNotificationChannelAsync('policies', {
      name: 'Policies',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16a34a',
      description: 'Notifications about your insurance policies',
    });

    // Reminders channel
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Payment Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f59e0b',
      description: 'Daily payment reminders',
    });
  }

  /**
   * Register device token with the server
   */
  async registerTokenWithServer(tokenData: PushNotificationToken): Promise<void> {
    try {
      await apiClient.post('/notifications/register-device', {
        token: tokenData.token,
        platform: tokenData.platform,
        deviceId: Constants.deviceId,
      });
      console.log('Device token registered with server');
    } catch (error) {
      console.error('Failed to register token with server:', error);
    }
  }

  /**
   * Unregister device token from the server
   */
  async unregisterTokenFromServer(): Promise<void> {
    try {
      await apiClient.post('/notifications/unregister-device', {
        deviceId: Constants.deviceId,
      });
      console.log('Device token unregistered from server');
    } catch (error) {
      console.error('Failed to unregister token from server:', error);
    }
  }

  /**
   * Initialize notification listeners
   */
  initializeListeners(
    onNotification?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ): void {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        onNotification?.(notification);
      }
    );

    // Listener for user interactions with notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
        onNotificationResponse?.(response);
        this.handleNotificationResponse(response);
      }
    );
  }

  /**
   * Handle notification response (user tapped notification)
   */
  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data;

    // Navigate based on notification type
    if (data?.type) {
      switch (data.type) {
        case 'payment_success':
        case 'payment_failed':
        case 'payment_reminder':
          // Navigate to wallet screen
          // router.push('/(tabs)/wallet');
          break;
        case 'policy_issued':
        case 'policy_expiring':
          // Navigate to policy screen
          // router.push('/(tabs)/policy');
          break;
        case 'kyc_approved':
        case 'kyc_rejected':
          // Navigate to KYC screen
          // router.push('/kyc');
          break;
        default:
          // Navigate to home
          // router.push('/(tabs)/home');
          break;
      }
    }
  }

  /**
   * Remove notification listeners
   */
  removeListeners(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  /**
   * Schedule a local notification
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: trigger ?? null, // null = immediate
    });
    return id;
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllScheduledNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get all pending scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Set badge count (iOS only)
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Get badge count (iOS only)
   */
  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  /**
   * Dismiss all notifications from notification center
   */
  async dismissAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }
}

export const notificationService = NotificationService.getInstance();
