const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// ============================================
// НАСТРОЙКИ — МЕНЯЙ ЗДЕСЬ
// ============================================

// Список подписчиков: пароль → { until: дата окончания, name: имя }
const SUBSCRIBERS = {
  "demo":       { until: "2027-01-01", name: "Тестовый доступ" },
  "coffee2025": { until: "2026-12-31", name: "Кофейня Минск" },
  "client1":    { until: "2026-06-01", name: "Клиент №1" }
};

// ============================================

export default async function handler(req, res) {
  // CORS-заголовки, чтобы браузер не блокировал запрос
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Password');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' });

  // 1. Проверяем пароль
  const password = req.headers['x-password'];
  if (!password) return res.status(401).json({ error: 'Пароль не передан' });

  const sub = SUBSCRIBERS[password];
  if (!sub) return res.status(401).json({ error: 'Неверный пароль' });

  // 2. Проверяем срок подписки
  const today = new Date().toISOString().slice(0, 10);
  if (today > sub.until) {
    return res.status(403).json({ error: `Подписка истекла ${sub.until}` });
  }

  // 3. Основная логика — вызов Groq
  try {
    const { messages, jsonMode } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Нужен массив messages' });
    }

    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000
    };

    if (jsonMode) body.response_format = { type: 'json_object' };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(500).json({ error: 'Groq: ' + errText });
    }

    const data = await groqRes.json();

    return res.status(200).json({
      content: data.choices[0].message.content,
      subscriber: sub.name,
      until: sub.until
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
