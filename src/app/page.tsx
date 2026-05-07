"use client";
import React from "react";
import { NavBar } from "@/components/layouts/NavBar";
import { TranscriptReview } from "@/features/labeling";

export default function Home() {
  return (
    <main>
      <NavBar />
      <TranscriptReview />
    </main>
  );
}
