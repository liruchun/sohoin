import "server-only";
import {getPool} from "./index";
// Session lock spans database transactions AND physical file operations.
import {MEDIA_STORAGE_LOCK} from "./advisory-locks";
export {MEDIA_STORAGE_LOCK};
export class MediaMaintenanceBusyError extends Error {constructor(){super("Media storage maintenance is busy");}}
export async function acquireMediaStorageLock(exclusive=false){
 const client=await getPool().connect();let acquired=false;
 try{const result=await client.query(exclusive?"SELECT pg_try_advisory_lock($1) AS locked":"SELECT pg_try_advisory_lock_shared($1) AS locked",[MEDIA_STORAGE_LOCK]);if(!result.rows[0].locked)throw new MediaMaintenanceBusyError();acquired=true;}
 finally{if(!acquired)client.release();}
 let released=false;return async()=>{if(released)return;released=true;let failed=false;try{await client.query(exclusive?"SELECT pg_advisory_unlock($1)":"SELECT pg_advisory_unlock_shared($1)",[MEDIA_STORAGE_LOCK]);}catch{failed=true;}finally{client.release(failed);} };
}
