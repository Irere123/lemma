import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconLetterA } from "@tabler/icons-react";
import { z } from "zod";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useZodForm } from "@/hooks/use-zod-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useMemo, useEffect } from "react";

export const Route = createFileRoute("/_app/newsletter-settings")({
  component: NewsletterSettingsPage,
});

const newsletterSettingsSchema = z.object({
  id: z.string().optional(),
  newsletterName: z.string().min(1, "Newsletter name is required"),
  fromName: z.string().min(1, "From name is required"),
  logoUrl: z.string().optional(),
  brandColor: z.string().optional(),
  isActive: z.boolean().default(true),
  confirmationUrl: z.string().optional(),
});

function NewsletterSettingsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery(
    trpc.newsletter.getWriterNewsletterSettings.queryOptions()
  );

  const upsertMutation = useMutation(
    trpc.newsletter.upsertNewsletterSettings.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.newsletter.getWriterNewsletterSettings.queryKey(),
        });
        toast.success("Newsletter settings updated");
      },
      onError: (error) => {
        toast.error(error.message);
        queryClient.invalidateQueries({
          queryKey: trpc.newsletter.getWriterNewsletterSettings.queryKey(),
        });
      },
    })
  );

  const initial = useMemo(
    () => ({
      id: settings?.id,
      newsletterName: settings?.newsletterName,
      fromName: settings?.fromName,
      logoUrl: settings?.logoUrl ?? undefined,
      brandColor: settings?.brandColor ?? "#000000",
      isActive: settings?.isActive ?? true,
      confirmationUrl: settings?.confirmationUrl ?? undefined,
    }),
    [settings]
  );

  const form = useZodForm(newsletterSettingsSchema, {
    defaultValues: initial,
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        id: settings.id,
        newsletterName: settings.newsletterName,
        fromName: settings.fromName,
        logoUrl: settings.logoUrl ?? undefined,
        brandColor: settings.brandColor ?? "#000000",
        isActive: settings.isActive ?? true,
        confirmationUrl: settings.confirmationUrl ?? undefined,
      });
    }
  }, [settings, form]);

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

  function onSubmit(values: z.infer<typeof newsletterSettingsSchema>) {
    upsertMutation.mutate({
      id: values.id,
      newsletterName: values.newsletterName,
      fromName: values.fromName,
      logoUrl: values.logoUrl || undefined,
      brandColor: values.brandColor || undefined,
      isActive: values.isActive,
      confirmationUrl: values.confirmationUrl || undefined,
    });
  }

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

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="bg-card border border-border rounded-lg p-6 space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="newsletterName"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>Newsletter name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fromName"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>From name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmationUrl"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>Subscriber confirmation URL</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://your-domain.com/confirmation"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brandColor"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>Brand color</FormLabel>
                    <FormControl>
                      <Input
                        type="color"
                        {...field}
                        value={field.value ?? "#000000"}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>Active (accepts new subscribers)</FormLabel>
                    <FormControl>
                      <input
                        id={field.name}
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 accent-primary"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <input
                        id={field.name}
                        type="hidden"
                        value={field.value}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
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
          </form>
        </Form>
      </div>
    </div>
  );
}
