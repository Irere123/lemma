import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { IconMail, IconCheck, IconX, IconLoader } from "@tabler/icons-react";

import { ProfileHeader } from "@/components/landing";
import { useTRPC } from "@/trpc/client";

export const Route = createFileRoute("/verify")({
  component: RouteComponent,
  head: () => {
    return { meta: [{ title: "Confirm Subscription - Newsletter" }] };
  },
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || "",
    };
  },
});

function RouteComponent() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const [isAutoConfirm, setIsAutoConfirm] = useState(!!token);

  const {
    mutate: confirm,
    isPending,
    isSuccess,
    isError,
    error,
  } = useMutation({
    ...trpc.newsletter.confirmation.mutationOptions(),
  });

  useEffect(() => {
    if (token && isAutoConfirm) {
      // Automatically confirm if token is present
      confirm({ token });
      setIsAutoConfirm(false);
    }
  }, [token, confirm, isAutoConfirm]);

  const handleManualConfirm = () => {
    if (token) {
      confirm({ token });
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ProfileHeader
        title="Confirm Subscription"
        current="Confirm"
        links={[
          { label: "About", to: "/" },
          { label: "Blog", to: "/posts" },
          { label: "Newsletter", to: "/newsletter" },
          { label: "GitHub", href: "https://github.com/irere123" },
        ]}
      />

      <section className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Confirm Your Subscription
          </h2>
          <p className="text-[15px] leading-7 text-neutral-800">
            Just one more step to start receiving our newsletter!
          </p>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
          {isPending && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <IconLoader className="w-5 h-5 text-blue-600 animate-spin" />
              <p className="text-sm text-blue-900">
                Confirming your subscription...
              </p>
            </div>
          )}

          {isSuccess && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-md">
                <IconCheck className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">
                    Subscription Confirmed! 🎉
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    You're all set! You'll now receive our newsletter with the
                    latest articles and updates.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  What's next?
                </h3>
                <ul className="space-y-2 text-sm text-neutral-700">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span>
                      You'll receive an email when we publish new content
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span>You can unsubscribe at any time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span>
                      Check out our{" "}
                      <button
                        onClick={() => navigate({ to: "/posts" })}
                        className="text-purple-600 hover:text-purple-700 underline"
                      >
                        latest articles
                      </button>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {isError && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-md">
                <IconX className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">
                    Confirmation Failed
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    {(error as any)?.message ||
                      "Something went wrong. This link may have expired or already been used."}
                  </p>
                </div>
              </div>

              {token && (
                <button
                  onClick={handleManualConfirm}
                  className="w-full px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  Try Again
                </button>
              )}

              <div className="pt-2">
                <p className="text-sm text-gray-600">
                  Need help?{" "}
                  <button
                    onClick={() => navigate({ to: "/newsletter" })}
                    className="text-purple-600 hover:text-purple-700 underline"
                  >
                    Subscribe again
                  </button>
                </p>
              </div>
            </div>
          )}

          {!isPending && !isSuccess && !isError && token && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-md">
                <IconMail className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    Ready to Confirm
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Click the button below to confirm your newsletter
                    subscription.
                  </p>
                </div>
              </div>

              <button
                onClick={handleManualConfirm}
                className="w-full px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                Confirm Subscription
              </button>
            </div>
          )}

          {!token && !isPending && !isSuccess && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-md">
                <IconX className="w-5 h-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    No Confirmation Token
                  </p>
                  <p className="text-xs text-gray-700 mt-1">
                    Please use the confirmation link from your welcome email.
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate({ to: "/newsletter" })}
                className="w-full px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                Go to Newsletter Page
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3 pt-4 border-t">
          <h3 className="text-lg font-semibold text-gray-900">
            Why confirm your email?
          </h3>
          <p className="text-sm text-neutral-700">
            We require email confirmation to ensure that you actually want to
            receive our newsletter and to protect against spam. This also helps
            us maintain a high-quality mailing list.
          </p>
        </div>
      </section>
    </main>
  );
}
