export function CurrentDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full overflow-hidden ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 1440 24"
        fill="none"
        preserveAspectRatio="none"
        className="w-full h-6"
      >
        <path
          d="M0 12 C 180 2, 360 22, 540 12 S 900 2, 1080 12 S 1380 22, 1440 12"
          stroke="#D9E5ED"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
