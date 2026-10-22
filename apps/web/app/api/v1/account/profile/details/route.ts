import {getOwnMemberDetails,saveMemberDetails,checkWriteOrigin,readJson,errorResponse} from '@sohoin/core/server';
export async function GET(request:Request){try{return Response.json(await getOwnMemberDetails(request.headers),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request){try{checkWriteOrigin(request);return Response.json(await saveMemberDetails(request.headers,await readJson(request)),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return errorResponse(error);}}
