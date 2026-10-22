"use client";
import {Button} from "@sohoin/ui/button";
export default function ErrorPage({reset}:{reset:()=>void}){return <main><h1>页面暂时无法加载</h1><p>请稍后重试，或检查站点数据库连接。</p><Button onClick={reset}>重试</Button></main>;}
