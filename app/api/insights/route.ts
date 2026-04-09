import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return NextResponse.json({ insights: response.text });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
