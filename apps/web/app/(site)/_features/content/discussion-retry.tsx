"use client";
import {useTranslations} from "next-intl";

import {useRouter} from "next/navigation";
import {useTransition} from "react";
import {Button} from "@sohoin/ui/button";
export function DiscussionRetry(){
 const t=useTranslations("Web");
 const router=useRouter(),[pending,startTransition]=useTransition();
 return <Button variant="link" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}>{pending?t("retrying"):t("retryLoad")}</Button>;
}
