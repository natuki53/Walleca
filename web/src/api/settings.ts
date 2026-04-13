import { apiClient } from './client';
import { ApiResponse } from '@/types/api';
import { UpdateUserSettingsInput, UserSettings } from '@/types/settings';

export const settingsApi = {
  get: async (): Promise<ApiResponse<UserSettings>> => {
    const response = await apiClient.get('/settings');
    return response.data;
  },

  update: async (input: UpdateUserSettingsInput): Promise<ApiResponse<UserSettings>> => {
    const response = await apiClient.patch('/settings', input);
    return response.data;
  },
};
