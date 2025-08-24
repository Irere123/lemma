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

  // Publisher application
  route("/editor/:documentId", "routes/editor/page.tsx"),
  layout(
    "routes/publish/layout.tsx",
    prefix("/publish", [
      index("./routes/publish/page.tsx"),
      route("/posts", "routes/publish/posts/page.tsx"),
    ])
  ),

  // Meta-files
  route("/*", "routes/not-found.tsx"),
] satisfies RouteConfig;
