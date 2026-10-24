import { GoogleGenAI } from "@google/genai";

// If the main model is overloaded or slow, one retry goes to this model instead.
// Set GEMINI_FALLBACK_MODEL to another model name, or to an empty value to turn it off.
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash";

type Generate = GoogleGenAI["models"]["generateContent"];

// Errors that are worth retrying on another model: overloaded, unavailable,
// deadline expired, rate limited, or timed out.
function isRetryable(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return /\b(429|500|502|503|504)\b|UNAVAILABLE|DEADLINE|Deadline expired|high demand|overloaded|RESOURCE_EXHAUSTED|timeout|timed out|abort/i.test(
    text
  );
}

// Drop-in replacement for `new GoogleGenAI({ apiKey })`.
// Same `ai.models.generateContent(...)` call, but it fails over once.
export function createResilientAI(apiKey: string) {
  const generateContent = (async (params: Parameters<Generate>[0]) => {
    const attempts = [
      { model: params.model, timeout: 22000 },
      ...(FALLBACK_MODEL && FALLBACK_MODEL !== params.model
        ? [{ model: FALLBACK_MODEL, timeout: 18000 }]
        : []),
    ];

    let lastError: unknown;

    for (const attempt of attempts) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { timeout: attempt.timeout },
      });

      try {
        return await ai.models.generateContent({ ...params, model: attempt.model });
      } catch (error) {
        lastError = error;
        console.error(`Gemini call failed on ${attempt.model}:`, error);
        if (!isRetryable(error)) throw error;
      }
    }

    throw lastError;
  }) as Generate;

  return { models: { generateContent } };
}