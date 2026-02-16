"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  locale: "en" | "ar";
  label: string;
  className?: string;
};

export default function LocaleSwitchLink({ locale, label, className }: Props) {
  const pathname = usePathname() || `/${locale}`;
  const nextLocale = locale === "ar" ? "en" : "ar";

  const switchedPath = pathname.replace(/^\/(en|ar)(?=\/|$)/, `/${nextLocale}`) || `/${nextLocale}`;

  return (
    <Link href={switchedPath} className={className} prefetch={false}>
      {label}
    </Link>
  );
}
