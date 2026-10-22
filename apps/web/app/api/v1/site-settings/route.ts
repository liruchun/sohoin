import {settingsService} from "@/lib/settings";
import {errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function GET(){try{const snapshot=await settingsService.readPublic();return Response.json(snapshot,{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
