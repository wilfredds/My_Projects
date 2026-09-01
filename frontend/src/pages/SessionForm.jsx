import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import { createSession, updateSession, getSession, uploadQr, fileUrl } from "@/lib/api";
import { computeTotals } from "@/lib/calc";
import { CURRENCIES, formatMoney, currencySymbol } from "@/lib/currencies";
import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, X, Users, QrCode, Loader2, Trash2 } from "lucide-react";

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

export default function SessionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const editing = Boolean(id);
  const clone = location.state?.clone;

  const [venue, setVenue] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState("PHP");
  const [courtFee, setCourtFee] = useState("");
  const [numShuttles, setNumShuttles] = useState("");
  const [pricePerShuttle, setPricePerShuttle] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [notes, setNotes] = useState("");
  const [qrPath, setQrPath] = useState("");
  const [uploadingQr, setUploadingQr] = useState(false);
  const [players, setPlayers] = useState([]);
  const [playerName, setPlayerName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      getSession(id).then((s) => {
        setVenue(s.venue);
        setDate(s.date);
        setCurrency(s.currency || "PHP");
        setCourtFee(String(s.court_fee ?? ""));
        setNumShuttles(String(s.num_shuttles ?? ""));
        setPricePerShuttle(String(s.price_per_shuttle ?? ""));
        setPaymentNote(s.payment_note || "");
        setNotes(s.notes || "");
        setQrPath(s.payment_qr_path || "");
        setPlayers(s.players || []);
      }).catch(() => toast.error("Could not load session"));
    } else if (clone) {
      setVenue(clone.venue || "");
      setCurrency(clone.currency || "PHP");
      setCourtFee(String(clone.court_fee ?? ""));
      setNumShuttles(String(clone.num_shuttles ?? ""));
      setPricePerShuttle(String(clone.price_per_shuttle ?? ""));
      setPaymentNote(clone.payment_note || "");
      setNotes(clone.notes || "");
      setQrPath(clone.payment_qr_path || "");
      setPlayers((clone.players || []).map((p) => ({ name: p.name, paid: false })));
      toast.success("Copied from previous session — set the date and save");
    }
  }, [id, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const { path } = await uploadQr(file);
      setQrPath(path);
      toast.success("QR uploaded");
    } catch {
      toast.error("Could not upload image");
    } finally {
      setUploadingQr(false);
      e.target.value = "";
    }
  };

  const draft = {
    court_fee: courtFee,
    num_shuttles: numShuttles,
    price_per_shuttle: pricePerShuttle,
    players,
  };
  const t = computeTotals(draft);

  const addPlayer = () => {
    const name = playerName.trim();
    if (!name) return;
    setPlayers((p) => [...p, { name, paid: false }]);
    setPlayerName("");
  };

  const removePlayer = (idx) => setPlayers((p) => p.filter((_, i) => i !== idx));

  const save = async () => {
    if (!venue.trim()) return toast.error("Add a venue name");
    if (players.length === 0) return toast.error("Add at least one player");
    setSaving(true);
    const payload = {
      venue: venue.trim(),
      date,
      currency,
      court_fee: Number(courtFee) || 0,
      num_shuttles: Number(numShuttles) || 0,
      price_per_shuttle: Number(pricePerShuttle) || 0,
      payment_note: paymentNote.trim(),
      payment_qr_path: qrPath,
      notes: notes.trim(),
      players: players.map((p) => ({ id: p.id, name: p.name, paid: p.paid })),
    };
    try {
      const res = editing ? await updateSession(id, payload) : await createSession(payload);
      toast.success(editing ? "Session updated" : "Session created");
      navigate(`/sessions/${res.id}`);
    } catch (e) {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={editing ? `/sessions/${id}` : "/"} className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium" data-testid="back-button">
            <ArrowLeft className="w-5 h-5" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Brand />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-44 pt-6">
        <h1 className="font-heading font-black text-3xl tracking-tight text-slate-900 dark:text-white animate-rise">
          {editing ? "Edit session" : clone ? "Repeat session" : "New session"}
        </h1>

        <form data-testid="new-session-form" className="mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <Field label="Venue">
              <Input data-testid="input-session-venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Smash Arena Court 3" className="rounded-xl h-11" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date">
                <Input data-testid="input-session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl h-11" />
              </Field>
              <Field label="Currency">
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger data-testid="select-currency" className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h2 className="font-heading font-bold text-lg text-slate-900 dark:text-white">Costs</h2>
            <Field label={`Court fee (${currencySymbol(currency)})`} hint="Total court booking cost">
              <Input data-testid="input-court-fee" inputMode="decimal" value={courtFee} onChange={(e) => setCourtFee(e.target.value)} placeholder="0.00" className="rounded-xl h-11 font-mono-num" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Shuttles used">
                <Input data-testid="input-shuttle-count" inputMode="numeric" value={numShuttles} onChange={(e) => setNumShuttles(e.target.value)} placeholder="0" className="rounded-xl h-11 font-mono-num" />
              </Field>
              <Field label={`Price / shuttle (${currencySymbol(currency)})`}>
                <Input data-testid="input-shuttle-price" inputMode="decimal" value={pricePerShuttle} onChange={(e) => setPricePerShuttle(e.target.value)} placeholder="0.00" className="rounded-xl h-11 font-mono-num" />
              </Field>
            </div>
            <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Shuttle cost</span>
              <span data-testid="live-total-shuttle-cost" className="font-mono-num font-bold text-slate-900 dark:text-white">{formatMoney(t.totalShuttleCost, currency)}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2"><Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Players</h2>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{players.length}</span>
            </div>
            <div className="flex gap-2">
              <Input
                data-testid="input-player-name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPlayer(); } }}
                placeholder="Player name"
                className="rounded-xl h-11"
              />
              <Button type="button" data-testid="add-player-button" onClick={addPlayer} className="rounded-xl h-11 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {players.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {players.map((p, i) => (
                  <span key={i} data-testid={`player-chip-${i}`} className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-900 rounded-full pl-3 pr-1.5 py-1.5 text-sm font-medium">
                    {p.name}
                    <button type="button" onClick={() => removePlayer(i)} className="w-5 h-5 grid place-items-center rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors" data-testid={`remove-player-${i}`}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <Field label="Note (optional)" hint="A short note shown on the shareable summary — e.g. Next week same time">
              <Input data-testid="input-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Next week same time 🏸" className="rounded-xl h-11" maxLength={140} />
            </Field>
            <Field label="Payment note (optional)" hint="Shown on the shareable page — e.g. GCash / Maya / bank details">
              <Textarea data-testid="input-payment-note" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="GCash: 0917 123 4567 (Juan D.)" className="rounded-xl min-h-[72px]" />
            </Field>
            <Field label="Payment QR (optional)" hint="Upload your GCash / Maya QR so players can scan and pay from the shareable page">
              {qrPath ? (
                <div className="flex items-center gap-3">
                  <img src={fileUrl(qrPath)} alt="Payment QR" data-testid="qr-preview" className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-white" />
                  <Button type="button" variant="outline" data-testid="remove-qr-button" onClick={() => setQrPath("")} className="rounded-xl gap-1.5 text-red-600 dark:text-red-400">
                    <Trash2 className="w-4 h-4" /> Remove
                  </Button>
                </div>
              ) : (
                <label data-testid="qr-upload-label" className="flex items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                  {uploadingQr ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                  <span className="font-medium">{uploadingQr ? "Uploading..." : "Tap to upload QR image"}</span>
                  <input type="file" accept="image/*" className="hidden" data-testid="input-qr-file" onChange={handleQrUpload} disabled={uploadingQr} />
                </label>
              )}
            </Field>
          </div>
        </form>
      </main>

      {/* Live sticky footer */}
      <div className="fixed bottom-0 inset-x-0 z-30">
        <div className="max-w-2xl mx-auto px-4 pb-4">
          <div className="rounded-2xl bg-slate-900 text-white shadow-2xl p-4 court-lines overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">Each player pays</div>
                <div data-testid="live-per-player-share" className="font-mono-num font-black text-3xl leading-none mt-1">
                  {formatMoney(t.perPlayerShare, currency)}
                </div>
                <div className="text-xs text-white/60 mt-1">
                  <span data-testid="live-court-portion">{formatMoney(t.courtPortion, currency)}</span> court
                  {" + "}
                  <span data-testid="live-shuttle-portion">{formatMoney(t.shuttlePortion, currency)}</span> shuttle
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">Total</div>
                <div data-testid="live-total-session-cost" className="font-mono-num font-bold text-lg">{formatMoney(t.totalCost, currency)}</div>
                <div className="text-xs text-white/50">{t.numPlayers} player{t.numPlayers === 1 ? "" : "s"}</div>
              </div>
            </div>
            <Button
              data-testid="submit-session-button"
              onClick={save}
              disabled={saving}
              className="w-full mt-4 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-base"
            >
              {saving ? "Saving..." : editing ? "Save changes" : "Create session"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
