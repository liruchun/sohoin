"use client";
import {createContext,useContext,useEffect} from "react";
import type {SiteContentHead} from "@sohoin/core/server";

export type DetailCheck={head?:SiteContentHead;unavailable?:boolean};
export const DetailValidationContext=createContext<(value:DetailCheck)=>void>(()=>{});
/** The async server slot confirms current visibility and revision without retransmitting the post. */
export function DetailValidation({head,unavailable}:DetailCheck){
 const validate=useContext(DetailValidationContext);
 useEffect(()=>{validate({head,unavailable});},[head,unavailable,validate]);
 return null;
}
