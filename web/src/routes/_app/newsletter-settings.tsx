import { createFileRoute } from "@tanstack/react-router";
import { useTRPC } from "@/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { IconEye, IconLetterA, IconSettings } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/newsletter-settings")({
  component: NewsletterSettingsPage,
});

function NewsletterSettingsPage() {
  const trpc = useTRPC();

  const { data: settings, isLoading } = useQuery(
    trpc.newsletter.getWriterNewsletterSettings.queryOptions()
  );

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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <IconLetterA className="w-8 h-8" />
            Newsletter Settings
          </h1>
          <p className="text-muted-foreground">
            Customize your newsletter branding and subscriber management
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"></div>

          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <IconSettings className="w-5 h-5" />
                Quick Tips
              </h2>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm">Newsletter Name</h4>
                  <p className="text-xs text-muted-foreground">
                    This appears in email headers and subscription confirmations
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm">From Email</h4>
                  <p className="text-xs text-muted-foreground">
                    Use a professional email address for better deliverability
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm">Brand Color</h4>
                  <p className="text-xs text-muted-foreground">
                    Used for buttons and accent elements in emails
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm">Logo URL</h4>
                  <p className="text-xs text-muted-foreground">
                    Optional logo that appears at the top of emails
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <IconEye className="w-5 h-5" />
                Preview
              </h2>
              <p className="text-xs text-muted-foreground">
                Your newsletter will look like this
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">From:</span>
                  <span>{settings?.fromName || "Your Name"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Newsletter:</span>
                  <span>{settings?.newsletterName || "Your Newsletter"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span
                    className={
                      settings?.isActive ? "text-green-600" : "text-red-600"
                    }
                  >
                    {settings?.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
