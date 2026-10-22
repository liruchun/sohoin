import {getOwnMediaResponse,errorResponse} from '@sohoin/core/server';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return await getOwnMediaResponse(request,(await params).id);}catch(error){return errorResponse(error);}}
export const HEAD=GET;
