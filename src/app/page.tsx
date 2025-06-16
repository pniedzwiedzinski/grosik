
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileWarning, Search } from 'lucide-react';

type FilterMode = 'all' | 'income' | 'expenses';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
};

const sortEntriesByDate = (entries: TransactionEntry[]): TransactionEntry[] => {
  return [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const searchFilterEntries = (entries: TransactionEntry[], query: string): TransactionEntry[] => {
  if (!query.trim()) {
    return entries;
  }
  const lowerCaseQuery = query.toLowerCase();
  return entries.filter(entry =>
    entry.description.toLowerCase().includes(lowerCaseQuery) ||
    entry.amount.toString().toLowerCase().includes(lowerCaseQuery) ||
    entry.date.toLowerCase().includes(lowerCaseQuery)
  );
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
  const [unmatchedSearchQuery, setUnmatchedSearchQuery] = useState<string>('');
  const [bankSearchQuery, setBankSearchQuery] = useState<string>('');
  const [ziherSearchQuery, setZiherSearchQuery] = useState<string>('');


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
    await new Promise(resolve => setTimeout(resolve, 30)); 
  }, [setProgress]);


  const filterEntriesByMode = (entries: TransactionEntry[], mode: FilterMode): TransactionEntry[] => {
    if (mode === 'income') {
      return entries.filter(e => e.amount > 0);
    }
    if (mode === 'expenses') {
      return entries.filter(e => e.amount < 0);
    }
    return entries; 
  };

  useEffect(() => {
    const modeFilteredBankEntries = filterEntriesByMode(bankEntries, filterMode);
    const modeFilteredZiherEntries = filterEntriesByMode(ziherEntries, filterMode);

    const searchedBankForUnmatched = searchFilterEntries(modeFilteredBankEntries, unmatchedSearchQuery);
    const searchedZiherForUnmatched = searchFilterEntries(modeFilteredZiherEntries, unmatchedSearchQuery);

    const unmatchedBank = searchedBankForUnmatched.filter(e => e.status === 'unmatched');
    const unmatchedZiher = searchedZiherForUnmatched.filter(e => e.status === 'unmatched');
    
    const combined = sortEntriesByDate([...unmatchedBank, ...unmatchedZiher]);
    setUnmatchedCombinedEntries(combined);
  }, [bankEntries, ziherEntries, filterMode, unmatchedSearchQuery]);

  useEffect(() => {
    const modeFilteredBankEntries = filterEntriesByMode(bankEntries, filterMode);
    const modeFilteredZiherEntries = filterEntriesByMode(ziherEntries, filterMode);
    
    const newBankTotal = modeFilteredBankEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const newZiherTotal = modeFilteredZiherEntries.reduce((sum, entry) => sum + entry.amount, 0);
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
        await updateProgress(10);
        newBankEntries = parseCsv(bankCsvText, 'bank');
        successfullyParsedBank = newBankEntries.length > 0;
        if (bankFile && !successfullyParsedBank) {
          toast({
            title: "Problem z plikiem historii z banku",
            description: `Nie znaleziono wpisów w "${bankFile.name}". Sprawdź format/zawartość pliku.`,
            variant: "destructive",
          });
        }
        await updateProgress(20);
      } else {
        setBankEntries([]); 
      }

      if (ziherFile) {
        const ziherCsvText = await ziherFile.text();
        await updateProgress(30);
        newZiherEntries = parseCsv(ziherCsvText, 'ziher');
        successfullyParsedZiher = newZiherEntries.length > 0;
        if (ziherFile && !successfullyParsedZiher) {
          toast({
            title: "Problem z plikiem Ziher",
            description: `Nie znaleziono wpisów w "${ziherFile.name}". Sprawdź format/zawartość pliku.`,
            variant: "destructive",
          });
        }
        await updateProgress(40);
      } else {
        setZiherEntries([]);
      }
      
      setSelectedBankEntryIds([]);
      setSelectedZiherEntryIds([]);
      setMatchGroups([]);
      setFilterMode('all');
      setUnmatchedSearchQuery('');
      setBankSearchQuery('');
      setZiherSearchQuery('');


      const sortedNewBankEntries = sortEntriesByDate(newBankEntries);
      const sortedNewZiherEntries = sortEntriesByDate(newZiherEntries);
      
      setBankEntries(sortedNewBankEntries);
      setZiherEntries(sortedNewZiherEntries);

      let autoMatchedCount = 0;
      if (sortedNewBankEntries.length > 0 && sortedNewZiherEntries.length > 0) {
        await updateProgress(60); 
        const { 
          updatedBankEntries: autoMatchedBank, 
          updatedZiherEntries: autoMatchedZiher, 
          newMatches: autoNewMatches 
        } = autoMatchEntries(sortedNewBankEntries, sortedNewZiherEntries); 
        
        setBankEntries(sortEntriesByDate(autoMatchedBank)); 
        setZiherEntries(sortEntriesByDate(autoMatchedZiher));
        setMatchGroups(autoNewMatches); 
        autoMatchedCount = autoNewMatches.length;
        await updateProgress(80);
      }
      
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
      setBankEntries(prev => bankFile && newBankEntries.length === 0 && prev.length > 0 && !error.message.toLowerCase().includes('bank') ? prev : sortEntriesByDate(newBankEntries)); 
      setZiherEntries(prev => ziherFile && newZiherEntries.length === 0 && prev.length > 0 && !error.message.toLowerCase().includes('ziher') ? prev : sortEntriesByDate(newZiherEntries));
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
    const { updatedBankEntries, updatedZiherEntries, newMatch } = manuallyMatchEntries(
      bankIds,
      ziherIds,
      bankEntries, 
      ziherEntries, 
      sumOfBankEntries,
      sumOfZiherEntries
    );

    setBankEntries(sortEntriesByDate(updatedBankEntries));
    setZiherEntries(sortEntriesByDate(updatedZiherEntries));

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

  }, [bankEntries, ziherEntries, toast, updateProgress]);


  const handleManualMatch = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0); 
    await updateProgress(30);

    const bankEntriesToMatch = bankEntries.filter(e => selectedBankEntryIds.includes(e.id) && e.status === 'unmatched');
    const ziherEntriesToMatch = ziherEntries.filter(e => selectedZiherEntryIds.includes(e.id) && e.status === 'unmatched');

    if (bankEntriesToMatch.length === 0 || ziherEntriesToMatch.length === 0) {
      toast({ 
         title: "Ręczne powiązanie nie powiodło się", 
         description: "Nie można powiązać. Upewnij się, że wybrane wpisy pochodzą z różnych źródeł (Bank i Ziher), nie są puste i wszystkie są 'niepowiązane'.", 
         variant: "destructive"
       });
      await updateProgress(100); 
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
    } else {
      await executeManualMatch(selectedBankEntryIds, selectedZiherEntryIds, sumSelectedBank, sumSelectedZiher);
    }
  }, [selectedBankEntryIds, selectedZiherEntryIds, bankEntries, ziherEntries, toast, executeManualMatch, updateProgress]);

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

    setBankEntries(sortEntriesByDate(currentBankEntries));
    setZiherEntries(sortEntriesByDate(currentZiherEntries));
    setMatchGroups(prev => prev.filter(mg => !matchIdsToUnmatch.has(mg.id)));
    setSelectedBankEntryIds([]);
    setSelectedZiherEntryIds([]);
    toast({ title: "Rozłączanie zakończone sukcesem", description: `Rozłączono ${unmatchCount} grup(ę/y).` });
    await updateProgress(100);
    setTimeout(() => setIsProcessing(false), 500);
  }, [selectedBankEntryIds, selectedZiherEntryIds, bankEntries, ziherEntries, toast, updateProgress]);
  
  const handleReset = useCallback(async () => {
    setIsProcessing(true); 
    await updateProgress(50);
    setBankEntries([]);
    setZiherEntries([]);
    setSelectedBankEntryIds([]);
    setSelectedZiherEntryIds([]);
    setUnmatchedCombinedEntries([]);
    setMatchGroups([]);
    setFilterMode('all');
    setUnmatchedSearchQuery('');
    setBankSearchQuery('');
    setZiherSearchQuery('');
    await updateProgress(100);
    setTimeout(() => setIsProcessing(false), 300);
    toast({ title: "Reset zakończony", description: "Wszystkie dane zostały wyczyszczone."});
  }, [toast, updateProgress]);

  const handleRowSelect = (source: 'bank' | 'ziher' | 'unmatched', id: string, isSelected: boolean) => {
    let entry: TransactionEntry | undefined;
    if (source === 'unmatched') {
        entry = unmatchedCombinedEntries.find(e => e.id === id);
    } else if (source === 'bank') {
        entry = displayedBankEntries.find(e => e.id === id); 
    } else { 
        entry = displayedZiherEntries.find(e => e.id === id); 
    }

    if (!entry) return;

    const actualSource = entry.source; 

    if (actualSource === 'bank') {
      setSelectedBankEntryIds(prev => isSelected ? [...prev, id] : prev.filter(item => item !== id));
    } else { 
      setSelectedZiherEntryIds(prev => isSelected ? [...prev, id] : prev.filter(item => item !== id));
    }
  };
  
  const handleDeselectAll = useCallback(() => {
    setSelectedBankEntryIds([]);
    setSelectedZiherEntryIds([]);
  }, []);

  const showFileUpload = bankEntries.length === 0 && ziherEntries.length === 0;
  const showTransactionData = bankEntries.length > 0 || ziherEntries.length > 0;

  useEffect(() => {
    if (!isProcessing) {
      setProgress(0);
    }
  }, [isProcessing]);

  const displayedBankEntries = searchFilterEntries(filterEntriesByMode(bankEntries, filterMode), bankSearchQuery);
  const displayedZiherEntries = searchFilterEntries(filterEntriesByMode(ziherEntries, filterMode), ziherSearchQuery);

  const selectableUnmatchedEntries = unmatchedCombinedEntries.filter(e => e.status !== 'matched');
  const isAllUnmatchedSelected = selectableUnmatchedEntries.length > 0 &&
    selectableUnmatchedEntries.every(e => (e.source === 'bank' ? selectedBankEntryIds : selectedZiherEntryIds).includes(e.id));
  
  const handleToggleSelectAllUnmatched = () => {
    const bankIdsToToggle = selectableUnmatchedEntries.filter(e => e.source === 'bank').map(e => e.id);
    const ziherIdsToToggle = selectableUnmatchedEntries.filter(e => e.source === 'ziher').map(e => e.id);

    if (isAllUnmatchedSelected) {
      setSelectedBankEntryIds(prev => prev.filter(id => !bankIdsToToggle.includes(id)));
      setSelectedZiherEntryIds(prev => prev.filter(id => !ziherIdsToToggle.includes(id)));
    } else {
      setSelectedBankEntryIds(prev => Array.from(new Set([...prev, ...bankIdsToToggle])));
      setSelectedZiherEntryIds(prev => Array.from(new Set([...prev, ...ziherIdsToToggle])));
    }
  };

  const isAllBankSelected = displayedBankEntries.length > 0 && displayedBankEntries.every(e => selectedBankEntryIds.includes(e.id));
  const handleToggleSelectAllBank = () => {
    const allDisplayedBankIds = displayedBankEntries.map(e => e.id);
    if (isAllBankSelected) {
      setSelectedBankEntryIds(prev => prev.filter(id => !allDisplayedBankIds.includes(id)));
    } else {
      setSelectedBankEntryIds(prev => Array.from(new Set([...prev, ...allDisplayedBankIds])));
    }
  };

  const isAllZiherSelected = displayedZiherEntries.length > 0 && displayedZiherEntries.every(e => selectedZiherEntryIds.includes(e.id));
  const handleToggleSelectAllZiher = () => {
    const allDisplayedZiherIds = displayedZiherEntries.map(e => e.id);
    if (isAllZiherSelected) {
      setSelectedZiherEntryIds(prev => prev.filter(id => !allDisplayedZiherIds.includes(id)));
    } else {
      setSelectedZiherEntryIds(prev => Array.from(new Set([...prev, ...allDisplayedZiherIds])));
    }
  };

  const allEntriesAreGloballyMatched = (bankEntries.length > 0 || ziherEntries.length > 0) &&
                                   bankEntries.every(e => e.status === 'matched') &&
                                   ziherEntries.every(e => e.status === 'matched');

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
              onReset={handleReset}
              isProcessing={isProcessing}
            />
            <TransactionFilter 
              currentFilterMode={filterMode}
              onFilterChange={setFilterMode}
            />
            <ActionToolbar
              onManualMatch={handleManualMatch}
              onUnmatch={handleUnmatch}
              isProcessing={isProcessing}
              selectedBankEntryIds={selectedBankEntryIds}
              selectedZiherEntryIds={selectedZiherEntryIds}
              bankEntries={bankEntries}
              ziherEntries={ziherEntries}
              onDeselectAll={handleDeselectAll}
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
            <TabsContent value="unmatched" className="mt-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Szukaj w niepowiązanych..."
                  value={unmatchedSearchQuery}
                  onChange={(e) => setUnmatchedSearchQuery(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
              <TransactionTable
                title="Niepowiązane Wpisy"
                entries={unmatchedCombinedEntries} 
                selectedIds={[...selectedBankEntryIds, ...selectedZiherEntryIds]} 
                onRowSelect={(id, isSelected) => handleRowSelect('unmatched', id, isSelected)}
                isProcessing={isProcessing}
                matchGroups={matchGroups}
                isAllSelected={isAllUnmatchedSelected}
                onToggleSelectAll={handleToggleSelectAllUnmatched}
                canSelectAny={selectableUnmatchedEntries.length > 0}
                isGloballyReconciled={allEntriesAreGloballyMatched}
              />
            </TabsContent>
            <TabsContent value="bank" className="mt-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Szukaj w banku..."
                  value={bankSearchQuery}
                  onChange={(e) => setBankSearchQuery(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
              <TransactionTable
                title="Wpisy Bankowe"
                entries={displayedBankEntries}
                selectedIds={selectedBankEntryIds}
                onRowSelect={(id, isSelected) => handleRowSelect('bank', id, isSelected)}
                isProcessing={isProcessing}
                matchGroups={matchGroups}
                isAllSelected={isAllBankSelected}
                onToggleSelectAll={handleToggleSelectAllBank}
                canSelectAny={displayedBankEntries.length > 0}
              />
            </TabsContent>
            <TabsContent value="ziher" className="mt-4 space-y-4">
               <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Szukaj w Ziher..."
                  value={ziherSearchQuery}
                  onChange={(e) => setZiherSearchQuery(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
              <TransactionTable
                title="Wpisy Ziher"
                entries={displayedZiherEntries}
                selectedIds={selectedZiherEntryIds}
                onRowSelect={(id, isSelected) => handleRowSelect('ziher', id, isSelected)}
                isProcessing={isProcessing}
                matchGroups={matchGroups}
                isAllSelected={isAllZiherSelected}
                onToggleSelectAll={handleToggleSelectAllZiher}
                canSelectAny={displayedZiherEntries.length > 0}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <AlertDialog open={isMismatchConfirmDialogOpen} onOpenChange={(open) => {
          if (!open) { 
            setIsMismatchConfirmDialogOpen(false); 
            if(isProcessing) { 
                 setTimeout(() => setIsProcessing(false), 300); 
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
              if(isProcessing){
                  updateProgress(100).then(() => setTimeout(() => setIsProcessing(false), 300));
              }
            }}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (mismatchConfirmData) {
                await updateProgress(85); 
                await executeManualMatch(
                  mismatchConfirmData.bankIds, 
                  mismatchConfirmData.ziherIds, 
                  mismatchConfirmData.bankSum, 
                  mismatchConfirmData.ziherSum
                );
              }
            }}>Powiąż mimo to</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

