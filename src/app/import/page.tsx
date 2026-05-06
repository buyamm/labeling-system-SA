"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CSVImport } from "@/features/labeling";

export default function ImportPage() {
    return (
        <main>
            <NavBar />
            <CSVImport />
        </main>
    );
}

function NavBar() {
    return (
        <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
            <div className="mx-auto flex items-center gap-1 px-6 py-2">
                <NavLink href="/" label="Gán nhãn" />
                <NavLink href="/import" label="Import CSV" />
            </div>
        </nav>
    );
}

function NavLink({ href, label }: { href: string; label: string }) {
    const pathname = usePathname();
    const isActive = pathname === href;
    return (
        <Link
            href={href}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
        >
            {label}
        </Link>
    );
}
