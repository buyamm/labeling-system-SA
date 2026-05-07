"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
    { href: "/", label: "Gán nhãn" },
    { href: "/stats", label: "Thống kê" },
    { href: "/import", label: "Import CSV" },
];

export function NavBar() {
    const pathname = usePathname();
    return (
        <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
            <div className="mx-auto flex items-center gap-1 px-6 py-2">
                {NAV_LINKS.map(({ href, label }) => {
                    const isActive = pathname === href;
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${isActive
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                }`}
                        >
                            {label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
