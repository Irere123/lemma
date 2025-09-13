import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import nprogress from "nprogress";
import "nprogress/nprogress.css";

import { seo } from "@/utils/seo";
import appCss from "@/app.css?url";
import { DefaultCatchBoundary } from "@/components/default-catch-boundary";
import { Providers } from "@/providers";
import { createRouter } from "@/router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      ...seo({
        title: "Irere Emmanuel",
        description: `Software Engineer | AI Engineer`,
      }),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <div>Not found</div>,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const router = createRouter();

  router.subscribe(
    "onBeforeLoad",
    ({ pathChanged }) => pathChanged && nprogress.start()
  );
  router.subscribe("onLoad", () => nprogress.done());

  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <Providers>{children}</Providers>
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
