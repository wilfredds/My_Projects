import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { getSession, setPlayerPaid, deleteSession } from "@/lib/api";
import { computeTotals } from "@/lib/calc";
import { formatMoney } from "@/lib/currencies";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Pencil, Trash2, Copy, Share2, MapPin, Calendar, CheckCircle2 } from "lucide-react";

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);

  useEffect(() => {
    getSession(id).then(setSession).catch(() => { toast.error("Session not found"); navigate("/"); });
  }, [id, navigate]);

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 max-w-2xl mx-auto px-4 pt-24 space-y-3">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const t = computeTotals(session);
  const pct = t.numPlayers > 0 ? Math.round((t.paidCount / t.numPlayers) * 100) : 0;

  const togglePaid = async (playerId, paid) => {
    setSession((s) => ({ ...s, players: s.players.map((p) => p.id === playerId ? { ...p, paid } : p) }));
    try {
      await setPlayerPaid(id, playerId, paid);
    } catch {
      toast.error("Could not update");
      setSession((s) => ({ ...s, players: s.players.map((p) => p.id === playerId ? { ...p, paid: !paid } : p) }));
    }
  };

  const shareUrl = `${window.location.origin}/summary/${id}`;

  const copyText = () => {
    const lines = [
      `🏸 ${session.venue} — ${session.date}`,
      `Each pays ${formatMoney(t.perPlayerShare, session.currency)} (${formatMoney(t.courtPortion, session.currency)} court + ${formatMoney(t.shuttlePortion, session.currency)} shuttle)`,
      ``,
      ...session.players.map((p) => `${p.paid ? "✅" : "⬜"} ${p.name} — ${formatMoney(t.perPlayerShare, session.currency)}`),
      ``,
      `Collected ${formatMoney(t.collected, session.currency)} / ${formatMoney(t.totalCost, session.currency)}`,
      session.payment_note ? `\n${session.payment_note}` : ``,
      `\nView: ${shareUrl}`,
    ].join("\n");
    navigator.clipboard.writeText(lines);
    toast.success("Summary copied — paste into your group chat");
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `CourtSplit — ${session.venue}`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied");
      }
    } catch { /* cancelled */ }
  };

  const remove = async () => {
    await deleteSession(id);
    toast.success("Session deleted");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium" data-testid="back-button">
            <ArrowLeft className="w-5 h-5" /> Back
          </Link>
          <Brand />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-28 pt-6 space-y-5">
        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-rise">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-heading font-black text-2xl text-slate-900 truncate">{session.venue}</h1>
              <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{session.date}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{t.numPlayers} players</span>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button variant="outline" size="icon" className="rounded-xl" data-testid="edit-session-button" onClick={() => navigate(`/sessions/${id}/edit`)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-xl text-red-600 hover:text-red-700" data-testid="delete-session-button">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                    <AlertDialogDescription>This can't be undone. The roster and payment status will be removed.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="cancel-delete-button">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-button">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Per player */}
          <div className="mt-4 rounded-xl bg-slate-900 text-white p-4 court-lines overflow-hidden">
            <div className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">Each player pays</div>
            <div className="font-mono-num font-black text-3xl mt-1">{formatMoney(t.perPlayerShare, session.currency)}</div>
            <div className="text-xs text-white/60 mt-1">
              {formatMoney(t.courtPortion, session.currency)} court + {formatMoney(t.shuttlePortion, session.currency)} shuttle
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-emerald-700 font-semibold">Collected <span data-testid="summary-collected-amount" className="font-mono-num">{formatMoney(t.collected, session.currency)}</span></span>
              <span className="text-amber-700 font-semibold">Outstanding <span data-testid="summary-outstanding-amount" className="font-mono-num">{formatMoney(t.outstanding, session.currency)}</span></span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} data-testid="payment-progress-bar" />
            </div>
            <div className="text-xs text-slate-400 mt-1.5">{t.paidCount} of {t.numPlayers} paid · {pct}%</div>
          </div>
        </div>

        {/* Roster */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-rise">
          <div className="px-5 py-3 border-b border-slate-100 font-heading font-bold text-slate-900">Roster</div>
          <div className="divide-y divide-slate-100">
            {session.players.map((p) => (
              <div key={p.id} data-testid={`player-row-${p.id}`} className={`flex items-center justify-between px-5 py-4 transition-colors ${p.paid ? "bg-emerald-50/40" : ""}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full grid place-items-center font-heading font-bold text-sm shrink-0 ${p.paid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                    <div className="font-mono-num text-sm text-slate-500">{formatMoney(t.perPlayerShare, session.currency)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span data-testid={`badge-paid-status-${p.id}`} className={`text-xs font-bold uppercase tracking-wide ${p.paid ? "text-emerald-600" : "text-slate-400"}`}>
                    {p.paid ? "Paid" : "Unpaid"}
                  </span>
                  <Switch
                    data-testid={`toggle-paid-status-${p.id}`}
                    checked={p.paid}
                    onCheckedChange={(v) => togglePaid(p.id, v)}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="rounded-xl h-12 font-semibold gap-2" data-testid="btn-copy-summary-text" onClick={copyText}>
            <Copy className="w-4 h-4" /> Copy text
          </Button>
          <Button variant="outline" className="rounded-xl h-12 font-semibold gap-2" data-testid="btn-share-summary-link" onClick={shareLink}>
            <Share2 className="w-4 h-4" /> Share link
          </Button>
        </div>
        <Button asChild className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold gap-2" data-testid="open-summary-button">
          <Link to={`/summary/${id}`}><CheckCircle2 className="w-5 h-5" /> Open shareable summary</Link>
        </Button>
      </main>
    </div>
  );
}
