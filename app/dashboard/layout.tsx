import { DashboardNav } from "@/components/DashboardNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <DashboardNav />
      {/*
        pt-14 on mobile offsets the fixed top bar (h-14).
        lg:pt-0 removes it on desktop where the sidebar is inline.
      */}
      <div className="flex-1 min-w-0 pt-14 lg:pt-0">{children}</div>
    </div>
  );
}
