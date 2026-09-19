export function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(iso, lang = 'de') {
  if (!iso) return '–';
  try {
    const locale = lang === 'en' ? 'en-GB' : lang === 'fr' ? 'fr-FR' : 'de-DE';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(iso + 'T12:00:00'));
  } catch {
    return '–';
  }
}

export function isNetworkError(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const message = String(error?.message || error || '');
  return /failed to fetch|network|fetch|timeout|offline|connection/i.test(message);
}
