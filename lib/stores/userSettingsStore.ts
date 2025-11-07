import { create } from "zustand";

type UserSettingsState = {
  emailNotificationsEnabled: boolean | null; // null = noch nicht geladen
  setEmailNotifications: (value: boolean) => void;
};

export const useUserSettings = create<UserSettingsState>((set) => ({
  emailNotificationsEnabled: null,
  setEmailNotifications: (value: boolean) => set({ emailNotificationsEnabled: value }),
}));
