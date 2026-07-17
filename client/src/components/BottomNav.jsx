import { useNavigate, useLocation } from 'react-router-dom';

/**
 * BottomNav — Fixed 5-tab bar replicating BZ Reminder's bottom navigation.
 *
 * Layout (RTL):
 *   [ תזכורות 🔔 ] [ ימי הולדת 🎂 ] [ + FAB ] [ לוח שנה 📅 ] [ יותר ☰ ]
 *
 * The red FAB (floating action button) sits in the center and is
 * absolutely positioned above the nav bar. Clicking it calls onAddPress.
 */
export default function BottomNav({ onAddPress }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const tabs = [
    {
      id: 'more',
      label: 'יותר',
      path: null,
      icon: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
      ),
    },
    {
      id: 'calendar',
      label: 'לוח שנה',
      path: '/calendar',
      icon: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 3h-1V1h-2v2H7V1H5v2H4C2.9 3 2 3.9 2 5v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13zM8 10H6v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H6v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
        </svg>
      ),
    },
    // Center slot — FAB occupies this space
    null,
    {
      id: 'birthdays',
      label: 'ימי הולדת',
      path: '/birthdays',
      icon: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 6c1.11 0 2-.89 2-2 0-.36-.1-.69-.26-.98L12 0l-1.74 3.02c-.16.29-.26.62-.26.98 0 1.11.89 2 2 2zm4.6 9.99l-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 17.64 5.88 18 4.96 18c-.73 0-1.4-.23-1.96-.61V20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9H6c-1.1 0-2 .9-2 2v2.45c.58.55 1.35.87 2.17.87.79 0 1.58-.32 2.17-.99l1.08-1.1 1.07 1.09c1.17 1.17 3.22 1.18 4.4 0l1.07-1.09 1.08 1.09c.59.67 1.38.99 2.17.99.82 0 1.59-.32 2.17-.87V11c0-1.1-.9-2-2-2z"/>
        </svg>
      ),
    },
    {
      id: 'reminders',
      label: 'תזכורות',
      path: '/',
      icon: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* ── Floating Action Button (red "+") ────────────────────────────── */}
      <button
        className="fab"
        onClick={onAddPress}
        aria-label="הוסף תזכורת חדשה"
        id="fab-add-reminder"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* ── Bottom tab bar ─────────────────────────────────────────────── */}
      <nav className="bottom-nav" role="navigation" aria-label="ניווט ראשי">
        {tabs.map((tab, index) => {
          // Center slot — empty spacer for FAB
          if (tab === null) {
            return <div key="fab-slot" className="flex-1" aria-hidden="true" />;
          }

          const isActive = tab.path === '/'
            ? pathname === '/'
            : tab.path && pathname.startsWith(tab.path);

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              className={`bottom-nav-tab ${isActive ? 'active' : ''}`}
              onClick={() => tab.path && navigate(tab.path)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
