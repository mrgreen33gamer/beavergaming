import type { Metadata } from "next";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import ResetForm from "./ResetForm";

export const metadata: Metadata = { title: "New password — Beaver Gaming" };

export default async function ResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <>
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 w-full">
        <ResetForm token={token} />
      </main>
      <Footer />
    </>
  );
}
