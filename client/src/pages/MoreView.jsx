import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

/**
 * MoreView — The "יותר" (More) tab.
 *
 * A clean iOS-style grouped list menu:
 *   • Go PRO! banner (placeholder marketing row)
 *   • Settings           (placeholder)
 *   • Completed          → links to /completed (existing archive)
 *   • Backup and restore (placeholder)
 *   • Enable sync        (placeholder marketing row)
 *   • Priority support   (placeholder, PRO)
 *   • About app          (placeholder)
 *
 * Rows without a destination surface a lightweight "coming soon" note so the
 * menu never feels like a set of dead links.
 */
export default function MoreView() {
  const navigate = useNavigate();

  const groups = [
    {
      items: [
        {
          id: 'settings',
          label: 'הגדרות',
          onClick: () => comingSoon('הגדרות'),
        },
        {
          id: 'completed',
          label: 'הושלמו',
          onClick: () => navigate('/completed'),
        },
        {
          id: 'backup',
          label: 'גיבוי ושחזור',
          onClick: () => comingSoon('גיבוי ושחזור'),
        },
      ],
    },
    {
      items: [
        {
          id: 'support',
          label: 'תמיכה מועדפת',
          trailing: <span className="text-accent font-semibold text-sm">PRO</span>,
          onClick: () => comingSoon('תמיכה מועדפת'),
        },
        {
          id: 'about',
          label: 'אודות האפליקציה',
          onClick: () => showAbout(),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-surface border-b border-divider px-4 sticky top-0 z-20 pt-safe">
        <div className="flex items-center justify-center h-14">
          <h1 className="text-lg font-semibold text-textPrimary">עוד</h1>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 scroll-container momentum-scroll scrollbar-hide">

        {/* Go PRO banner */}
        <div className="text-center py-4">
          <button
            onClick={() => comingSoon('שדרוג ל-PRO')}
            className="text-accent font-semibold text-[15px] active:opacity-60"
          >
            שדרג ל-PRO!
          </button>
        </div>

        {groups.map((group, gi) => (
          <div key={gi} className="mb-4">
            <div className="bg-surface border-y border-divider">
              {group.items.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`w-full flex items-center justify-between px-5 py-3.5
                              text-right active:bg-gray-50 transition-colors
                              ${idx > 0 ? 'border-t border-divider' : ''}`}
                >
                  <span className="text-[16px] text-textPrimary">{item.label}</span>
                  <span className="flex items-center gap-2">
                    {item.trailing}
                    <ChevronIcon />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Enable sync marketing row */}
        <div className="text-center py-2">
          <button
            onClick={() => comingSoon('סנכרון')}
            className="text-accent font-semibold text-[15px] active:opacity-60"
          >
            הפעל סנכרון
          </button>
        </div>

        {/* Version footer */}
        <p className="text-center text-xs text-textDisabled py-6">KN Reminder · v1.0.0</p>
      </main>

      <BottomNav onAddPress={() => navigate('/')} anyModalOpen={false} />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function comingSoon(feature) {
  // Lightweight placeholder feedback — replace with a real screen / toast later.
  window.alert(`${feature} — בקרוב`);
}

function showAbout() {
  window.alert(
    'KN Reminder\nגרסה 1.0.0\n\nאפליקציית תזכורות אישית עם אינטגרציית טלגרם.'
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon() {
  // In RTL the disclosure chevron points left.
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
