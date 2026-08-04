export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[æåàáâäã]/g, "a")
    .replace(/[øöòóôõ]/g, "o")
    .replace(/[üùúû]/g, "u")
    .replace(/[ëèéê]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/ñ/g, "n")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}