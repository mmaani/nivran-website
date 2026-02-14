// src/lib/admin-lang.ts
import { cookies } from "next/headers";

export type AdminLang = "en" | "ar";

export async function getAdminLang(): Promise<AdminLang> {
  const c = await cookies();
  const v = c.get("admin_lang")?.value;
  return v === "ar" ? "ar" : "en";
}

const DICT = {
  en: {
    admin: "Admin",
    store: "Store",
    logout: "Logout",
    orders: "Orders",
    catalog: "Catalog",
    inbox: "Inbox",
    staff: "Staff",
    langToAr: "عربي",
    langToEn: "EN",
  },
  ar: {
    admin: "الإدارة",
    store: "المتجر",
    logout: "خروج",
    orders: "الطلبات",
    catalog: "الكتالوج",
    inbox: "الوارد",
    staff: "الموظفون",
    langToAr: "عربي",
    langToEn: "EN",
  },
} as const;

export function adminT(lang: AdminLang) {
  const d = DICT[lang];
  return (key: keyof typeof d) => d[key];
}
