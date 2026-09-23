"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/atoms/Button";
import Field from "@/components/atoms/Field";

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return "That email is already registered - try signing in.";
    if (e.code === "VALIDATION") return e.message || "Check your details and try again.";
    if (e.status === 429) return "Too many attempts - try again in a few minutes.";
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong - try again.";
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await api.register(email, password);
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
          <p className="eyebrow">Free · no card needed</p>
          <h1 className="prose-display mt-2 text-3xl">Create account</h1>
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
            <Field label="Password" hint="At least 6 characters.">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
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
            Create account
          </Button>
          <p className="mt-5 text-center text-sm text-pebble">
            Have an account?{" "}
            <Link href="/login" className="font-medium text-charcoal underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
