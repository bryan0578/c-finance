import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-c-finance',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await environment.cleanup();
});

describe('C-Finance Firestore rules', () => {
  it('allows an owner to create a valid transaction with a server timestamp', async () => {
    const db = environment.authenticatedContext('owner').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'users/owner/transactions/tx-1'), {
        uid: 'owner',
        type: 'expense',
        amount: 42.5,
        category: 'Groceries',
        date: '2026-07-17',
        note: '',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('denies access to another user financial records', async () => {
    const intruderDb = environment.authenticatedContext('intruder').firestore();
    await assertFails(getDoc(doc(intruderDb, 'users/owner/transactions/tx-1')));
  });

  it('rejects negative amounts', async () => {
    const db = environment.authenticatedContext('owner').firestore();
    await assertFails(
      setDoc(doc(db, 'users/owner/transactions/tx-invalid'), {
        uid: 'owner',
        type: 'expense',
        amount: -5,
        category: 'Invalid',
        date: '2026-07-17',
      })
    );
  });

  it('allows a bill link to be cleared without removing the transaction', async () => {
    const db = environment.authenticatedContext('owner').firestore();
    const reference = doc(db, 'users/owner/transactions/tx-linked');
    await assertSucceeds(
      setDoc(reference, {
        uid: 'owner',
        type: 'expense',
        amount: 100,
        category: 'Electric',
        date: '2026-07-17',
        linkedRecurringId: 'electric',
        linkedRecurringDueDate: '2026-07-20',
      })
    );
    await assertSucceeds(updateDoc(reference, { linkedRecurringId: null }));
  });

  it('does not allow a transaction owner to be changed', async () => {
    const db = environment.authenticatedContext('owner').firestore();
    await assertFails(
      updateDoc(doc(db, 'users/owner/transactions/tx-1'), { uid: 'intruder' })
    );
  });
});
