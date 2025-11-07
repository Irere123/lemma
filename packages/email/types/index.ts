export interface DocumentData {
  id: string;
  title: string | null;
  subtitle: string | null;
  markdown: string | null;
  bannerImage: string | null;
  publishedDate: Date | null;
}

export interface NewsletterSettings {
  id: string;
  fromName: string;
  newsletterName: string;
  logoUrl: string | null;
  brandColor: string;
  baseUrl: string;
  confirmationUrl?: string;
}
