"use client";
import {Button} from "@sohoin/admin-ui/button";
import Link from "next/link";
export default function AdminError({reset}:{reset:()=>void}){return <div className="console-denied"><h1>后台暂时无法加载</h1><p className="au-muted">请稍后重试。若登录已失效，可以重新登录。</p><div className="console-error-actions"><Button variant="outline" onClick={reset}>重试</Button><Link href="/admin/login">重新登录</Link></div></div>;}
