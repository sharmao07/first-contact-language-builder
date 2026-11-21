import { SessionFrame } from "@/components/session/frame";

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <SessionFrame code={code}>{children}</SessionFrame>;
}
