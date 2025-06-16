
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { TransactionEntry, MatchGroup } from '@/types/reconciliation';
import { parseCsv } from '@/lib/csvParser';
import { autoMatchEntries, manuallyMatchEntries, unmatchEntriesByMatchId } from '@/lib/reconciliationUtils';
import { ReconcileProHeader } from '@/components/reconcile-pro/ReconcileProHeader';
import { FileUploadArea } from '@/components/reconcile-pro/FileUploadArea';
import { ActionToolbar } from '@/components/reconcile-pro/ActionToolbar';
import { BalanceSummary } from '@/components/reconcile-pro/BalanceSummary';
import { TransactionTable } from '@/components/reconcile-pro/TransactionTable';
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileWarning } from 'lucide-react';


export default function ReconcileProPage() {
  const [bankEntries, setBankEntries] = useState<TransactionEntry[]>([]);
  const [ziherEntries, setZiherEntries] = useState<TransactionEntry[]>([]);
  
  const [selectedBankEntryIds, setSelectedBankEntryIds] = useState<string[]>([]);
  const [selectedZiherEntryIds, setSelectedZiherEntryIds] = useState<string[]>([]);
  
  const [unmatchedCombinedEntries, setUnmatchedCombinedEntries] = useState<TransactionEntry[]>([]);
  const [matchGroups, setMatchGroups] = useState<MatchGroup[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [bankTotal, setBankTotal] = useState(0);
  const [ziherTotal, setZiherTotal] = useState(0);
  const [difference, setDifference] = useState(0);

  const { toast } = useToast();

  useEffect(() => {
    const unmatchedBank = bankEntries.filter(e => e.status === 'unmatched');
    const unmatchedZiher = ziherEntries.filter(e => e.status === 'unmatched');
    const combined = [...unmatchedBank, ...unmatchedZiher].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setUnmatchedCombinedEntries(combined);
  }, [bankEntries, ziherEntries]);

  useEffect(() => {
    const newBankTotal = bankEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const newZiherTotal = ziherEntries.reduce((sum, entry) => sum + entry.amount, 0);
    setBankTotal(newBankTotal);
    setZiherTotal(newZiherTotal);
    setDifference(newBankTotal - newZiherTotal);
  }, [bankEntries, ziherEntries]);

  const updateProgress = (value: number) => {
    setProgress(value);
    return new Promise(resolve => setTimeout(resolve, 50)); 
  };

  const handleFilesProcessed = async (bankFile: File | null, ziherFile: File | null) => {
    setIsProcessing(true);
    setProgress(0);

    let newBankEntries: TransactionEntry[] = [];
    let newZiherEntries: TransactionEntry[] = [];

    try {
      if (bankFile) {
        const bankCsvText = await bankFile.text();
        await updateProgress(20);
        newBankEntries = parseCsv(bankCsvText, 'bank');
        setBankEntries(newBankEntries);
        await updateProgress(40);
      } else {
        setBankEntries([]); 
      }

      if (ziherFile) {
        const ziherCsvText = await ziherFile.text();
        await updateProgress(60);
        newZiherEntries = parseCsv(ziherCsvText, 'ziher');
        setZiherEntries(newZiherEntries);
        await updateProgress(80);
      } else {
        setZiherEntries([]); 
      }
      
      setSelectedBankEntryIds([]);
      setSelectedZiherEntryIds([]);
      setMatchGroups([]);

      let fileProcessedSuccessfully = false;
      if (bankFile) {
        if (newBankEntries.length > 0) {
          fileProcessedSuccessfully = true;
        } else {
          toast({
            title: "Problem z plikiem historii z banku",
            description: `Nie znaleziono wpisów w "${bankFile.name}". Sprawdź format/zawartość pliku.`,
            variant: "destructive",
          });
        }
      }
      if (ziherFile) {
        if (newZiherEntries.length > 0) {
          fileProcessedSuccessfully = true;
        } else {
          toast({
            title: "Problem z plikiem Ziher",
            description: `Nie znaleziono wpisów w "${ziherFile.name}". Sprawdź format/zawartość pliku.`,
            variant: "destructive",
          });
        }
      }

      if (fileProcessedSuccessfully) {
         toast({ title: "Pliki przetworzone", description: "Pliki CSV zostały sparsowane." });
      } else if (!bankFile && !ziherFile) {
         toast({ title: "Nie wybrano plików", description: "Proszę przesłać co najmniej jeden plik CSV.", variant: "destructive" });
      }
      
    } catch (error: any) {
      toast({
        title: "Błąd przetwarzania plików",
        description: error.message || "Nie można sparsować plików CSV.",
        variant: "destructive",
      });
      setBankEntries(prev => bankFile && newBankEntries.length === 0 && prev.length > 0 && !error.message.toLowerCase().includes('bank') ? prev : newBankEntries); 
      setZiherEntries(prev => ziherFile && newZiherEntries.length === 0 && prev.length > 0 && !error.message.toLowerCase().includes('ziher') ? prev : newZiherEntries);
    } finally {
      await updateProgress(100);
      setTimeout(() => setIsProcessing(false), 500); 
    }
  };

  const handleAutoMatch = useCallback(async () => {
    if (bankEntries.length === 0 || ziherEntries.length === 0) {
      toast({ title: "Niewystarczające dane", description: "Proszę przesłać pliki z historią z banku i Ziher, aby przeprowadzić automatyczne powiązanie.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    await updateProgress(30);
    const { updatedBankEntries, updatedZiherEntries, newMatches } = autoMatchEntries(bankEntries, ziherEntries);
    await updateProgress(70);
    setBankEntries(updatedBankEntries);
    setZiherEntries(updatedZiherEntries);
    setMatchGroups(prev => [...prev.filter(mg => mg.type === 'manual'), ...newMatches]); 
    toast({ title: "Automatyczne powiązanie zakończone", description: `Znaleziono ${newMatches.length} nowych automatycznych powiązań.` });
    await updateProgress(100);
    setTimeout(() => setIsProcessing(false), 500);
  }, [bankEntries, ziherEntries, toast]);

  const handleManualMatch = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0);
    await updateProgress(30);
    const { updatedBankEntries, updatedZiherEntries, newMatch } = manuallyMatchEntries(
      selectedBankEntryIds,
      selectedZiherEntryIds,
      bankEntries,
      ziherEntries
    );
    await updateProgress(70);
    setBankEntries(updatedBankEntries);
    setZiherEntries(updatedZiherEntries);
    if (newMatch) {
      setMatchGroups(prev => [...prev, newMatch]);
      toast({ title: "Ręczne powiązanie zakończone sukcesem", description: "Wybrane wpisy zostały powiązane." });
    } else {
       toast({ 
         title: "Ręczne powiązanie nie powiodło się", 
         description: "Nie można powiązać. Upewnij się, że wybrane wpisy pochodzą z różnych źródeł i wszystkie są 'niepowiązane'.", 
         variant: "destructive"
       });
    }
    setSelectedBankEntryIds([]);
    setSelectedZiherEntryIds([]);
    
    await updateProgress(100);
    setTimeout(() => setIsProcessing(false), 500);
  }, [selectedBankEntryIds, selectedZiherEntryIds, bankEntries, ziherEntries, toast]);

  const handleUnmatch = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0);
    await updateProgress(20);
    const matchIdsToUnmatch = new Set<string>();
    [...selectedBankEntryIds, ...selectedZiherEntryIds].forEach(id => {
      const bankEntry = bankEntries.find(e => e.id === id);
      if (bankEntry?.matchId) matchIdsToUnmatch.add(bankEntry.matchId);
      const ziherEntry = ziherEntries.find(e => e.id === id);
      if (ziherEntry?.matchId) matchIdsToUnmatch.add(ziherEntry.matchId);
    });

    if (matchIdsToUnmatch.size === 0) {
      toast({ title: "Nie wybrano powiązania", description: "Proszę wybrać powiązane wpisy, aby je rozłączyć.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }
    
    let currentBankEntries = [...bankEntries];
    let currentZiherEntries = [...ziherEntries];
    let unmatchCount = 0;

    await updateProgress(40);
    matchIdsToUnmatch.forEach(matchId => {
      const result = unmatchEntriesByMatchId(matchId, currentBankEntries, currentZiherEntries);
      currentBankEntries = result.updatedBankEntries;
      currentZiherEntries = result.updatedZiherEntries;
      unmatchCount++;
    });
    await updateProgress(80);

    setBankEntries(currentBankEntries);
    setZiherEntries(currentZiherEntries);
    setMatchGroups(prev => prev.filter(mg => !matchIdsToUnmatch.has(mg.id)));
    setSelectedBankEntryIds([]);
    setSelectedZiherEntryIds([]);
    toast({ title: "Rozłączanie zakończone sukcesem", description: `Rozłączono ${unmatchCount} grup(ę/y).` });
    await updateProgress(100);
    setTimeout(() => setIsProcessing(false), 500);
  }, [selectedBankEntryIds, selectedZiherEntryIds, bankEntries, ziherEntries, toast]);
  
  const handleReset = useCallback(() => {
    setBankEntries([]);
    setZiherEntries([]);
    setSelectedBankEntryIds([]);
    setSelectedZiherEntryIds([]);
    setUnmatchedCombinedEntries([]);
    setMatchGroups([]);
    setIsProcessing(false);
    setProgress(0);
    toast({ title: "Reset zakończony", description: "Wszystkie dane zostały wyczyszczone."});
  }, [toast]);

  const handleRowSelect = (source: 'bank' | 'ziher' | 'unmatched', id: string, isSelected: boolean) => {
    const entry = source === 'bank' ? bankEntries.find(e => e.id === id) :
                  source === 'ziher' ? ziherEntries.find(e => e.id === id) :
                  unmatchedCombinedEntries.find(e => e.id === id);

    if (!entry) return;

    const actualSource = entry.source; 

    if (actualSource === 'bank') {
      setSelectedBankEntryIds(prev => isSelected ? [...prev, id] : prev.filter(item => item !== id));
    } else {
      setSelectedZiherEntryIds(prev => isSelected ? [...prev, id] : prev.filter(item => item !== id));
    }
  };
  
  const canManualMatch =
    selectedBankEntryIds.length > 0 &&
    selectedZiherEntryIds.length > 0 &&
    selectedBankEntryIds.every(id => bankEntries.find(e => e.id === id)?.status === 'unmatched') &&
    selectedZiherEntryIds.every(id => ziherEntries.find(e => e.id === id)?.status === 'unmatched');

  const canUnmatch = [...selectedBankEntryIds, ...selectedZiherEntryIds].some(id => {
    const bankEntry = bankEntries.find(e => e.id === id && e.status === 'matched');
    const ziherEntry = ziherEntries.find(e => e.id === id && e.status === 'matched');
    return bankEntry || ziherEntry;
  });
  const canAutoMatch = bankEntries.length > 0 && ziherEntries.length > 0 && (bankEntries.some(e => e.status === 'unmatched') || ziherEntries.some(e => e.status === 'unmatched'));

  const showFileUpload = bankEntries.length === 0 && ziherEntries.length === 0;
  const showTransactionData = bankEntries.length > 0 || ziherEntries.length > 0;


  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ReconcileProHeader />
      <main className="flex-grow container mx-auto px-4 md:px-8 pb-8">
        {showFileUpload && (
          <FileUploadArea onFilesProcessed={handleFilesProcessed} />
        )}
        
        {isProcessing && (
          <div className="my-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-center text-muted-foreground mt-2">Przetwarzanie... {progress.toFixed(0)}%</p>
          </div>
        )}

        {showTransactionData && !isProcessing && (
          <>
            <BalanceSummary
              bankTotal={bankTotal}
              ziherTotal={ziherTotal}
              difference={difference}
            />
            <ActionToolbar
              onAutoMatch={handleAutoMatch}
              onManualMatch={handleManualMatch}
              onUnmatch={handleUnmatch}
              onReset={handleReset}
              canAutoMatch={canAutoMatch}
              canManualMatch={canManualMatch}
              canUnmatch={canUnmatch}
              isProcessing={isProcessing}
            />
          </>
        )}

        {showFileUpload && !isProcessing && (
          <Alert className="mt-6">
            <FileWarning className="h-4 w-4" />
            <AlertTitle>Rozpocznij</AlertTitle>
            <AlertDescription>
              Prześlij historię z banku i pliki CSV z Ziher powyżej, aby rozpocząć powiązywanie transakcji.
            </AlertDescription>
          </Alert>
        )}
        
        {showTransactionData && !isProcessing && (
          <Tabs defaultValue="unmatched" className="mt-6 w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="unmatched">Niepowiązane</TabsTrigger>
              <TabsTrigger value="bank">Bank</TabsTrigger>
              <TabsTrigger value="ziher">Ziher</TabsTrigger>
            </TabsList>
            <TabsContent value="unmatched" className="mt-4">
              <TransactionTable
                title="Niepowiązane Wpisy"
                entries={unmatchedCombinedEntries}
                selectedIds={[...selectedBankEntryIds, ...selectedZiherEntryIds]} 
                onRowSelect={(id, isSelected) => handleRowSelect('unmatched', id, isSelected)}
                isProcessing={isProcessing}
              />
            </TabsContent>
            <TabsContent value="bank" className="mt-4">
              <TransactionTable
                title="Wpisy Bankowe"
                entries={bankEntries}
                selectedIds={selectedBankEntryIds}
                onRowSelect={(id, isSelected) => handleRowSelect('bank', id, isSelected)}
                isProcessing={isProcessing}
              />
            </TabsContent>
            <TabsContent value="ziher" className="mt-4">
              <TransactionTable
                title="Wpisy Ziher"
                entries={ziherEntries}
                selectedIds={selectedZiherEntryIds}
                onRowSelect={(id, isSelected) => handleRowSelect('ziher', id, isSelected)}
                isProcessing={isProcessing}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
      <footer className="py-4 border-t border-border text-center text-sm text-muted-foreground">
        Grosik &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

