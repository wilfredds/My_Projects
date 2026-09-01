import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { getSession, fileUrl } from "@/lib/api";
import { computeTotals } from "@/lib/calc";
import { formatMoney } from "@/lib/currencies";
import { ShuttleIcon } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, CheckCircle2, Clock, Wallet, Download } from "lucide-react";

export default function Summary() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    getSession(id).then(setSession).catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-100 px-6 text-center">
        <div>
          <h1 className="font-heading font-black text-2xl text-slate-900">Session not found</h1>
          <p className="text-slate-500 mt-1">This link may be broken or the session was removed.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-100 px-4">
        <Skeleton className="h-[600px] w-full max-w-[440px] rounded-3xl" />
      </div>
    );
  }

  const t = computeTotals(session);
  const cur = session.currency;

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  };

  const downloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      // Pre-fetch Google Fonts CSS ourselves so html-to-image can embed the
      // brand fonts without hitting cross-origin cssRules SecurityErrors.
      let fontEmbedCSS = "";
      try {
        const fontUrl =
          "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700;800&display=swap";
        fontEmbedCSS = await fetch(fontUrl).then((r) => r.text());
      } catch {
        /* fall back to system fonts if fonts can't be fetched */
      }
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
      });
      const link = document.createElement("a");
      const slug = (session.venue || "courtsplit").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      link.download = `courtsplit-${slug}-${session.date}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Image saved — share it in your group chat");
    } catch (e) {
      toast.error("Could not create image");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 py-6 px-4 flex flex-col items-center">
      <div className="w-full max-w-[440px]">
        <div ref={cardRef} data-testid="shareable-summary-card" className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-rise">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 text-white px-6 pt-7 pb-8 court-lines">
            <div className="relative flex items-center gap-2">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/20"><ShuttleIcon className="w-5 h-5" /></span>
              <span className="font-heading font-extrabold text-lg tracking-tight">CourtSplit</span>
            </div>
            <h1 className="relative font-heading font-black text-3xl leading-tight mt-4">{session.venue}</h1>
            <p className="relative text-white/80 font-medium mt-1">{session.date}</p>

            <div className="relative mt-5 bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="text-[11px] uppercase tracking-wider text-white/80 font-bold">Each player pays</div>
              <div className="font-mono-num font-black text-4xl mt-1">{formatMoney(t.perPlayerShare, cur)}</div>
              <div className="flex gap-2 mt-3">
                <span className="flex-1 rounded-xl bg-white/15 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-white/70 font-bold">Court</div>
                  <div className="font-mono-num font-bold text-base">{formatMoney(t.courtPortion, cur)}</div>
                </span>
                <span className="flex-1 rounded-xl bg-white/15 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-white/70 font-bold">Shuttle</div>
                  <div className="font-mono-num font-bold text-base">{formatMoney(t.shuttlePortion, cur)}</div>
                </span>
              </div>
            </div>
          </div>

          {/* Roster */}
          <div className="px-6 pt-5">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Who owes what</div>
            <div className="divide-y divide-slate-100">
              {session.players.map((p) => (
                <div key={p.id} data-testid={`summary-player-${p.id}`} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full grid place-items-center font-heading font-bold text-sm shrink-0 ${p.paid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                      <div className="text-xs text-slate-400 font-mono-num">
                        {formatMoney(t.courtPortion, cur)} + {formatMoney(t.shuttlePortion, cur)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono-num font-extrabold text-slate-900">{formatMoney(t.perPlayerShare, cur)}</div>
                    {p.paid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><CheckCircle2 className="w-3 h-3" /> PAID</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600"><Clock className="w-3 h-3" /> UNPAID</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="px-6 pt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5">
              <div className="text-[11px] uppercase tracking-wide text-emerald-700 font-bold">Collected</div>
              <div data-testid="summary-collected-amount" className="font-mono-num font-black text-xl text-emerald-700 mt-0.5">{formatMoney(t.collected, cur)}</div>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5">
              <div className="text-[11px] uppercase tracking-wide text-amber-700 font-bold">Outstanding</div>
              <div data-testid="summary-outstanding-amount" className="font-mono-num font-black text-xl text-amber-700 mt-0.5">{formatMoney(t.outstanding, cur)}</div>
            </div>
          </div>

          {/* Breakdown line */}
          <div className="px-6 pt-4">
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm space-y-1.5">
              <div className="flex justify-between text-slate-600"><span>Court fee</span><span className="font-mono-num font-semibold text-slate-900">{formatMoney(t.courtFee, cur)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Shuttles ({session.num_shuttles} × {formatMoney(session.price_per_shuttle, cur)})</span><span className="font-mono-num font-semibold text-slate-900">{formatMoney(t.totalShuttleCost, cur)}</span></div>
              <div className="flex justify-between pt-1.5 mt-1 border-t border-slate-200 text-slate-900 font-bold"><span>Total ÷ {t.numPlayers}</span><span className="font-mono-num">{formatMoney(t.totalCost, cur)}</span></div>
            </div>
          </div>

          {/* Payment note + QR */}
          {(session.payment_note || session.payment_qr_path) && (
            <div className="px-6 pt-4">
              <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4">
                <div className="flex items-center gap-1.5 text-sky-700 font-bold text-xs uppercase tracking-wide"><Wallet className="w-3.5 h-3.5" /> How to pay</div>
                {session.payment_note && (
                  <p className="text-slate-700 text-sm mt-1.5 whitespace-pre-wrap">{session.payment_note}</p>
                )}
                {session.payment_qr_path && (
                  <div className="mt-3 flex justify-center">
                    <img
                      src={fileUrl(session.payment_qr_path)}
                      alt="Payment QR code"
                      data-testid="summary-qr-image"
                      className="w-44 h-44 rounded-xl object-contain bg-white border border-sky-200 p-2"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer with tear */}
          <div className="mt-6">
            <div className="h-4 bg-white ticket-tear" />
            <div data-testid="made-with-courtsplit-footer" className="bg-slate-900 text-white/70 text-center text-xs py-3 font-medium tracking-wide">
              Made with <span className="text-emerald-400 font-bold">CourtSplit</span> 🏸
            </div>
          </div>
        </div>

        <Button
          onClick={downloadImage}
          disabled={downloading}
          className="w-full mt-4 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold gap-2"
          data-testid="download-image-button"
        >
          <Download className="w-5 h-5" /> {downloading ? "Preparing image..." : "Save as image"}
        </Button>
        <Button onClick={copyLink} variant="outline" className="w-full mt-3 h-11 rounded-xl bg-white font-semibold gap-2" data-testid="copy-share-link-button">
          <Copy className="w-4 h-4" /> Copy this link
        </Button>
      </div>
    </div>
  );
}
