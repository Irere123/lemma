import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { IconMail, IconCheck, IconX } from "@tabler/icons-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";

interface NewsletterSubscribeFormProps {
  variant?: "inline" | "card";
  title?: string;
  description?: string;
}

export const NewsletterSubscribeForm = ({
  variant = "card",
  title = "Subscribe to Newsletter",
  description = "Get the latest articles and updates delivered directly to your inbox.",
}: NewsletterSubscribeFormProps) => {
  const trpc = useTRPC();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const { mutate: subscribe, isPending } = useMutation({
    ...trpc.newsletter.subscribe.mutationOptions(),
    onSuccess: () => {
      setResult({
        type: "success",
        message:
          "Successfully subscribed! Please check your email to confirm your subscription.",
      });
      setEmail("");
    },
    onError: (error: any) => {
      setResult({
        type: "error",
        message: error.message || "Failed to subscribe. Please try again.",
      });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!email) {
      setResult({
        type: "error",
        message: "Please enter your email address.",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setResult({
        type: "error",
        message: "Please enter a valid email address.",
      });
      return;
    }

    subscribe({ email });
  };

  const isInline = variant === "inline";

  return (
    <div
      className={`${
        isInline ? "w-full" : "p-6 bg-white rounded-lg border border-gray-200"
      }`}
    >
      {!isInline && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <IconMail className="w-5 h-5" />
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">{description}</p>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            disabled={isPending}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Button
            type="submit"
            disabled={isPending}
            className="bg-neutral-600 hover:bg-neutral-700 text-white px-6 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <IconMail className="w-4 h-4 mr-2 animate-pulse" />
                Subscribing...
              </>
            ) : (
              <>
                <IconMail className="w-4 h-4 mr-2" />
                Subscribe
              </>
            )}
          </Button>
        </div>

        {result && (
          <div
            className={`flex items-start gap-2 p-3 rounded-md ${
              result.type === "success"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            {result.type === "success" ? (
              <IconCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <IconX className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <p
              className={`text-sm ${
                result.type === "success" ? "text-green-900" : "text-red-900"
              }`}
            >
              {result.message}
            </p>
          </div>
        )}
      </form>

      {!isInline && (
        <p className="text-xs text-gray-500 mt-4">
          We respect your privacy. Unsubscribe at any time.
        </p>
      )}
    </div>
  );
};
