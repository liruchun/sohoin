export const metadata={robots:{index:false,follow:false}};
import type {ReactNode} from "react";
import {ToastProvider} from "@sohoin/ui/toast";
import "@sohoin/admin-ui/styles";
import "./admin.css";
export default function AdminLayout({children}:{children:ReactNode}) {return <div className="admin-root" lang="zh-CN"><ToastProvider>{children}</ToastProvider></div>;}
