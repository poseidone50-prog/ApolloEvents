import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Settings as SettingsIcon, Download, UploadCloud, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const [articles, sales, suppliers, purchases, contracts, documents] = await Promise.all([
        base44.entities.Article.list("-created_date", 10000),
        base44.entities.Sale.list("-created_date", 10000),
        base44.entities.Supplier.list("-created_date", 10000),
        base44.entities.Purchase.list("-created_date", 10000),
        base44.entities.Contract.list("-created_date", 10000),
        base44.entities.Document.list("-created_date", 10000)
      ]);

      const backup = {
        version: "1.0",
        date: new Date().toISOString(),
        data: {
          articles,
          sales,
          suppliers,
          purchases,
          contracts,
          documents
        }
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `apollo_backup_${format(new Date(), "yyyyMMdd_HHmm")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Backup esportato con successo!");
    } catch (error) {
      console.error(error);
      toast.error("Errore durante l'esportazione: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("ATTENZIONE! Il ripristino aggiornerà i dati attuali del database. Assicurati che il file sia corretto. Vuoi procedere?")) {
      e.target.value = null;
      return;
    }

    try {
      setIsImporting(true);
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.data) {
        throw new Error("Il file selezionato non è un backup valido per questa applicazione.");
      }

      const restoreEntity = async (entityName, items) => {
        if (!items || !items.length) return;
        const dbEntity = base44.entities[entityName];
        
        for (const item of items) {
            try {
                if (item.id) {
                    const dataToSave = { ...item };
                    delete dataToSave.id;
                    await dbEntity.update(item.id, dataToSave).catch(async () => {
                        await dbEntity.create(dataToSave);
                    });
                } else {
                    await dbEntity.create(item);
                }
            } catch(err) {
                console.error(`Errore ripristino item in ${entityName}:`, err);
            }
        }
      };

      await Promise.all([
        restoreEntity("Article", backup.data.articles),
        restoreEntity("Sale", backup.data.sales),
        restoreEntity("Supplier", backup.data.suppliers),
        restoreEntity("Purchase", backup.data.purchases),
        restoreEntity("Contract", backup.data.contracts),
        restoreEntity("Document", backup.data.documents)
      ]);

      toast.success("Ripristino completato con successo!");
    } catch (error) {
      console.error(error);
      toast.error("Errore durante il ripristino: " + error.message);
    } finally {
      setIsImporting(false);
      e.target.value = null;
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-secondary" />
          Impostazioni
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        
        {/* EXPORT */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col items-start h-full">
          <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl mb-4">
            <Download className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2">Salva un Backup</h2>
          <p className="text-muted-foreground text-sm mb-6 flex-1">
            Scarica un file JSON contenente tutti i tuoi dati attuali: articoli, vendite, acquisti e contratti. Conservalo in un posto sicuro per poter recuperare tutto in caso di necessità.
          </p>
          <Button 
            onClick={handleExport} 
            disabled={isExporting}
            className="w-full h-12 text-base font-bold"
          >
            {isExporting ? "Esportazione in corso..." : "Scarica Backup Completo"}
          </Button>
        </div>

        {/* IMPORT */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col items-start h-full">
          <div className="w-12 h-12 bg-destructive/10 text-destructive flex items-center justify-center rounded-xl mb-4">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2">Ripristina Dati</h2>
          <p className="text-muted-foreground text-sm mb-6 flex-1">
            Carica un file di backup precedente per ripristinare il database. Attenzione: questa operazione andrà a modificare i dati attuali con quelli presenti nel file.
          </p>
          <div className="w-full relative">
            <Button 
              variant="destructive"
              disabled={isImporting}
              className="w-full h-12 text-base font-bold relative overflow-hidden"
            >
              {isImporting ? "Ripristino in corso..." : "Carica File di Backup"}
              <input 
                type="file" 
                accept=".json"
                onChange={handleImport}
                disabled={isImporting}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </Button>
          </div>
        </div>

      </div>

      <div className="bg-muted/50 border border-border rounded-xl p-6 mt-8 flex gap-4 items-start">
        <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-lg mb-1">Come funziona il ripristino?</h3>
          <p className="text-sm text-muted-foreground">
            Il ripristino caricherà nel database tutti gli elementi presenti nel file di backup. Se un elemento esiste già, verrà aggiornato ai valori del backup. Se è nuovo, verrà aggiunto. Gli elementi creati di recente che non sono presenti nel backup non verranno cancellati automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
