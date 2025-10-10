"use client";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const docsTabs = [
  {
    id: "Docs",
    label: "Docs",
    href: "docs",
  },
  {
    id: "Models",
    label: "Models",
    href: "models",
  },
  {
    id: "Examples",
    label: "Examples",
    href: "examples",
  },
  {
    id: "Guides",
    label: "Guides",
    href: "guides",
  },
  {
    id: "API Reference",
    label: "API Reference",
    href: "reference",
  },
  {
    id: "Showcase",
    label: "Showcase",
    href: "showcase",
  },
];

export const TabSwitcher = ({ className }: { className?: string }) => {
  const pathname = usePathname();

  const locale = pathname.split("/")[1];

  return (
    <div
      className={cn(
        "border-b-[0.5px] dark:border-b-[var(--border)] bg-[var(--light-color-surface-15)] dark:bg-[var(--primary-bg)] border-b-[var(--light-border-muted)]",
        className,
      )}
    >
      <div className="max-w-[var(--nextra-content-width)] mx-auto ">
        <nav
          className="flex gap-6 overflow-x-auto py-2 px-5 -ml-3"
          aria-label="Documentation tabs"
        >
          {docsTabs.map((tab) => {
            const isActive =
              pathname.includes(tab.href) ||
              pathname?.startsWith(`/${locale}/${tab.href}/`);

            return (
              <Link
                key={tab.id}
                href={`/${locale}/${tab.href}`}
                className={cn(
                  "flex min-w-fit relative x:focus-visible:nextra-focus gap-1.5 items-center px-0 py-1 text-sm font-medium transition-colors",
                  isActive
                    ? "dark:text-primary text-[var(--light-color-text-6)]"
                    : " dark:text-[var(--color-el-3)] text-[var(--light-color-text-4)] hover:text-[var(--light-color-text-6)] dark:hover:text-primary",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}

                {isActive && (
                  <motion.div
                    className="absolute -bottom-2 rounded left-0 w-full h-0.5 bg-[var(--light-color-text-6)] dark:bg-primary"
                    layoutId="active-tab"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
