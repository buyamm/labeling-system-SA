"use client";
import React from "react";
import { NavBar } from "@/components/layouts/NavBar";
import { Statistics } from "@/features/labeling/components/Statistics";

export default function StatsPage() {
    return (
        <main>
            <NavBar />
            <Statistics />
        </main>
    );
}
