import { authClient } from "@/lib/auth-client";
import type { Route } from "./+types/page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Login" }];
}

export default function LoginPage() {
  return (
    <div className="w-full h-screen flex justify-center items-center">
      <button
        type="button"
        onClick={async () => {
          await authClient.signIn.social({
            provider: "google",
            callbackURL: `${import.meta.env.VITE_PUBLIC_APP_URL}/documents`,
          });
        }}
        className="bg-green-400 px-4 py-2 text-white rounded-md"
      >
        Login with google
      </button>
    </div>
  );
}
