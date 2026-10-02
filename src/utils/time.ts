const MONTHS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const pad = (n: number) => String(n).padStart(2, '0');

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Diferença em dias de calendário entre hoje e a data. */
function daysAgo(date: Date, now = new Date()) {
  return Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
}

/** "14:32" */
export function formatClock(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Separador de dia no chat: "Hoje", "Ontem", "quarta", "12 de set." ou "12 de set. de 2025". */
export function formatDay(iso: string, now = new Date()) {
  const d = new Date(iso);
  const diff = daysAgo(d, now);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return WEEKDAYS[d.getDay()].replace(/^./, (c) => c.toUpperCase());
  const base = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} de ${d.getFullYear()}`;
}

/** Horário curto na lista de conversas: "agora", "5 min", "14:32", "ontem", "12/09". */
export function formatShort(iso: string, now = new Date()) {
  const d = new Date(iso);
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const diff = daysAgo(d, now);
  if (diff === 0) return formatClock(iso);
  if (diff === 1) return 'ontem';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export const isSameDay = (a: string, b: string) => startOfDay(new Date(a)) === startOfDay(new Date(b));
