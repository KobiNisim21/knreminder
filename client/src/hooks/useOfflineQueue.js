import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPendingActions, clearFailedActions } from '../utils/offlineStore';
import { queueEventTarget, processQueue } from '../utils/offlineQueue';
import { useNetworkStatus } from './useNetworkStatus';

export function useOfflineQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();

  const loadQueueState = useCallback(async () => {
    const actions = await getPendingActions();
    
    let pending = 0;
    let failed = 0;
    let syncing = false;
    
    for (const a of actions) {
      if (a.status === 'failed') failed++;
      else {
        pending++;
        if (a.status === 'syncing') syncing = true;
      }
    }
    
    setPendingCount(pending);
    setFailedCount(failed);
    setIsSyncing(syncing);
  }, []);

  useEffect(() => {
    // Initial load
    loadQueueState();

    // Listen for updates from the processor
    const onUpdate = () => loadQueueState();
    queueEventTarget.addEventListener('sync-update', onUpdate);
    
    return () => queueEventTarget.removeEventListener('sync-update', onUpdate);
  }, [loadQueueState]);

  // Auto-sync when coming back online or from SW message
  useEffect(() => {
    if (isOnline) {
      processQueue(queryClient);
    }
    
    const handleMessage = (event) => {
      if (event.data?.type === 'SYNC_NOW') {
        processQueue(queryClient);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, [isOnline, queryClient]);

  const syncNow = useCallback(() => {
    processQueue(queryClient);
  }, [queryClient]);
  
  const clearFailed = useCallback(async () => {
    await clearFailedActions();
    loadQueueState();
  }, [loadQueueState]);

  return {
    pendingCount,
    failedCount,
    isSyncing,
    syncNow,
    clearFailed
  };
}
