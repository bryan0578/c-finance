'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, orderBy, addDoc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { BillForm } from '@/components/forms/bill-form';
import { format, addMonths, addWeeks, addYears, isPast, isToday } from 'date-fns';

interface Bill {
  id: string;
  name: string;
  type: string;
  expectedAmount: number;
  frequency: string;
  nextDueDate: string;
}

export default function BillsPage() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/recurring`;
    const q = query(collection(db, path), orderBy('nextDueDate', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedBills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bill[];
      setBills(fetchedBills);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  const handleMarkPaid = async (bill: Bill) => {
    if (!user) return;

    try {
      // 1. Create a transaction for this bill
      const txPath = `users/${user.uid}/transactions`;
      await addDoc(collection(db, txPath), {
        uid: user.uid,
        type: 'expense',
        amount: bill.expectedAmount,
        category: bill.name,
        date: new Date().toISOString(),
        note: `Paid ${bill.name}`,
        linkedRecurringId: bill.id,
      });

      // 2. Update the bill's next due date
      const billDate = new Date(bill.nextDueDate);
      let nextDate = billDate;
      if (bill.frequency === 'monthly') nextDate = addMonths(billDate, 1);
      else if (bill.frequency === 'weekly') nextDate = addWeeks(billDate, 1);
      else if (bill.frequency === 'yearly') nextDate = addYears(billDate, 1);

      const billRef = doc(db, `users/${user.uid}/recurring`, bill.id);
      await updateDoc(billRef, {
        nextDueDate: nextDate.toISOString()
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/recurring/${bill.id}`);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bills & Subscriptions</h1>
          <p className="text-gray-500">Track your recurring expenses.</p>
        </div>
        <BillForm />
      </div>

      {loading ? (
        <div className="text-gray-500">Loading bills...</div>
      ) : bills.length === 0 ? (
        <div className="text-gray-500">No recurring bills found. Add one to get started!</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bills.map((bill) => {
            const dueDate = new Date(bill.nextDueDate);
            const isDueOrPast = isPast(dueDate) || isToday(dueDate);
            // Simple logic: if it's due in the future (more than 10 days), consider it "paid" for this cycle visually
            const isPaidForCycle = !isDueOrPast && dueDate.getTime() - new Date().getTime() > 10 * 24 * 60 * 60 * 1000;

            return (
              <Card key={bill.id} className={isPaidForCycle ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{bill.name}</CardTitle>
                    {isPaidForCycle && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  </div>
                  <CardDescription className="capitalize">{bill.type} • {bill.frequency}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-4">
                    {bill.expectedAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isDueOrPast ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      {isPaidForCycle ? 'Paid for this period' : `Due: ${format(dueDate, 'MMM d, yyyy')}`}
                    </span>
                    {!isPaidForCycle && (
                      <Button variant={isDueOrPast ? "default" : "outline"} size="sm" onClick={() => handleMarkPaid(bill)}>
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
