export function safeEventExportFilename(name: string, date: Date | null | undefined): string {
  const safeName = (name || 'event')
    .toLowerCase()
    .replace(/[æå]/g, 'a')
    .replace(/[øö]/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const datePart = date
    ? `-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : '';

  return `${safeName}${datePart}.xlsx`;
}