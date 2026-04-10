'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BudgetForm } from '@/components/forms/budget-form';

interface Budget {
  id: string;
  category: string;
  limit: number;
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!user) return;

    const budgetsPath = `users/${user.uid}/budgets`;
    const unsubscribeBudgets = onSnapshot(collection(db, budgetsPath), (snapshot) => {
      const fetchedBudgets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Budget[];
      setBudgets(fetchedBudgets);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, budgetsPath));

    // Fetch transactions for the current month to calculate spent amounts
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const txPath = `users/${user.uid}/transactions`;
    const q = query(
      collection(db, txPath),
      where('type', '==', 'expense'),
      where('date', '>=', startOfMonth.toISOString())
    );

    const unsubscribeTx = onSnapshot(q, (snapshot) => {
      const spent: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const cat = data.category;
        spent[cat] = (spent[cat] || 0) + data.amount;
      });
      setSpentByCategory(spent);
    }, (error) => handleFirestoreError(error, OperationType.LIST, txPath));

    return () => {
      unsubscribeBudgets();
      unsubscribeTx();
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-gray-500">Monitor your spending limits for this month.</p>
        </div>
        <BudgetForm />
      </div>

      {loading ? (
        <div className="text-gray-500">Loading budgets...</div>
      ) : budgets.length === 0 ? (
        <div className="text-gray-500">No budgets set. Create one to start tracking!</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {budgets.map((budget) => {
            const spent = spentByCategory[budget.category] || 0;
            const percentage = Math.min(100, (spent / budget.limit) * 100);
            const isOver = spent > budget.limit;
            
            return (
              <Card key={budget.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{budget.category}</CardTitle>
                    <span className={`text-sm font-medium ${isOver ? 'text-red-600' : 'text-gray-500'}`}>
                      ${spent.toFixed(2)} / ${budget.limit.toFixed(2)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress 
                    value={percentage} 
                    className={`h-2 ${isOver ? '[&>div]:bg-red-600' : percentage > 80 ? '[&>div]:bg-amber-500' : ''}`}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {isOver 
                      ? `You are $${(spent - budget.limit).toFixed(2)} over budget.` 
                      : `$${(budget.limit - spent).toFixed(2)} remaining.`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
