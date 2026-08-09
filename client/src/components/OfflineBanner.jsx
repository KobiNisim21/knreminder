import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

export default function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const { pendingCount, isSyncing, failedCount, syncNow } = useOfflineQueue();

  if (isOnline && pendingCount === 0 && failedCount === 0) return null;

  return (
    <div className="sticky top-0 z-50 w-full animate-in slide-in-from-top-full duration-300">
      {!isOnline ? (
        <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-2">
          <span className="text-amber-600">📡</span>
          <p className="text-[13px] font-medium text-amber-800">
            אין חיבור לאינטרנט — עובד במצב אופליין
          </p>
          {pendingCount > 0 && (
            <span className="text-[11px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full mr-2">
              {pendingCount} ממתין
            </span>
          )}
        </div>
      ) : isSyncing ? (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[13px] font-medium text-blue-800">
            מסנכרן שינויים ({pendingCount})...
          </p>
        </div>
      ) : failedCount > 0 ? (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <p className="text-[13px] font-medium text-red-800">
              {failedCount} פעולות נכשלו בסנכרון
            </p>
          </div>
          <button 
            onClick={syncNow}
            className="text-[12px] bg-red-100 text-red-800 px-3 py-1 rounded-full active:bg-red-200"
          >
            נסה שוב
          </button>
        </div>
      ) : null}
    </div>
  );
}
