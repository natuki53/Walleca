export interface UserSettings {
  timezone: string;
  subscriptionNotificationEnabled: boolean;
  subscriptionNotificationDaysBefore: number;
}

export interface UpdateUserSettingsInput {
  timezone?: string;
  subscriptionNotificationEnabled?: boolean;
  subscriptionNotificationDaysBefore?: number;
}
