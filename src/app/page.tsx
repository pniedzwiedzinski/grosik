
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
  const [bookkeepingEntries, setBookkeepingEntries] = useState<TransactionEntry[]>([]);
  
  const [selectedBankEntryIds, setSelectedBankEntryIds] = useState<string[]>([]);
  const [selectedBookkeepingEntryIds, setSelectedBookkeepingEntryIds] = useState<string[]>([]);
  
  const [unmatchedCombinedEntries, setUnmatchedCombinedEntries] = useState<TransactionEntry[]>([]);
  const [matchGroups, setMatchGroups] = useState<MatchGroup[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [bankTotal, setBankTotal] = useState(0);
  const [bookkeepingTotal, setBookkeepingTotal] = useState(0);
  const [difference, setDifference] = useState(0);

  const { toast } = useToast();

  useEffect(() => {
    const unmatchedBank = bankEntries.filter(e => e.status === 'unmatched');
    const unmatchedBook = bookkeepingEntries.filter(e => e.status === 'unmatched');
    const combined = [...unmatchedBank, ...unmatchedBook].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setUnmatchedCombinedEntries(combined);
  }, [bankEntries, bookkeepingEntries]);

  useEffect(() => {
    const newBankTotal = bankEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const newBookkeepingTotal = bookkeepingEntries.reduce((sum, entry) => sum + entry.amount, 0);
    setBankTotal(newBankTotal);
    setBookkeepingTotal(newBookkeepingTotal);
    setDifference(newBankTotal - newBookkeepingTotal);
  }, [bankEntries, bookkeepingEntries]);

  const updateProgress = (value: number) => {
    setProgress(value);
    return new Promise(resolve => setTimeout(resolve, 50)); 
  };

  const handleFilesProcessed = async (bankFile: File | null, bookkeepingFile: File | null) => {
    setIsProcessing(true);
    setProgress(0);

    let newBankEntries: TransactionEntry[] = [];
    let newBookkeepingEntries: TransactionEntry[] = [];

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

      if (bookkeepingFile) {
        const bookkeepingCsvText = await bookkeepingFile.text();
        await updateProgress(60);
        newBookkeepingEntries = parseCsv(bookkeepingCsvText, 'bookkeeping');
        setBookkeepingEntries(newBookkeepingEntries);
        await updateProgress(80);
      } else {
        setBookkeepingEntries([]); 
      }
      
      setSelectedBankEntryIds([]);
      setSelectedBookkeepingEntryIds([]);
      setMatchGroups([]);

      let fileProcessedSuccessfully = false;
      if (bankFile) {
        if (newBankEntries.length > 0) {
          fileProcessedSuccessfully = true;
        } else {
          toast({
            title: "Bank File Issue",
            description: `No entries found in "${bankFile.name}". Check file format/content.`,
            variant: "destructive",
          });
        }
      }
      if (bookkeepingFile) {
        if (newBookkeepingEntries.length > 0) {
          fileProcessedSuccessfully = true;
        } else {
          toast({
            title: "Bookkeeping File Issue",
            description: `No entries found in "${bookkeepingFile.name}". Check file format/content.`,
            variant: "destructive",
          });
        }
      }

      if (fileProcessedSuccessfully) {
         toast({ title: "Files Processed", description: "CSV files parsed." });
      } else if (!bankFile && !bookkeepingFile) {
         // This case should ideally be prevented by the FileUploadArea button guard
         toast({ title: "No Files Selected", description: "Please upload at least one CSV file.", variant: "destructive" });
      }
      
    } catch (error: any) {
      toast({
        title: "Error Processing Files",
        description: error.message || "Could not parse CSV files.",
        variant: "destructive",
      });
      // Preserve existing entries if one file fails but the other was processed before error.
      setBankEntries(prev => bankFile && newBankEntries.length === 0 && prev.length > 0 && !error.message.toLowerCase().includes('bank') ? prev : newBankEntries); 
      setBookkeepingEntries(prev => bookkeepingFile && newBookkeepingEntries.length === 0 && prev.length > 0 && !error.message.toLowerCase().includes('bookkeeping') ? prev : newBookkeepingEntries);
    } finally {
      await updateProgress(100);
      setTimeout(() => setIsProcessing(false), 500); 
    }
  };

  const handleAutoMatch = useCallback(async () => {
    if (bankEntries.length === 0 || bookkeepingEntries.length === 0) {
      toast({ title: "Not enough data", description: "Please upload both bank and bookkeeping files for auto-matching.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    await updateProgress(30);
    const { updatedBankEntries, updatedBookkeepingEntries, newMatches } = autoMatchEntries(bankEntries, bookkeepingEntries);
    await updateProgress(70);
    setBankEntries(updatedBankEntries);
    setBookkeepingEntries(updatedBookkeepingEntries);
    setMatchGroups(prev => [...prev.filter(mg => mg.type === 'manual'), ...newMatches]); 
    toast({ title: "Auto-Matching Complete", description: `${newMatches.length} new automatic matches found.` });
    await updateProgress(100);
    setTimeout(() => setIsProcessing(false), 500);
  }, [bankEntries, bookkeepingEntries, toast]);

  const handleManualMatch = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0);
    await updateProgress(30);
    const { updatedBankEntries, updatedBookkeepingEntries, newMatch } = manuallyMatchEntries(
      selectedBankEntryIds,
      selectedBookkeepingEntryIds,
      bankEntries,
      bookkeepingEntries
    );
    await updateProgress(70);
    setBankEntries(updatedBankEntries);
    setBookkeepingEntries(updatedBookkeepingEntries);
    if (newMatch) {
      setMatchGroups(prev => [...prev, newMatch]);
      toast({ title: "Manual Match Successful", description: "Selected entries have been matched." });
    } else {
       toast({ 
         title: "Manual Match Failed", 
         description: "Could not match. Ensure selections are from different sources and all selected entries are 'unmatched'.", 
         variant: "destructive"
       });
    }
    setSelectedBankEntryIds([]);
    setSelectedBookkeepingEntryIds([]);
    
    await updateProgress(100);
    setTimeout(() => setIsProcessing(false), 500);
  }, [selectedBankEntryIds, selectedBookkeepingEntryIds, bankEntries, bookkeepingEntries, toast]);

  const handleUnmatch = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0);
    await updateProgress(20);
    const matchIdsToUnmatch = new Set<string>();
    [...selectedBankEntryIds, ...selectedBookkeepingEntryIds].forEach(id => {
      const bankEntry = bankEntries.find(e => e.id === id);
      if (bankEntry?.matchId) matchIdsToUnmatch.add(bankEntry.matchId);
      const bookEntry = bookkeepingEntries.find(e => e.id === id);
      if (bookEntry?.matchId) matchIdsToUnmatch.add(bookEntry.matchId);
    });

    if (matchIdsToUnmatch.size === 0) {
      toast({ title: "No Match Selected", description: "Please select matched entries to unmatch.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }
    
    let currentBankEntries = [...bankEntries];
    let currentBookkeepingEntries = [...bookkeepingEntries];
    let unmatchCount = 0;

    await updateProgress(40);
    matchIdsToUnmatch.forEach(matchId => {
      const result = unmatchEntriesByMatchId(matchId, currentBankEntries, currentBookkeepingEntries);
      currentBankEntries = result.updatedBankEntries;
      currentBookkeepingEntries = result.updatedBookkeepingEntries;
      unmatchCount++;
    });
    await updateProgress(80);

    setBankEntries(currentBankEntries);
    setBookkeepingEntries(currentBookkeepingEntries);
    setMatchGroups(prev => prev.filter(mg => !matchIdsToUnmatch.has(mg.id)));
    setSelectedBankEntryIds([]);
    setSelectedBookkeepingEntryIds([]);
    toast({ title: "Unmatch Successful", description: `Unmatched ${unmatchCount} group(s).` });
    await updateProgress(100);
    setTimeout(() => setIsProcessing(false), 500);
  }, [selectedBankEntryIds, selectedBookkeepingEntryIds, bankEntries, bookkeepingEntries, toast]);
  
  const handleReset = useCallback(() => {
    setBankEntries([]);
    setBookkeepingEntries([]);
    setSelectedBankEntryIds([]);
    setSelectedBookkeepingEntryIds([]);
    setUnmatchedCombinedEntries([]);
    setMatchGroups([]);
    setIsProcessing(false);
    setProgress(0);
    toast({ title: "Reset Complete", description: "All data has been cleared."});
  }, [toast]);

  const handleRowSelect = (source: 'bank' | 'bookkeeping' | 'unmatched', id: string, isSelected: boolean) => {
    const entry = source === 'bank' ? bankEntries.find(e => e.id === id) :
                  source === 'bookkeeping' ? bookkeepingEntries.find(e => e.id === id) :
                  unmatchedCombinedEntries.find(e => e.id === id);

    if (!entry) return;

    const actualSource = entry.source; 

    if (actualSource === 'bank') {
      setSelectedBankEntryIds(prev => isSelected ? [...prev, id] : prev.filter(item => item !== id));
    } else {
      setSelectedBookkeepingEntryIds(prev => isSelected ? [...prev, id] : prev.filter(item => item !== id));
    }
  };
  
  const canManualMatch =
    selectedBankEntryIds.length > 0 &&
    selectedBookkeepingEntryIds.length > 0 &&
    selectedBankEntryIds.every(id => bankEntries.find(e => e.id === id)?.status === 'unmatched') &&
    selectedBookkeepingEntryIds.every(id => bookkeepingEntries.find(e => e.id === id)?.status === 'unmatched');

  const canUnmatch = [...selectedBankEntryIds, ...selectedBookkeepingEntryIds].some(id => {
    const bankEntry = bankEntries.find(e => e.id === id && e.status === 'matched');
    const bookEntry = bookkeepingEntries.find(e => e.id === id && e.status === 'matched');
    return bankEntry || bookEntry;
  });
  const canAutoMatch = bankEntries.length > 0 && bookkeepingEntries.length > 0 && (bankEntries.some(e => e.status === 'unmatched') || bookkeepingEntries.some(e => e.status === 'unmatched'));

  const showFileUpload = bankEntries.length === 0 && bookkeepingEntries.length === 0;
  const showTransactionData = bankEntries.length > 0 || bookkeepingEntries.length > 0;


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
            <p className="text-sm text-center text-muted-foreground mt-2">Processing... {progress.toFixed(0)}%</p>
          </div>
        )}

        {showTransactionData && !isProcessing && (
          <>
            <BalanceSummary
              bankTotal={bankTotal}
              bookkeepingTotal={bookkeepingTotal}
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
            <AlertTitle>Getting Started</AlertTitle>
            <AlertDescription>
              Upload your bank statement and bookkeeping CSV files above to begin reconciling your transactions.
            </AlertDescription>
          </Alert>
        )}
        
        {showTransactionData && !isProcessing && (
          <Tabs defaultValue="unmatched" className="mt-6 w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="unmatched">Unmatched</TabsTrigger>
              <TabsTrigger value="bank">Bank</TabsTrigger>
              <TabsTrigger value="bookkeeping">Bookkeeping</TabsTrigger>
            </TabsList>
            <TabsContent value="unmatched" className="mt-4">
              <TransactionTable
                title="Unmatched Entries"
                entries={unmatchedCombinedEntries}
                selectedIds={[...selectedBankEntryIds, ...selectedBookkeepingEntryIds]} 
                onRowSelect={(id, isSelected) => handleRowSelect('unmatched', id, isSelected)}
                isProcessing={isProcessing}
              />
            </TabsContent>
            <TabsContent value="bank" className="mt-4">
              <TransactionTable
                title="Bank Entries"
                entries={bankEntries}
                selectedIds={selectedBankEntryIds}
                onRowSelect={(id, isSelected) => handleRowSelect('bank', id, isSelected)}
                isProcessing={isProcessing}
              />
            </TabsContent>
            <TabsContent value="bookkeeping" className="mt-4">
              <TransactionTable
                title="Bookkeeping Entries"
                entries={bookkeepingEntries}
                selectedIds={selectedBookkeepingEntryIds}
                onRowSelect={(id, isSelected) => handleRowSelect('bookkeeping', id, isSelected)}
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
