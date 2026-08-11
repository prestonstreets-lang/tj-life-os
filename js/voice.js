const amountFrom = value => Number(String(value || '').replace(/[^0-9.]/g, '')) || 0;

export function parseVoiceCommand(transcript) {
  const raw = String(transcript || '').trim();
  const text = raw.toLowerCase();
  if (!text) return { kind: 'empty' };

  const routeMatch = text.match(/^(?:go to|open|show)\s+(home|money|missions?|streaming|body|fitness|learning|self mastery|analytics|career|jobs?|settings)/);
  if (routeMatch) {
    const route = routeMatch[1].replace(/^mission$/, 'missions').replace(/^jobs?$/, 'career').replace(/^fitness$/, 'body').replace(/^self mastery$/, 'learning');
    return { kind: 'navigate', route };
  }

  const income = raw.match(/^(?:add|log|record)\s+income(?:\s+of)?\s+([$0-9,.]+)(?:\s+from\s+(.+))?/i);
  if (income) return { kind: 'capture', captureType: 'income', title: income[2]?.trim() || 'Voice income', amount: amountFrom(income[1]), detail: 'Voice logged income' };
  const expense = raw.match(/^(?:add|log|record)\s+(?:an?\s+)?expense(?:\s+of)?\s+([$0-9,.]+)(?:\s+for\s+(.+))?/i);
  if (expense) return { kind: 'capture', captureType: 'expense', title: expense[2]?.trim() || 'Voice expense', amount: amountFrom(expense[1]), detail: 'Voice logged expense' };
  const bill = raw.match(/^(?:add|log|record)\s+(?:a\s+)?bill\s+(.+?)(?:\s+for\s+([$0-9,.]+))?$/i);
  if (bill) return { kind: 'capture', captureType: 'bill', title: bill[1].trim(), amount: amountFrom(bill[2]), detail: 'Voice logged bill' };
  const jobWithCompany = raw.match(/^(?:add|save|track)\s+(?:a\s+)?job\s+(.+?)\s+at\s+(.+)$/i);
  if (jobWithCompany) return { kind: 'job', job: { title: jobWithCompany[1].trim(), company: jobWithCompany[2].trim(), description: raw } };
  const job = raw.match(/^(?:add|save|track)\s+(?:a\s+)?job\s+(.+)$/i);
  if (job) return { kind: 'job', job: { title: job[1].trim(), company: '', description: raw } };

  const water = raw.match(/^(?:add|log|record)\s+(?:(\d+(?:\.\d+)?)\s+(?:cups?|glasses?)\s+(?:of\s+)?water|water\s+(\d+(?:\.\d+)?)\s+(?:cups?|glasses?))/i);
  if (water) return { kind: 'bodyMetric', field: 'water', amount: Number(water[1] || water[2]), unit: 'cups' };
  const protein = raw.match(/^(?:add|log|record)\s+(\d+(?:\.\d+)?)\s+(?:grams?|g)\s+(?:of\s+)?protein/i);
  if (protein) return { kind: 'bodyMetric', field: 'protein', amount: Number(protein[1]), unit: 'g' };
  const calories = raw.match(/^(?:add|log|record)\s+(\d+(?:\.\d+)?)\s+calories/i);
  if (calories) return { kind: 'bodyMetric', field: 'calories', amount: Number(calories[1]), unit: 'cal' };

  const capturePatterns = [
    ['mission', /^(?:add|create|log)\s+(?:a\s+)?mission\s+(.+)/i],
    ['workout', /^(?:add|log|record)\s+(?:a\s+)?workout\s+(.+)/i],
    ['meal', /^(?:add|log|record)\s+(?:a\s+)?meal\s+(.+)/i],
    ['event', /^(?:add|create|log)\s+(?:an?\s+)?event\s+(.+)/i],
    ['stream', /^(?:add|log|record)\s+(?:a\s+)?stream\s+(.+)/i],
    ['note', /^(?:add|save|capture|remember)\s+(?:a\s+)?note\s+(.+)/i]
  ];
  for (const [captureType, pattern] of capturePatterns) {
    const match = raw.match(pattern);
    if (match) return { kind: 'capture', captureType, title: match[1].trim(), detail: 'Voice capture' };
  }
  return { kind: 'capture', captureType: 'note', title: raw, detail: 'Voice capture' };
}
