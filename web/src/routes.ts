import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  // Landing page
  index("./routes/home.tsx"),

  // Public blog
  route("/posts", "./routes/posts/page.tsx"),
  route("/posts/:slug", "./routes/posts/$slug/page.tsx"),

  // Newsletter
  route("/newsletter", "./routes/newsletter/page.tsx"),

  // Auth
  route("/login", "./routes/(auth)/login/page.tsx"),

  // Editorial
  layout("routes/(editorial)/layout.tsx", [
    route("/editor/:documentId", "routes/(editorial)/editor/page.tsx"),
    route("/documents", "routes/(editorial)/documents/page.tsx"),
  ]),

  // Developers
  layout("routes/(developers)/layout.tsx", [
    route("/developers", "routes/(developers)/developers/page.tsx"),
  ]),

  // Meta-files
  route("/*", "routes/not-found.tsx"),
] satisfies RouteConfig;
