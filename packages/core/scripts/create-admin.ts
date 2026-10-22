import {getAuth} from "../src/server/auth";
import {getPool} from "@sohoin/database";
const email=process.env.ADMIN_EMAIL;const password=process.env.ADMIN_PASSWORD;
if(!email||!password||password.length<12)throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters)");
try {
 const existing=await getPool().query('SELECT id FROM "user" WHERE email=$1',[email.toLowerCase()]);
 if(existing.rows.length)throw new Error("Account already exists; refusing to alter password or role");
 await getAuth().api.createUser({body:{email,password,name:"站点管理员",role:"admin"}});
 console.log("Administrator created. Public registration remains disabled.");
}finally{await getPool().end();}
