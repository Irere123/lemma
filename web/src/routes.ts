import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  index("./routes/home.tsx"),

  // Auth
  route("/login", "./routes/(auth)/login/page.tsx"),

  // Application
  layout(
    "routes/publish/layout.tsx",
    prefix("/publish", [
      index("./routes/publish/page.tsx"),
      route("/editor", "routes/publish/editor/page.tsx"),
      route("/posts", "routes/publish/posts/page.tsx"),
    ])
  ),

  // Meta-files
  route("/*", "routes/not-found.tsx"),
] satisfies RouteConfig;
