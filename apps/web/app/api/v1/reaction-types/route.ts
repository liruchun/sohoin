import {getReactionTypes,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function GET(){try{return Response.json(await getReactionTypes(),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
