import { Link } from "react-router-dom";

export function ShuttleIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.5c1.6 2.2 2.6 5 3 8.2M12 2.5c-1.6 2.2-2.6 5-3 8.2M12 2.5c.9 2.6 1.3 5.5 1.4 8.4M12 2.5c-.9 2.6-1.3 5.5-1.4 8.4"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8.2 11c-.9.5-1.5 1.5-1.5 2.7 0 2.9 2.4 5.3 5.3 5.3s5.3-2.4 5.3-5.3c0-1.2-.6-2.2-1.5-2.7"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.14" />
      <circle cx="12" cy="16" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function Brand({ className = "", onDark = false }) {
  return (
    <Link to="/" data-testid="nav-home-link" className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`grid place-items-center w-9 h-9 rounded-xl ${onDark ? "bg-white/15 text-white" : "bg-emerald-600 text-white"} shadow-sm`}>
        <ShuttleIcon className="w-5 h-5" />
      </span>
      <span className={`font-heading font-extrabold text-lg tracking-tight ${onDark ? "text-white" : "text-slate-900"}`}>
        Court<span className="text-emerald-500">Split</span>
      </span>
    </Link>
  );
}
