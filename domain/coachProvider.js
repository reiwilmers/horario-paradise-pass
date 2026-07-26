import { buildCoachUserMessage, COACH_SYSTEM_PROMPT } from '../domain/coachPrompt.js';

export const MIN_REFLECTION_LENGTH = 20;

export function buildCoachRequestPayload(body = {}) {
  const {
    agentName = '',
    isoDate = '',
    reflection = '',
    scenario = '',
    snapshot = {},
  } = body;

  const trimmedReflection = String(reflection).trim();
  if (trimmedReflection.length < MIN_REFLECTION_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Describe tu caso con al menos ${MIN_REFLECTION_LENGTH} caracteres.`,
    };
  }

  const userMessage = buildCoachUserMessage({
    agentName: String(agentName).trim() || 'Vendedor',
    isoDate: String(isoDate).trim() || new Date().toISOString().slice(0, 10),
    reflection: trimmedReflection,
    scenario: String(scenario).trim(),
    snapshot,
  });

  return { ok: true, userMessage };
}

export async function generateCoachFeedback(userMessage) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.gemini_api_key;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    return generateWithGemini(geminiKey, userMessage);
  }
  if (openaiKey) {
    return generateWithOpenAI(openaiKey, userMessage);
  }

  return {
    ok: false,
    status: 503,
    error: 'Coach no configurado. Agrega GEMINI_API_KEY (gratis) en Vercel.',
  };
}

async function generateWithGemini(apiKey, userMessage) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: COACH_SYSTEM_PROMPT }],
      },
      contents: [{
        role: 'user',
        parts: [{ text: userMessage }],
      }],
      generationConfig: {
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Gemini error', response.status, errorBody);
    return {
      ok: false,
      status: 502,
      error: 'El Coach no pudo responder. Intenta de nuevo en unos segundos.',
    };
  }

  const payload = await response.json();
  const feedback = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!feedback) {
    return {
      ok: false,
      status: 502,
      error: 'El Coach respondió vacío. Intenta de nuevo.',
    };
  }

  return {
    ok: true,
    feedback,
    model: `gemini:${model}`,
    provider: 'gemini',
  };
}

async function generateWithOpenAI(apiKey, userMessage) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: COACH_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('OpenAI error', response.status, errorBody);
    return {
      ok: false,
      status: 502,
      error: 'El Coach no pudo responder. Intenta de nuevo en unos segundos.',
    };
  }

  const payload = await response.json();
  const feedback = payload?.choices?.[0]?.message?.content?.trim();

  if (!feedback) {
    return {
      ok: false,
      status: 502,
      error: 'El Coach respondió vacío. Intenta de nuevo.',
    };
  }

  return {
    ok: true,
    feedback,
    model,
    provider: 'openai',
  };
}
