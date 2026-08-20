import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface KeyValueStorage {
  getItem(name: string): Promise<string | null>;
  setItem(name: string, value: string): Promise<void>;
  removeItem(name: string): Promise<void>;
}

/**
 * Auth-store storage adapter (hand-rolled, not zustand's `persist`
 * middleware — see auth.store.ts's header comment for why). Native
 * (iOS/Android) uses expo-secure-store (Keychain/Keystore) — this app's
 * auth store holds a real bearer token. Web has no SecureStore
 * implementation at all (confirmed live: `ExpoSecureStore.default.
 * setValueWithKeyAsync is not a function`, a hard crash on first login) —
 * falls back to AsyncStorage there, which itself is just a `localStorage`
 * wrapper on web, matching the browser's own real security ceiling
 * (there's no OS keychain to defer to in a browser tab either way).
 */
export const secureStorage: KeyValueStorage = Platform.select({
  web: {
    getItem: (name) => AsyncStorage.getItem(name),
    setItem: (name, value) => AsyncStorage.setItem(name, value),
    removeItem: (name) => AsyncStorage.removeItem(name),
  },
  default: {
    getItem: (name) => SecureStore.getItemAsync(name),
    setItem: (name, value) => SecureStore.setItemAsync(name, value),
    removeItem: (name) => SecureStore.deleteItemAsync(name),
  },
}) as KeyValueStorage;
