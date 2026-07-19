import type { Metadata } from "next";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import ForgotForm from "./ForgotForm";

export const metadata: Metadata = { title: "Reset password — Beaver Gaming" };

export default function ForgotPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 w-full">
        <ForgotForm />
      </main>
      <Footer />
    </>
  );
}
