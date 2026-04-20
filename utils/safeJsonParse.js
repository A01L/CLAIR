export function safeJsonParse(raw) {
  if (!raw || typeof raw !== "string") return {};

  // 1) как есть
  try { return JSON.parse(raw); } catch {}

  // 2) ```json ... ```
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try { return JSON.parse(fenced[1]); } catch {}
  }

  // 3) вырезаем первый JSON объект
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const slice = raw.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}
  }

  return {};
}
