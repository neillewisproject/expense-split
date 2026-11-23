import './crypto-polyfill';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import type { Database } from './supabase.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const secureStorage: SupportedStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

let client: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured(): boolean {
  // Avoid `new URL()` here: React Native's URL implementation can throw on property access.
  return Boolean(supabaseUrl && supabaseKey && /^https?:\/\/[^\s/]+/.test(supabaseUrl));
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabaseKey || !isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured correctly. Copy .env.example to .env and add a valid project URL and publishable key.',
    );
  }

  if (!client) {
    client = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        storage: Platform.OS === 'web' ? AsyncStorage : secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }

  return client;
}
