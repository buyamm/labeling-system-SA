"use client";
import React, { useEffect, useState } from "react";
import { TranscriptReview } from "@/features/labeling";
import { useRouter } from "next/navigation";
import { segmentApi } from "@/features/labeling";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }
      
      try {
        await segmentApi.getSegments({ page: 1 });
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, [router]);

  if (isAuthenticated === null || isAuthenticated === false) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 border-solid" />
        <p className="text-sm font-medium text-slate-500">Đang đồng bộ dữ liệu...</p>
      </div>
    );
  }

  return (
    <main>
      <TranscriptReview />
    </main>
  );
}