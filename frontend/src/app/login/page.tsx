"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/atoms/Button";
import Field from "@/components/atoms/Field";

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "AUTH") return "Invalid email or password.";
    if (e.status === 429) return "Too many attempts - try again in a few minutes.";
    if (e.code === "VALIDATION") return e.message || "Check your details and try again.";
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong - try again.";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await api.login(email, password);
      router.replace(searchParams.get("next") || "/kits");
      router.refresh();
    } catch (err: unknown) {
      setError(errorText(err));
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="prose-display mb-8 inline-block text-xl tracking-tight">
          PrepKit
        </Link>
        <form className="card bg-paper" onSubmit={submit} noValidate>
          <p className="eyebrow">Welcome back</p>
          <h1 className="prose-display mt-2 text-3xl">Sign in</h1>
          <div className="mt-6 flex flex-col gap-4">
            <Field label="Email">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Field label="Password">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>
          </div>
          {error && (
            <p className="mt-4 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button className="mt-6 w-full" type="submit" pending={pending}>
            Sign in
          </Button>
          <p className="mt-5 text-center text-sm text-pebble">
            Need an account?{" "}
            <Link href="/register" className="font-medium text-charcoal underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
