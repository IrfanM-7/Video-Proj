import { useState } from 'react';

export const DEFAULT_SETTINGS = {
  maxClips: 4,
  enableAudio: true,
  defaultAspect: '16:9',
};

const STORAGE_KEY = 'clipstudio_settings';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useAppSettings() {
  const [settings, setSettings] = useState(loadSettings);
  const persist = (next) => {
    setSettings(next);
    saveSettings(next);
  };
  return [settings, persist];
}

