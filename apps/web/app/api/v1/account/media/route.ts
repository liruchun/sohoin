import {listOwnMedia,uploadOwnMedia,errorResponse} from '@sohoin/core/server';
export const runtime='nodejs';
export async function GET(request:Request){try{return Response.json(await listOwnMedia(request.headers,new URL(request.url).searchParams.get('before')??undefined,new URL(request.url).searchParams.get('kind')??'image'),{headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{return Response.json(await uploadOwnMedia(request),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return errorResponse(error);}}
