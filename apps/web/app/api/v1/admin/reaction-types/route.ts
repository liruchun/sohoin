import {getAdminReactionTypes,errorResponse} from "@sohoin/core/server";
export async function GET(request:Request){try{return Response.json(await getAdminReactionTypes(request.headers),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
