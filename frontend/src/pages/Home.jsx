import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listSessions } from "@/lib/api";
import { computeTotals } from "@/lib/calc";
import { formatMoney } from "@/lib/currencies";
import { Brand, ShuttleIcon } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MapPin, Calendar, Users, ChevronRight, CheckCircle2, AlertCircle, Copy } from "lucide-react";

function StatPill({ label, value, tone }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    slate: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="font-mono-num font-extrabold text-2xl mt-1">{value}</div>
    </div>
  );
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unsettled", label: "Unsettled" },
  { key: "settled", label: "Settled" },
];

export default function Home() {
  const [sessions, setSessions] = useState(null);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    listSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  const isSettled = (s) => {
    const t = computeTotals(s);
    return t.numPlayers > 0 && t.unpaidCount === 0;
  };

  const filtered = (sessions || []).filter((s) => {
    if (filter === "settled") return isSettled(s);
    if (filter === "unsettled") return !isSettled(s);
    return true;
  });

  const cloneSession = (e, s) => {
    e.preventDefault();
    e.stopPropagation();
    navigate("/sessions/new", { state: { clone: s } });
  };

  const totalCollected = (sessions || []).reduce((acc, s) => acc + computeTotals(s).collected, 0);
  const totalOutstanding = (sessions || []).reduce((acc, s) => acc + computeTotals(s).outstanding, 0);
  const primaryCurrency = sessions?.[0]?.currency || "PHP";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header data-testid="app-header" className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              data-testid="nav-new-session-button"
              onClick={() => navigate("/sessions/new")}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 font-semibold gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> New
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-28 pt-6">
        <div className="animate-rise">
          <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tight text-slate-900 dark:text-white">
            Your sessions
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Split court & shuttle costs, track who's paid.</p>
        </div>

        {sessions && sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-6 animate-rise">
            <StatPill label="Sessions" value={sessions.length} tone="slate" />
            <StatPill label="Collected" value={formatMoney(totalCollected, primaryCurrency)} tone="green" />
            <StatPill label="Outstanding" value={formatMoney(totalOutstanding, primaryCurrency)} tone="amber" />
          </div>
        )}

        {sessions && sessions.length > 0 && (
          <div data-testid="session-filters" className="mt-6 inline-flex p-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                data-testid={`filter-${f.key}`}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  filter === f.key
                    ? "bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-3">
          {sessions === null && (
            <>
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </>
          )}

          {sessions && sessions.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 animate-rise">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 grid place-items-center mx-auto">
                <ShuttleIcon className="w-8 h-8" />
              </div>
              <h3 className="font-heading font-bold text-xl mt-4 text-slate-900 dark:text-white">No sessions yet</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">Create your first badminton session and split the bill in under a minute.</p>
              <Button
                data-testid="empty-new-session-button"
                onClick={() => navigate("/sessions/new")}
                className="mt-5 rounded-full bg-emerald-600 hover:bg-emerald-700 font-semibold gap-1.5"
              >
                <Plus className="w-4 h-4" /> New Session
              </Button>
            </div>
          )}

          {sessions && sessions.length > 0 && filtered.length === 0 && (
            <div data-testid="filter-empty" className="text-center py-12 text-slate-500 dark:text-slate-400 animate-rise">
              No {filter} sessions.
            </div>
          )}

          {filtered.map((s, i) => {
            const t = computeTotals(s);
            const settled = t.unpaidCount === 0 && t.numPlayers > 0;
            return (
              <Link
                key={s.id}
                to={`/sessions/${s.id}`}
                data-testid={`session-card-${s.id}`}
                className="block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all animate-rise"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-heading font-bold text-lg truncate">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{s.venue}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                      <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{s.date}</span>
                      <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{t.numPlayers}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0 mt-1" />
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wide">Total</div>
                    <div className="font-mono-num font-extrabold text-xl text-slate-900 dark:text-white">{formatMoney(t.totalCost, s.currency)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {settled ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900">
                        <CheckCircle2 className="w-4 h-4" /> All paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900">
                        <AlertCircle className="w-4 h-4" /> {t.unpaidCount} unpaid
                      </span>
                    )}
                    <button
                      data-testid={`clone-session-${s.id}`}
                      onClick={(e) => cloneSession(e, s)}
                      title="Repeat this session"
                      className="grid place-items-center w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
