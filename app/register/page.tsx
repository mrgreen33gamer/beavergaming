import type { Metadata } from "next";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Create account — Beaver Gaming" };

export default function RegisterPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 w-full">
        <RegisterForm />
      </main>
      <Footer />
    </>
  );
}
