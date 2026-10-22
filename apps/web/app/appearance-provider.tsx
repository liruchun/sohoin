"use client";
import {usePathname} from "next/navigation";
import type {ReactNode} from "react";
import {ThemeProvider} from "@sohoin/ui/theme-provider";
export function AppearanceProvider({children}:{children:ReactNode}){
 const pathname=usePathname();
 return <ThemeProvider enabled={!/^\/admin(?:\/|$)/.test(pathname)}>{children}</ThemeProvider>;
}
