import {uploadOwnVideo,errorResponse} from '@sohoin/core/server';
export const runtime='nodejs';
export const maxDuration=180;
export async function POST(request:Request){
 try{return Response.json(await uploadOwnVideo(request),{headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});}
 catch(error){return errorResponse(error);}
}
