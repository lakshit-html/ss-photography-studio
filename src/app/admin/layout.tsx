import React from 'react';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#0D0D0D]">
        {children}
      </div>
    </div>
  );
}
