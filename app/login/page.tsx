import type { Metadata } from "next";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in — Beaver Gaming" };

/**
 * Server component on purpose. Header reaches the database to resolve the
 * signed-in user, so a "use client" page importing it would drag the mongodb
 * driver into the browser bundle — the failure that broke this project's
 * deploy once already. The interactive part lives in LoginForm.
 */
export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 w-full">
        <LoginForm />
      </main>
      <Footer />
    </>
  );
}
