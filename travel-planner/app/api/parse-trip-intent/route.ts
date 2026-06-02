// app/api/parse-trip-intent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json();

    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return NextResponse.json(
        { error: 'Please provide a trip description (at least 5 characters).' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.5-flash' });

    const today = new Date();
    const defaultStart = new Date(today);
    defaultStart.setDate(defaultStart.getDate() + 30);
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setDate(defaultEnd.getDate() + 7);

    const prompt = `You are a travel intent parser. Extract structured travel preferences from the user's free-text description.

## User's Description
"${description.trim()}"

## Today's Date
${today.toISOString().split('T')[0]}

## Rules
1. Extract as many fields as you can from the description.
2. For fields not explicitly mentioned, set them to reasonable defaults based on context clues, or use the fallback defaults below.
3. Budget should be one of: "budget", "mid-range", or "luxury".
4. Travelers should be one of: "1", "2", "3-4", or "5+".
5. Dates should be in YYYY-MM-DD format. If the user mentions "next March" or "in June", calculate actual dates relative to today.
6. For comingFrom, if not mentioned, leave empty string.
7. For interests, combine any mentioned activities/preferences into a comma-separated string.
8. Set confidence (0.0-1.0) based on how much information was explicitly provided vs inferred.

## Fallback Defaults
- budget: "mid-range"
- startDate: "${defaultStart.toISOString().split('T')[0]}"
- endDate: "${defaultEnd.toISOString().split('T')[0]}"
- travelers: "2"
- interests: "sightseeing, local culture, food"

## Response Format (JSON only)
{
  "destination": "City or region name",
  "comingFrom": "Origin city/country or empty string",
  "budget": "budget" | "mid-range" | "luxury",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "travelers": "1" | "2" | "3-4" | "5+",
  "interests": "comma-separated interests",
  "confidence": 0.0-1.0,
  "inferredFields": ["list of field names that were inferred rather than explicitly stated"],
  "summary": "One sentence summary of the parsed trip"
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    const rawText = result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Attempt recovery
      const fixedText = rawText
        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
        .replace(/[\x00-\x1F\x7F]/g, ' ');
      parsed = JSON.parse(fixedText);
    }

    // Validate and normalize the response
    const normalized = {
      destination: parsed.destination || '',
      comingFrom: parsed.comingFrom || '',
      budget: ['budget', 'mid-range', 'luxury'].includes(parsed.budget)
        ? parsed.budget
        : 'mid-range',
      startDate: parsed.startDate || defaultStart.toISOString().split('T')[0],
      endDate: parsed.endDate || defaultEnd.toISOString().split('T')[0],
      travelers: ['1', '2', '3-4', '5+'].includes(parsed.travelers)
        ? parsed.travelers
        : '2',
      interests: parsed.interests || 'sightseeing, local culture, food',
      confidence: typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5,
      inferredFields: Array.isArray(parsed.inferredFields)
        ? parsed.inferredFields
        : [],
      summary: parsed.summary || `Trip to ${parsed.destination || 'your destination'}`,
    };

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('[parse-trip-intent] error:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse trip description',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
