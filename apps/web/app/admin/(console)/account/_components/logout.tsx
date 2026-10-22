"use client";
import {Alert} from "@sohoin/ui/feedback";

import {useState} from "react";
import {LogOut} from "lucide-react";
import {Button} from "@sohoin/admin-ui/button";
export function LogoutButton(){const [pending,setPending]=useState(false);const [error,setError]=useState("");async function logout(){setPending(true);setError("");try{const response=await fetch("/api/auth/sign-out",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});if(!response.ok)throw new Error();window.location.assign("/admin/login");}catch{setError("退出失败，请重试。");setPending(false);}}return <div><Button variant="outline" disabled={pending} onClick={logout}><LogOut aria-hidden="true"/>{pending?"正在退出…":"退出登录"}</Button>{error&&<Alert variant="error">{error}</Alert>}</div>;}
