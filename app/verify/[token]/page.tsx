import type { Metadata } from "next";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import VerifyStatus from "./VerifyStatus";

export const metadata: Metadata = { title: "Confirm email — Beaver Gaming" };

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <>
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 w-full">
        <VerifyStatus token={token} />
      </main>
      <Footer />
    </>
  );
}
