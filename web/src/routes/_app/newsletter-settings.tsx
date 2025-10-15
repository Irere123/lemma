import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconLetterA } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { useTRPC } from "@/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/newsletter-settings")({
  component: NewsletterSettingsPage,
});

function NewsletterSettingsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery(
    trpc.newsletter.getWriterNewsletterSettings.queryOptions()
  );

  const upsertMutation = useMutation(
    trpc.newsletter.upsertNewsletterSettings.mutationOptions()
  );

  const initial = useMemo(
    () => ({
      id: settings?.id ?? "",
      newsletterName: settings?.newsletterName ?? "",
      fromName: settings?.fromName ?? "",
      logoUrl: settings?.logoUrl ?? "",
      brandColor: settings?.brandColor ?? "#000000",
      isActive: settings?.isActive ?? true,
    }),
    [settings]
  );

  const [newsletterName, setNewsletterName] = useState(initial.newsletterName);
  const [fromName, setFromName] = useState(initial.fromName);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [brandColor, setBrandColor] = useState(initial.brandColor);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    setNewsletterName(initial.newsletterName);
    setFromName(initial.fromName);
    setLogoUrl(initial.logoUrl ?? "");
    setBrandColor(initial.brandColor);
    setIsActive(initial.isActive);
  }, [
    initial.newsletterName,
    initial.fromName,
    initial.logoUrl,
    initial.brandColor,
    initial.isActive,
  ]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!newsletterName.trim()) {
      setResult({ type: "error", message: "Newsletter name is required" });
      return;
    }
    if (!fromName.trim()) {
      setResult({ type: "error", message: "From name is required" });
      return;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(brandColor)) {
      setResult({ type: "error", message: "Brand color must be a valid hex" });
      return;
    }

    try {
      await upsertMutation.mutateAsync({
        id: initial.id || undefined,
        newsletterName: newsletterName.trim(),
        fromName: fromName.trim(),
        logoUrl: logoUrl?.trim() || undefined,
        brandColor: brandColor,
        isActive,
      });
      setResult({ type: "success", message: "Settings saved" });
      // Soft refetch
      queryClient.invalidateQueries({
        queryKey: trpc.newsletter.getWriterNewsletterSettings.queryKey(),
      });
    } catch (error: any) {
      setResult({
        type: "error",
        message: error?.message || "Failed to save settings",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
            <IconLetterA className="w-8 h-8" />
            Newsletter Settings
          </h1>
          <p className="text-muted-foreground">
            Customize your newsletter branding and subscriber management
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-lg p-6 space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="newsletterName"
                className="text-sm text-muted-foreground"
              >
                Newsletter name
              </label>
              <input
                id="newsletterName"
                type="text"
                value={newsletterName}
                onChange={(e) => setNewsletterName(e.target.value)}
                placeholder="My Newsletter"
                className="bg-background text-foreground h-10 rounded-md border border-input px-3 outline-none placeholder:text-muted-foreground focus:border-ring"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="fromName"
                className="text-sm text-muted-foreground"
              >
                From name
              </label>
              <input
                id="fromName"
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Name or Brand"
                className="bg-background text-foreground h-10 rounded-md border border-input px-3 outline-none placeholder:text-muted-foreground focus:border-ring"
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label
                htmlFor="logoUrl"
                className="text-sm text-muted-foreground"
              >
                Logo URL (optional)
              </label>
              <input
                id="logoUrl"
                type="url"
                value={logoUrl || ""}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="bg-background text-foreground h-10 rounded-md border border-input px-3 outline-none placeholder:text-muted-foreground focus:border-ring"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="brandColor"
                className="text-sm text-muted-foreground"
              >
                Brand color
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="brandColor"
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  placeholder="#000000"
                  className="bg-background text-foreground h-10 rounded-md border border-input px-3 outline-none placeholder:text-muted-foreground focus:border-ring w-full"
                />
                <input
                  aria-label="Pick brand color"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-12 rounded-md border border-input bg-background p-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <label htmlFor="isActive" className="text-sm text-foreground">
                Active (accepts new subscribers)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? "Saving..." : "Save settings"}
            </Button>
          </div>

          {result && (
            <div
              className={`rounded-md border p-3 text-sm ${
                result.type === "success"
                  ? "border-green-300 bg-green-50 text-green-900"
                  : "border-red-300 bg-red-50 text-red-900"
              }`}
            >
              {result.message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
