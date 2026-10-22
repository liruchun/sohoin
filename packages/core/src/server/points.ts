import "server-only";
import {
  runPointsTransaction,checkPointsActor,writePoints,readPointsBalance,readPointsEntries,
  PointsStoreError,type PointsClient,type PointsRow,
} from "@sohoin/database";
import {
  pointsMutationSchema,pointsReverseSchema,pointsQuerySchema,pointsSystemIdSchema,
  type PointsActor,type PointsEntry,
} from "@sohoin/extension-api/points";
import {userIdSchema} from "@sohoin/extension-api/users";
import {requireAdministrator,requireAuthenticatedUser,enforceLimit,ServiceError} from "./security";

function parse<T>(schema:{safeParse:(input:unknown)=>{success:true;data:T}|{success:false}},input:unknown):T{
  const result=schema.safeParse(input);
  if(!result.success)throw new ServiceError(400,"INVALID_POINTS_INPUT","积分参数无效");
  return result.data;
}
async function mapped<T>(work:()=>Promise<T>):Promise<T>{
  try{return await work();}catch(error){
    if(error instanceof PointsStoreError){
      const errors={
        forbidden:[403,"FORBIDDEN","当前账号没有管理权限"],
        missing:[404,"POINTS_ACCOUNT_NOT_FOUND","用户不存在"],
        entry_missing:[404,"POINTS_ENTRY_NOT_FOUND","积分流水不存在"],
        insufficient:[409,"POINTS_INSUFFICIENT","积分余额不足"],
        overflow:[409,"POINTS_BALANCE_LIMIT","积分余额超过上限"],
        conflict:[409,"POINTS_IDEMPOTENCY_CONFLICT","相同业务标识的积分参数不一致"],
        already_reversed:[409,"POINTS_ALREADY_REVERSED","该流水已冲正"],
        invalid_reversal:[409,"POINTS_INVALID_REVERSAL","不能对冲正流水再次冲正"],
      } as const;
      const [status,code,message]=errors[error.code];
      throw new ServiceError(status,code,message);
    }
    throw error;
  }
}
const entry=(row:PointsRow):PointsEntry=>({
  id:row.id,accountId:row.account_id,kind:row.kind,amount:Number(row.amount),balanceAfter:Number(row.balance_after),
  idempotencyKey:row.idempotency_key,sourceType:row.source_type,sourceId:row.source_id,reason:row.reason,
  actor:{kind:row.actor_kind,id:row.actor_id},reversalOf:row.reversal_of,createdAt:row.created_at.toISOString(),
});
function page(rows:PointsRow[]){
  return {items:rows.slice(0,30).map(entry),nextCursor:rows.length>30?rows[29].id:null};
}

function operations(actor:PointsActor,client:PointsClient){
  return {
    async credit(input:unknown){
      const value=parse(pointsMutationSchema,input);
      const result=await writePoints(client,actor,{...value,kind:"credit"});
      return {entry:entry(result.entry),replayed:result.replayed};
    },
    async debit(input:unknown){
      const value=parse(pointsMutationSchema,input);
      const result=await writePoints(client,actor,{...value,kind:"debit"});
      return {entry:entry(result.entry),replayed:result.replayed};
    },
    async reverse(input:unknown){
      const value=parse(pointsReverseSchema,input);
      const result=await writePoints(client,actor,{...value,kind:"reverse"});
      return {entry:entry(result.entry),replayed:result.replayed};
    },
    async getBalance(accountId:unknown){
      return {balance:await readPointsBalance(parse(userIdSchema,accountId),client)};
    },
    async listEntries(accountId:unknown,input:unknown={}){
      const id=parse(userIdSchema,accountId),query=parse(pointsQuerySchema,input);
      return page(await readPointsEntries(id,query.before,client));
    },
  };
}
type Operations=ReturnType<typeof operations>;

function service(resolveActor:()=>Promise<PointsActor>){
  async function transaction<T>(work:(context:{points:Operations;client:PointsClient})=>Promise<T>):Promise<T>{
    const actor=await resolveActor();
    return mapped(()=>runPointsTransaction(async client=>{
      await checkPointsActor(client,actor);
      const impl=operations(actor,client);
      let active=true,busy=false;
      let pending:Promise<unknown>|undefined;
      // Never let a retained service silently issue autocommit writes after COMMIT.
      function scoped<T>(fn:()=>Promise<T>):Promise<T>{
        if(!active||busy)return Promise.reject(new ServiceError(409,"POINTS_TRANSACTION_SCOPE","积分事务已结束或存在未完成的操作"));
        busy=true;
        const result=mapped(fn).finally(()=>{busy=false;});
        pending=result;
        // Attach a handler even if a callback accidentally forgets to await its operation.
        void result.catch(()=>{});
        return result;
      }
      const points:Operations={
        credit:input=>scoped(()=>impl.credit(input)),
        debit:input=>scoped(()=>impl.debit(input)),
        reverse:input=>scoped(()=>impl.reverse(input)),
        getBalance:id=>scoped(()=>impl.getBalance(id)),
        listEntries:(id,input)=>scoped(()=>impl.listEntries(id,input)),
      };
      try{
        const result=await work({points,client});
        if(busy)throw new ServiceError(409,"POINTS_TRANSACTION_PENDING","积分操作尚未完成");
        return result;
      }finally{
        active=false;
        // Drain before COMMIT/ROLLBACK so no late query escapes this transaction.
        await pending?.catch(()=>{});
      }
    }));
  }
  return {
    credit:(input:unknown)=>transaction(({points})=>points.credit(input)),
    debit:(input:unknown)=>transaction(({points})=>points.debit(input)),
    reverse:(input:unknown)=>transaction(({points})=>points.reverse(input)),
    getBalance:(accountId:unknown)=>transaction(({points})=>points.getBalance(accountId)),
    listEntries:(accountId:unknown,input:unknown={})=>transaction(({points})=>points.listEntries(accountId,input)),
    transaction,
  };
}

/** Privileged server-only capability. Never expose this factory or its inputs directly over HTTP. */
export function createSystemPointsService(systemId:string){
  const id=parse(pointsSystemIdSchema,systemId);
  return service(async()=>({kind:"system",id}));
}
/** Identity is derived from the session and rechecked in the database transaction. */
export function createAdminPointsService(headers:Headers){
  return service(async()=>{
    const actor=await requireAdministrator(headers);
    await enforceLimit("points-admin",actor.id,120,60);
    return {kind:"admin",id:actor.id};
  });
}
export async function getOwnPointsBalance(headers:Headers){
  const user=await requireAuthenticatedUser(headers);
  await enforceLimit("points-read",user.id,120,60);
  return mapped(async()=>({balance:await readPointsBalance(user.id)}));
}
export async function listOwnPointsEntries(headers:Headers,input:unknown={}){
  const user=await requireAuthenticatedUser(headers),query=parse(pointsQuerySchema,input);
  await enforceLimit("points-read",user.id,120,60);
  const result=page(await readPointsEntries(user.id,query.before));
  // Internal actors, idempotency keys and source identifiers are not user-facing data.
  return {...result,items:result.items.map(({id,kind,amount,balanceAfter,reason,reversalOf,createdAt})=>
    ({id,kind,amount,balanceAfter,reason,reversalOf,createdAt}))};
}
