import { QueryClient, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

onlineManager.setEventListener((setOnline) => {
  const subscription = Network.addNetworkStateListener((state) => {
    setOnline(state.isConnected === true && state.isInternetReachable !== false);
  });
  return () => subscription.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'online',
      retry: 2,
      staleTime: 30_000,
    },
    mutations: {
      networkMode: 'online',
      retry: 3,
    },
  },
});
