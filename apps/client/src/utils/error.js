export function extractApiError(error, fallback) {
  const raw = error?.response?.data;
  const message = typeof raw === 'string'
    ? raw
    : typeof raw?.error === 'string'
      ? raw.error
      : typeof raw?.message === 'string'
        ? raw.message
        : null;

  if (!message) return fallback;
  return message.replace('verdinha_auth_required:', '').trim();
}
