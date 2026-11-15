export function fmt(n: number, digits = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** Parses user-typed numbers such as "45,200" or "45200.5". Returns NaN when invalid. */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/[,\s]/g, '');
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
}

export function downloadFile(name: string, mime: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(name: string): string {
  return name.trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'vehicle';
}
