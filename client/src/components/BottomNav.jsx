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
export default function BottomNav({ onAddPress, anyModalOpen = false }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const tabs = [
    {
      id: 'more',
      label: 'עוד',
      path: '/more',
      icon: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
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
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
          <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/>
          <path d="M2 21h20"/><path d="M7 8v2M12 8v2M17 8v2"/><path d="M7 4h.01M12 3h.01M17 4h.01"/>
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
      {/* ── Floating Action Button ─────────────────────────────────────────── */}
      {/* Hidden (opacity + pointer-events) when any modal is open so it doesn't */}
      {/* bleed through the bottom-sheet overlay. CSS transition keeps it smooth. */}
      <button
        className={`fab transition-opacity duration-200
                    ${anyModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onClick={onAddPress}
        aria-label="הוסף תזכורת חדשה"
        id="fab-add-reminder"
        aria-hidden={anyModalOpen}
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
