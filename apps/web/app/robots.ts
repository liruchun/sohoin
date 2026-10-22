import type {MetadataRoute} from "next";
import {indexingEnabled,absolute} from "@/lib/site";
export const dynamic="force-dynamic";
export default function robots():MetadataRoute.Robots{return indexingEnabled()?{rules:{userAgent:"*",allow:"/"},sitemap:absolute("/sitemap.xml")}:{rules:{userAgent:"*",allow:"/"}};}
