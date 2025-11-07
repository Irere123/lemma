import slugify from "slugify";

export function slugifyString(input: string): string {
  return slugify(input, { lower: true, strict: true });
}
