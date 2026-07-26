import { buildCoachRequestPayload, generateCoachFeedback } from '../domain/coachProvider.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }

  const payload = buildCoachRequestPayload(req.body || {});
  if (!payload.ok) {
    return res.status(payload.status).json({ ok: false, error: payload.error });
  }

  try {
    const result = await generateCoachFeedback(payload.userMessage);
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    return res.status(200).json({
      ok: true,
      feedback: result.feedback,
      model: result.model,
      provider: result.provider,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Coach feedback failed', error);
    return res.status(500).json({
      ok: false,
      error: 'Error interno al consultar al Coach.',
    });
  }
}
