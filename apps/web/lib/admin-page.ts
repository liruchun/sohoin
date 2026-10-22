import "server-only";
import {redirect} from "next/navigation";
import {ServiceError} from "@sohoin/core/server";
/** Shared layouts survive navigation; every page must handle expired access too. */
export async function adminRead<T>(read:()=>Promise<T>):Promise<T>{
 try{return await read();}catch(error){
  if(error instanceof ServiceError&&(error.status===401||error.status===403))redirect("/admin/login?reason=access-changed");
  throw error;
 }
}
