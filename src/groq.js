// the only place I talk to Groq. the real hour math stays in logic.js because I don't trust an LLM with arithmetic.
// Groq does three jobs: nudge today's hours, chat about my numbers, and read a table I paste from the HRM app
import { fmtMin } from './logic';
import { getGroqKey } from './store';

const URL = 'https://api.groq.com/openai/v1/chat/completions';

async function chat({ model, messages, json = false, maxOut = 600 }) {
  const key = await getGroqKey();
  if (!key) throw new Error('Add your Groq API key in Settings first.');

  const body = { model, temperature: 0.2, messages };
  if (json) body.response_format = { type: 'json_object' };
  // the gpt-oss models think before answering, keep that short and hidden
  if (model.startsWith('openai/gpt-oss')) {
    body.reasoning_effort = 'low';
    body.include_reasoning = false;
    body.max_completion_tokens = maxOut + 1200;
  } else {
    body.max_tokens = maxOut;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const out = await res.json().catch(() => null);
    if (!res.ok) throw new Error(out?.error?.message || `Groq error ${res.status}`);
    return out?.choices?.[0]?.message?.content ?? '';
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Groq took too long to answer.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Groq reply was not valid JSON.');
  }
};

// ---------- 1. plan today ----------

const PLAN_SYSTEM = `You help an AI engineer plan how long to stay at the office today so that a monthly hours target is met.
You get JSON with the workload he typed, today's calendar meetings, the hours he still owes, the days left and an allowed range for today.
Start from equalSplitHours. Go up for heavy or deadline heavy workloads or lots of meetings that leave little focus time, go down for light ones.
"hours" must stay between allowedMin and allowedMax.
Reply with JSON only: {"hours": number, "reason": string, "tip": string}.
"reason" is one short sentence on why you chose that number. "tip" is one short sentence on how to order the day's work. Plain words, no emojis.`;

export async function askGroq({ model, workload, meetings, ctx }) {
  const payload = {
    date: ctx.date,
    workload: workload || '(nothing typed, use the meetings)',
    meetings: meetings ?? [],
    meetingMinutes: (meetings ?? []).reduce((a, m) => a + m.minutes, 0),
    hoursStillOwedThisMonth: Number(ctx.owed.toFixed(2)),
    workingDaysLeftIncludingToday: ctx.daysLeft,
    equalSplitHours: Number(ctx.range.equal.toFixed(2)),
    allowedMin: Number(ctx.range.lo.toFixed(2)),
    allowedMax: Number(ctx.range.hi.toFixed(2)),
    officeEnds: fmtMin(ctx.endMin),
    usualArrival: fmtMin(ctx.typicalArrival),
    usualHoursPerDay: ctx.typicalH == null ? null : Number(ctx.typicalH.toFixed(2)),
  };
  const text = await chat({
    model,
    json: true,
    maxOut: 400,
    messages: [
      { role: 'system', content: PLAN_SYSTEM },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  });
  const out = parseJson(text);
  const hours = Number(out.hours);
  if (!Number.isFinite(hours)) throw new Error('Groq reply had no hours in it.');
  return { hours, reason: String(out.reason ?? '').slice(0, 220), tip: String(out.tip ?? '').slice(0, 220) };
}

// ---------- 2. talk about my numbers ----------

const COACH_SYSTEM = `You are a calm assistant inside a personal office hours app for an AI engineer at a company that wants a monthly hours target.
Answer in plain short sentences, under 120 words unless asked for more. No emojis, no dashes used as punctuation.
Use only the numbers in the JSON context. Never invent or work out new totals yourself.
If he asks a what-if question that needs exact numbers, point him to the What-if section on the Insights tab.
Be honest if the numbers look bad, and give one practical next step.`;

export async function askCoach({ model, history, context }) {
  return chat({
    model,
    maxOut: 500,
    messages: [{ role: 'system', content: `${COACH_SYSTEM}\n\nContext:\n${JSON.stringify(context)}` }, ...history.slice(-8)],
  });
}

// ---------- 3. read a table pasted from the HRM app ----------

const IMPORT_SYSTEM = (today) => `Extract attendance rows from text a user pasted from an HR app.
Today is ${today}. Turn every date into YYYY-MM-DD, using the current year, or the previous year if that would put the date in the future.
Times must be 24 hour HH:MM. If a row has several punches use the first in and the last out. Skip rows that do not have both times.
Reply with JSON only: {"days":[{"date":"YYYY-MM-DD","in":"HH:MM","out":"HH:MM"}]}`;

export async function parseHrm({ model, text, today }) {
  const out = await chat({
    model,
    json: true,
    maxOut: 2500,
    messages: [
      { role: 'system', content: IMPORT_SYSTEM(today) },
      { role: 'user', content: text.slice(0, 6000) },
    ],
  });
  return parseJson(out);
}
