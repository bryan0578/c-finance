'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TransactionForm } from '@/components/forms/transaction-form';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  date: string;
  note: string;
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/transactions`;
    const q = query(collection(db, path), orderBy('date', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-gray-500">Manage your income and expenses.</p>
        </div>
        <TransactionForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4 text-gray-500">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No transactions found. Add one to get started!</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{format(new Date(tx.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="font-medium">{tx.note || tx.category}</TableCell>
                    <TableCell>{tx.category}</TableCell>
                    <TableCell className={`text-right ${tx.type === 'income' ? 'text-green-600' : ''}`}>
                      {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
