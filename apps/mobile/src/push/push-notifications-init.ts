import * as Notifications from 'expo-notifications';

/** Side-effect: configure foreground presentation (never claims delivered). */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
