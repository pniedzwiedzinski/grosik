
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { TransactionEntry, MatchGroup } from '@/types/reconciliation';
import { parseCsv } from '@/lib/csvParser';
import { autoMatchEntries, manuallyMatchEntries, unmatchEntriesByMatchId } from '@/lib/reconciliationUtils';
import { ReconcileProHeader } from '@/components/reconcile-pro/ReconcileProHeader';
import { FileUploadArea } from '@/components/reconcile-pro/FileUploadArea';
import { ActionToolbar } from '@/components/reconcile-pro/ActionToolbar';
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

  const { toast } = useToast();

  useEffect(() => {
    const unmatchedBank = bankEntries.filter(e => e.status === 'unmatched');
    const unmatchedBook = bookkeepingEntries.filter(e => e.status === 'unmatched');
    const combined = [...unmatchedBank, ...unmatchedBook].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setUnmatchedCombinedEntries(combined);
  }, [bankEntries, bookkeepingEntries]);

  const updateProgress = (value: number) => {
    setProgress(value);
    return new Promise(resolve => setTimeout(resolve, 50)); // Small delay for UI update
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

      toast({ title: "Files Processed", description: "CSV files have been parsed." });
    } catch (error: any) {
      toast({
        title: "Error Processing Files",
        description: error.message || "Could not parse CSV files.",
        variant: "destructive",
      });
      setBankEntries(prev => bankFile ? newBankEntries : prev);
      setBookkeepingEntries(prev => bookkeepingFile ? newBookkeepingEntries : prev);
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
    }
    setSelectedBankEntryIds([]);
    setSelectedBookkeepingEntryIds([]);
    toast({ title: "Manual Match Successful", description: "Selected entries have been matched." });
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
  
  const canManualMatch = (selectedBankEntryIds.length > 0 && selectedBookkeepingEntryIds.length > 0) || (selectedBankEntryIds.length + selectedBookkeepingEntryIds.length > 1 && (selectedBankEntryIds.length === 0 || selectedBookkeepingEntryIds.length === 0));
  const canUnmatch = [...selectedBankEntryIds, ...selectedBookkeepingEntryIds].some(id => {
    const bankEntry = bankEntries.find(e => e.id === id && e.status === 'matched');
    const bookEntry = bookkeepingEntries.find(e => e.id === id && e.status === 'matched');
    return bankEntry || bookEntry;
  });
  const canAutoMatch = bankEntries.length > 0 && bookkeepingEntries.length > 0 && (bankEntries.some(e => e.status === 'unmatched') || bookkeepingEntries.some(e => e.status === 'unmatched'));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ReconcileProHeader />
      <main className="flex-grow container mx-auto px-4 md:px-8 pb-8">
        <FileUploadArea onFilesProcessed={handleFilesProcessed} />
        
        {isProcessing && (
          <div className="my-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-center text-muted-foreground mt-2">Processing... {progress.toFixed(0)}%</p>
          </div>
        )}

        {(bankEntries.length > 0 || bookkeepingEntries.length > 0) && !isProcessing && (
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
        )}

        {bankEntries.length === 0 && bookkeepingEntries.length === 0 && !isProcessing && (
          <Alert className="mt-6">
            <FileWarning className="h-4 w-4" />
            <AlertTitle>Getting Started</AlertTitle>
            <AlertDescription>
              Upload your bank statement and bookkeeping CSV files above to begin reconciling your transactions.
            </AlertDescription>
          </Alert>
        )}
        
        {(bankEntries.length > 0 || bookkeepingEntries.length > 0) && !isProcessing && (
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
