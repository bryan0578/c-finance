import { NextResponse } from 'next/server';
import { z } from 'zod';
import firebaseConfig from '../../../firebase-applet-config.json';

const insightRequestSchema = z.object({
  totalIncome: z.number().finite().nonnegative().max(1_000_000_000),
  totalExpense: z.number().finite().nonnegative().max(1_000_000_000),
  upcomingBillsCount: z.number().int().nonnegative().max(10_000),
  categories: z.record(z.string().min(1).max(100), z.number().finite().nonnegative()).refine(
    (value) => Object.keys(value).length <= 100,
    'Too many categories'
  ),
});

const requestsByUser = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

async function verifyFirebaseToken(request: Request) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (!token) return null;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      cache: 'no-store',
    }
  );

  if (!response.ok) return null;
  const payload = (await response.json()) as { users?: Array<{ localId?: string }> };
  return payload.users?.[0]?.localId ?? null;
}

function isRateLimited(userId: string) {
  const now = Date.now();
  const current = requestsByUser.get(userId);

  if (!current || current.resetAt <= now) {
    requestsByUser.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (current.count >= RATE_LIMIT) return true;
  current.count += 1;
  return false;
}

export async function POST(request: Request) {
  try {
    const userId = await verifyFirebaseToken(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isRateLimited(userId)) {
      return NextResponse.json(
        { error: 'Insight limit reached. Try again later.' },
        { status: 429 }
      );
    }

    const parsed = insightRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid insight request' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI insights are not configured' },
        { status: 503 }
      );
    }

    const body = parsed.data;
    const prompt = `
      You are a helpful, concise financial advisor.
      Analyze the following user spending data for the current month.
      DO NOT perform any mathematical calculations yourself. Rely entirely on the provided totals.
      
      Data:
      - Total Income: $${body.totalIncome}
      - Total Expenses: $${body.totalExpense}
      - Upcoming Bills Count: ${body.upcomingBillsCount}
      - Spending by Category: ${JSON.stringify(body.categories)}
      
      Provide 3 short, actionable insights or tips on how the user can save money or manage their budget better based on their top spending categories. Format as a bulleted list. Keep it encouraging and brief.
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
        }),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const result = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const insights = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('\n')
      .trim();

    return NextResponse.json({ insights: insights || 'No insights were generated.' });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
