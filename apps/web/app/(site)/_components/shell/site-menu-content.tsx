"use client";
import {useTranslations} from "next-intl";

import styles from "./site-menu-content.module.css";
import {ReadingLink as Link} from "../feedback/page-transition";
import type {ComponentProps} from "react";
import {DropdownMenuContent,DropdownMenuItem} from "@sohoin/ui/dropdown-menu-content";
export default function SiteMenuContent({onCloseAutoFocus}:{onCloseAutoFocus?:ComponentProps<typeof DropdownMenuContent>["onCloseAutoFocus"]}){
 const t=useTranslations("Web");return <DropdownMenuContent className={styles.panel} aria-label={t("siteMenu")} side="top" align="start" sideOffset={10} onCloseAutoFocus={onCloseAutoFocus}>
 <DropdownMenuItem asChild><Link href="/" prefetch={false}>{t("latest")}</Link></DropdownMenuItem>
 <DropdownMenuItem asChild><Link href="/featured" prefetch={false}>{t("featuredCommunity")}</Link></DropdownMenuItem>
 <DropdownMenuItem asChild><Link href="/community" prefetch={false}>{t("community")}</Link></DropdownMenuItem>
 <DropdownMenuItem asChild><Link href="/?feed=articles" prefetch={false}>{t("articles")}</Link></DropdownMenuItem>
</DropdownMenuContent>;}
