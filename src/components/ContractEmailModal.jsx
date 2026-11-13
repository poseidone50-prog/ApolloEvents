import { useState, useEffect } from "react";
import { X, Mail, Download, Share2, ExternalLink, CheckCircle2, FileDown, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function ContractEmailModal({ pdfResult, emailContent, onClose }) {
  const [recipientEmail, setRecipientEmail] = useState(emailContent?.to || "");
  const [subject, setSubject] = useState(emailContent?.subject || "");
  const [body, setBody] = useState(emailContent?.body || "");
  const [pdfUrl, setPdfUrl] = useState("");

  const canNativeShareFile =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    pdfResult?.pdfFile &&
    navigator.canShare({ files: [pdfResult.pdfFile] });

  useEffect(() => {
    if (pdfResult?.pdfBlob) {
      const url = URL.createObjectURL(pdfResult.pdfBlob);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [pdfResult]);

  if (!pdfResult) return null;

  const handleDownloadAgain = () => {
    pdfResult.doc.save(pdfResult.fileName);
    toast.success("PDF a colori scaricato!");
  };

  const handleNativeShareWithFile = async () => {
    if (!canNativeShareFile) {
      toast.error("Condivisione diretta file non supportata su questo browser: usa i pulsanti qui sotto.");
      return;
    }
    try {
      await navigator.share({
        files: [pdfResult.pdfFile],
        title: subject,
        text: body,
      });
      toast.success("PDF condiviso con successo!");
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error(err);
      }
    }
  };

  const handleOpenMailto = () => {
    if (!recipientEmail.trim()) {
      toast.error("Inserisci l'indirizzo email del cliente");
      return;
    }
    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    toast.success("Programma di posta aperto!");
  };

  const handleOpenGmailWeb = () => {
    if (!recipientEmail.trim()) {
      toast.error("Inserisci l'indirizzo email del cliente");
      return;
    }
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail.trim())}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, "_blank");
    toast.success("Gmail Web aperto! Il link al PDF a colori è già nel messaggio, oppure trascina il file PDF scaricato nella finestra Gmail.", { duration: 7000 });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-3 print:hidden" onClick={onClose}>
      <div
        className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="font-bold text-base">Invio Contratto in PDF a Colori</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* File confirmation box */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                ✓ PDF a Colori Generato e Scaricato
              </p>
              <p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-100 mt-0.5">
                {pdfResult.fileName}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Vedi PDF
                </a>
              )}
              <Button size="sm" variant="outline" onClick={handleDownloadAgain} className="h-8 text-xs rounded-lg">
                <Download className="w-3.5 h-3.5 mr-1" /> Scarica
              </Button>
            </div>
          </div>

          {/* Email input */}
          <div className="grid grid-cols-1 gap-2.5">
            <div>
              <Label className="text-xs font-semibold">Email Destinatario (Cliente)</Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                placeholder="cliente@esempio.it"
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Testo di accompagnamento Email (modificabile)</Label>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                className="rounded-xl mt-1 text-xs leading-relaxed"
              />
            </div>
          </div>

          {/* Instruction box for Gmail Web attachment */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 shrink-0 text-amber-700" />
              Come funziona l&apos;invio su Gmail Web:
            </p>
            <p className="leading-relaxed">
              1. Nel testo della mail è <strong>già inserito il link diretto</strong> con cui il cliente apre e scarica subito il <strong>Contratto in PDF a colori</strong>.<br />
              2. Se vuoi allegare anche il file <strong>{pdfResult.fileName}</strong> nella mail di Gmail Web, trascinalo dalla barra dei file scaricati del browser (in alto a destra) dentro la finestra di Gmail oppure clicca sulla graffetta 📎 in Gmail.
            </p>
          </div>

          {/* Actions to send */}
          <div className="space-y-2 pt-1">
            {canNativeShareFile && (
              <Button
                type="button"
                onClick={handleNativeShareWithFile}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Invia con File PDF Allegato in Automatico
              </Button>
            )}

            <Button
              type="button"
              onClick={handleOpenGmailWeb}
              className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md"
            >
              <Mail className="w-4 h-4 mr-2" />
              Invia tramite Gmail Web
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleOpenMailto}
              className="w-full h-11 rounded-xl border-slate-300 font-semibold"
            >
              <Mail className="w-4 h-4 mr-2 text-blue-600" />
              Apri Programma Posta (Outlook / Apple Mail)
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadAgain}
              className="w-full h-10 rounded-xl font-semibold text-xs"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Scarica di nuovo il PDF a Colori
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
