export default function PendingSyncBadge() {
  return (
    <div 
      className="flex items-center justify-center text-blue-500 bg-blue-50 rounded-full w-5 h-5"
      title="ממתין לסנכרון"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        <path d="M12 12v6" />
        <path d="m9 15 3-3 3 3" />
      </svg>
    </div>
  );
}
