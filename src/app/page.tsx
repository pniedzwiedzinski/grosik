
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
import { TransactionFilter } from '@/components/reconcile-pro/TransactionFilter';
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileWarning } from 'lucide-react';

type FilterMode = 'all' | 'income' | 'expenses';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
};

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

  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const [isMismatchConfirmDialogOpen, setIsMismatchConfirmDialogOpen] = useState(false);
  const [mismatchConfirmData, setMismatchConfirmData] = useState<{
    bankIds: string[];
    ziherIds: string[];
    bankSum: number;
    ziherSum: number;
  } | null>(null);

  const { toast } = useToast();

  const updateProgress = useCallback(async (value: number) => {
    setProgress(value);
    // Allow a very short time for UI to update, useful for chained progress updates
    await new Promise(resolve => setTimeout(resolve, 30)); 
  }, [setProgress]);


  const filterEntriesByMode = (entries: TransactionEntry[], mode: FilterMode): TransactionEntry[] => {
    if (mode === 'income') {
      return entries.filter(e => e.amount > 0);
    }
    if (mode === 'expenses') {
      return entries.filter(e => e.amount < 0);
    }
    return entries; // 'all'
  };

  useEffect(() => {
    const currentlyFilteredBankEntries = filterEntriesByMode(bankEntries, filterMode);
    const currentlyFilteredZiherEntries = filterEntriesByMode(ziherEntries, filterMode);

    const unmatchedBank = currentlyFilteredBankEntries.filter(e => e.status === 'unmatched');
    const unmatchedZiher = currentlyFilteredZiherEntries.filter(e => e.status === 'unmatched');
    const combined = [...unmatchedBank, ...unmatchedZiher].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setUnmatchedCombinedEntries(combined);
  }, [bankEntries, ziherEntries, filterMode]);

  useEffect(() => {
    const currentlyFilteredBankEntries = filterEntriesByMode(bankEntries, filterMode);
    const currentlyFilteredZiherEntries = filterEntriesByMode(ziherEntries, filterMode);
    
    const newBankTotal = currentlyFilteredBankEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const newZiherTotal = currentlyFilteredZiherEntries.reduce((sum, entry) => sum + entry.amount, 0);
    setBankTotal(newBankTotal);
    setZiherTotal(newZiherTotal);
    setDifference(newBankTotal - newZiherTotal);
  }, [bankEntries, ziherEntries, filterMode]);


  const handleFilesProcessed = async (bankFile: File | null, ziherFile: File | null) => {
    setIsProcessing(true);
    setProgress(0);

    let newBankEntries: TransactionEntry[] = [];
    let newZiherEntries: TransactionEntry[] = [];
    let successfullyParsedBank = false;
    let successfullyParsedZiher = false;

    try {
      if (bankFile) {
        const bankCsvText = await bankFile.text();
        await updateProgress(15);
        newBankEntries = parseCsv(bankCsvText, 'bank');
        successfullyParsedBank = newBankEntries.length > 0;
        if (bankFile && !successfullyParsedBank) {
          toast({
            title: "Problem z plikiem historii z banku",
            description: `Nie znaleziono wpisów w "${bankFile.name}". Sprawdź format/zawartość pliku.`,
            variant: "destructive",
          });
        }
        await updateProgress(30);
      } else {
        setBankEntries([]); 
      }

      if (ziherFile) {
        const ziherCsvText = await ziherFile.text();
        await updateProgress(45);
        newZiherEntries = parseCsv(ziherCsvText, 'ziher');
        successfullyParsedZiher = newZiherEntries.length > 0;
        if (ziherFile && !successfullyParsedZiher) {
          toast({
            title: "Problem z plikiem Ziher",
            description: `Nie znaleziono wpisów w "${ziherFile.name}". Sprawdź format/zawartość pliku.`,
            variant: "destructive",
          });
        }
        await updateProgress(60);
      } else {
        setZiherEntries([]);
      }
      
      setSelectedBankEntryIds([]);
      setSelectedZiherEntryIds([]);
      setMatchGroups([]);
      setFilterMode('all');

      // Set entries first, so subsequent operations have them
      setBankEntries(newBankEntries);
      setZiherEntries(newZiherEntries);

      let autoMatchedCount = 0;
      if (newBankEntries.length > 0 && newZiherEntries.length > 0) {
        await updateProgress(75); 
        const { 
          updatedBankEntries: autoMatchedBank, 
          updatedZiherEntries: autoMatchedZiher, 
          newMatches: autoNewMatches 
        } = autoMatchEntries(newBankEntries, newZiherEntries); 
        
        setBankEntries(autoMatchedBank); 
        setZiherEntries(autoMatchedZiher);
        setMatchGroups(autoNewMatches); 
        autoMatchedCount = autoNewMatches.length;
      }
      
      await updateProgress(90);

      if (successfullyParsedBank || successfullyParsedZiher) {
         let description = "Pliki CSV zostały sparsowane.";
         if (newBankEntries.length > 0 && newZiherEntries.length > 0) {
           description += ` Automatycznie powiązano ${autoMatchedCount} wpisów.`;
         }
         toast({ title: "Pliki przetworzone", description });
      } else if (!bankFile && !ziherFile) {
         toast({ title: "Nie wybrano plików", description: "Proszę przesłać co najmniej jeden plik CSV.", variant: "destructive" });
      }
      
    } catch (error: any) {
      toast({
        title: "Błąd przetwarzania plików",
        description: error.message || "Nie można sparsować plików CSV.",
        variant: "destructive",
      });
      // Attempt to preserve previous valid entries if only one file fails or if parsing completely fails for new files
      setBankEntries(prev => bankFile && newBankEntries.length === 0 && prev.length > 0 && !error.message.toLowerCase().includes('bank') ? prev : newBankEntries); 
      setZiherEntries(prev => ziherFile && newZiherEntries.length === 0 && prev.length > 0 && !error.message.toLowerCase().includes('ziher') ? prev : newZiherEntries);
    } finally {
      await updateProgress(100);
      setTimeout(() => setIsProcessing(false), 500); 
    }
  };
  
  const executeManualMatch = useCallback(async (
    bankIds: string[],
    ziherIds: string[],
    sumOfBankEntries: number,
    sumOfZiherEntries: number
  ) => {
    // Assumes isProcessing is true, will be set to false at the end of this func by setTimeout
    // Progress can be updated from previous step (e.g. 70% or 85%)

    const { updatedBankEntries, updatedZiherEntries, newMatch } = manuallyMatchEntries(
      bankIds,
      ziherIds,
      bankEntries, // current state of bankEntries
      ziherEntries, // current state of ziherEntries
      sumOfBankEntries,
      sumOfZiherEntries
    );

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
    
    await updateProgress(100); // Ensure progress hits 100
    setTimeout(() => setIsProcessing(false), 500); // Then hide after a delay, also resets progress via useEffect

  }, [bankEntries, ziherEntries, toast, updateProgress, setBankEntries, setZiherEntries, setMatchGroups, setSelectedBankEntryIds, setSelectedZiherEntryIds, setIsProcessing]);


  const handleManualMatch = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0); // Start progress for this operation
    await updateProgress(30);

    const bankEntriesToMatch = bankEntries.filter(e => selectedBankEntryIds.includes(e.id) && e.status === 'unmatched');
    const ziherEntriesToMatch = ziherEntries.filter(e => selectedZiherEntryIds.includes(e.id) && e.status === 'unmatched');

    if (bankEntriesToMatch.length === 0 || ziherEntriesToMatch.length === 0) {
      toast({ 
         title: "Ręczne powiązanie nie powiodło się", 
         description: "Nie można powiązać. Upewnij się, że wybrane wpisy pochodzą z różnych źródeł (Bank i Ziher), nie są puste i wszystkie są 'niepowiązane'.", 
         variant: "destructive"
       });
      await updateProgress(100); // Show completion of this failed attempt
      setTimeout(() => setIsProcessing(false), 500);
      return;
    }
    
    const sumSelectedBank = bankEntriesToMatch.reduce((acc, entry) => acc + entry.amount, 0);
    const sumSelectedZiher = ziherEntriesToMatch.reduce((acc, entry) => acc + entry.amount, 0);
    await updateProgress(70);

    if (sumSelectedBank.toFixed(2) !== sumSelectedZiher.toFixed(2)) {
      setMismatchConfirmData({
        bankIds: selectedBankEntryIds,
        ziherIds: selectedZiherEntryIds,
        bankSum: sumSelectedBank,
        ziherSum: sumSelectedZiher,
      });
      setIsMismatchConfirmDialogOpen(true);
      // isProcessing remains true; executeManualMatch (called from dialog) will set it to false.
      // Progress might visually stay at 70% until dialog interaction.
    } else {
      await executeManualMatch(selectedBankEntryIds, selectedZiherEntryIds, sumSelectedBank, sumSelectedZiher);
      // setIsProcessing and further progress handled by executeManualMatch
    }
  }, [selectedBankEntryIds, selectedZiherEntryIds, bankEntries, ziherEntries, toast, executeManualMatch, updateProgress, setIsProcessing, setProgress, setMismatchConfirmData, setIsMismatchConfirmDialogOpen]);

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
      await updateProgress(100);
      setTimeout(() => setIsProcessing(false), 500);
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
  }, [selectedBankEntryIds, selectedZiherEntryIds, bankEntries, ziherEntries, toast, updateProgress, setIsProcessing, setProgress, setBankEntries, setZiherEntries, setMatchGroups, setSelectedBankEntryIds, setSelectedZiherEntryIds]);
  
  const handleReset = useCallback(async () => {
    setIsProcessing(true); // To show progress briefly
    await updateProgress(50);
    setBankEntries([]);
    setZiherEntries([]);
    setSelectedBankEntryIds([]);
    setSelectedZiherEntryIds([]);
    setUnmatchedCombinedEntries([]);
    setMatchGroups([]);
    setFilterMode('all');
    await updateProgress(100);
    setTimeout(() => setIsProcessing(false), 300);
    toast({ title: "Reset zakończony", description: "Wszystkie dane zostały wyczyszczone."});
  }, [toast, updateProgress, setIsProcessing, setProgress, setBankEntries, setZiherEntries, setSelectedBankEntryIds, setSelectedZiherEntryIds, setUnmatchedCombinedEntries, setMatchGroups, setFilterMode]);

  const handleRowSelect = (source: 'bank' | 'ziher' | 'unmatched', id: string, isSelected: boolean) => {
    let entry: TransactionEntry | undefined;
    if (source === 'unmatched') {
        entry = unmatchedCombinedEntries.find(e => e.id === id);
    } else if (source === 'bank') {
        entry = bankEntries.find(e => e.id === id); 
    } else { 
        entry = ziherEntries.find(e => e.id === id); 
    }

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

  const showFileUpload = bankEntries.length === 0 && ziherEntries.length === 0;
  const showTransactionData = bankEntries.length > 0 || ziherEntries.length > 0;

  // Effect to reset progress when isProcessing becomes false
  useEffect(() => {
    if (!isProcessing) {
      setProgress(0);
    }
  }, [isProcessing]);


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
            <TransactionFilter 
              currentFilterMode={filterMode}
              onFilterChange={setFilterMode}
            />
            <ActionToolbar
              onManualMatch={handleManualMatch}
              onUnmatch={handleUnmatch}
              onReset={handleReset}
              canManualMatch={canManualMatch}
              canUnmatch={canUnmatch}
              isProcessing={isProcessing}
            />
          </>
        )}

        {showFileUpload && !isProcessing && (
          <Alert className="mt-6">
            <FileWarning className="h-4 w-4" />
            <AlertTitle>Skąd wziąć pliki CSV?</AlertTitle>
            <AlertDescription>
              W książce bankowej w ZiHeRze znajdziesz przycisk do pobierania CSV. W iBiznesie musisz wejść w historię &rarr; wybrać zakres dat dla twojego rozliczenia &rarr; kliknąć eksportuj historię i wybrać format CSV.
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
                matchGroups={matchGroups}
              />
            </TabsContent>
            <TabsContent value="bank" className="mt-4">
              <TransactionTable
                title="Wpisy Bankowe"
                entries={filterEntriesByMode(bankEntries, filterMode)}
                selectedIds={selectedBankEntryIds}
                onRowSelect={(id, isSelected) => handleRowSelect('bank', id, isSelected)}
                isProcessing={isProcessing}
                matchGroups={matchGroups}
              />
            </TabsContent>
            <TabsContent value="ziher" className="mt-4">
              <TransactionTable
                title="Wpisy Ziher"
                entries={filterEntriesByMode(ziherEntries, filterMode)}
                selectedIds={selectedZiherEntryIds}
                onRowSelect={(id, isSelected) => handleRowSelect('ziher', id, isSelected)}
                isProcessing={isProcessing}
                matchGroups={matchGroups}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <AlertDialog open={isMismatchConfirmDialogOpen} onOpenChange={(open) => {
          if (!open) { // If dialog is closed (e.g. by Esc or overlay click or cancel button)
            setIsMismatchConfirmDialogOpen(false); 
            if(isProcessing) { // Only stop processing if it was initiated for mismatch check
                 setTimeout(() => setIsProcessing(false), 300); // Give time for progress to show 0 or just hide
            }
          } else {
            setIsMismatchConfirmDialogOpen(true);
          }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Niezgodne sumy</AlertDialogTitle>
            <AlertDialogDescription>
              Suma wybranych wpisów bankowych ({formatCurrency(mismatchConfirmData?.bankSum || 0)}) 
              różni się od sumy wybranych wpisów Ziher ({formatCurrency(mismatchConfirmData?.ziherSum || 0)}).
              <br />
              Czy na pewno chcesz je powiązać?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { 
              // setIsMismatchConfirmDialogOpen(false); // Handled by onOpenChange
              // If user cancels, ensure processing stops and progress resets
              if(isProcessing){
                  updateProgress(100).then(() => setTimeout(() => setIsProcessing(false), 300));
              }
            }}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (mismatchConfirmData) {
                // Progress should be around 70% from handleManualMatch
                await updateProgress(85); 
                await executeManualMatch(
                  mismatchConfirmData.bankIds, 
                  mismatchConfirmData.ziherIds, 
                  mismatchConfirmData.bankSum, 
                  mismatchConfirmData.ziherSum
                );
                // isProcessing and final progress handled by executeManualMatch
              }
              // setIsMismatchConfirmDialogOpen(false); // Handled by onOpenChange after action
            }}>Powiąż mimo to</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
