import "server-only";
import { betterAuth } from "better-auth";
import { admin, bearer } from "better-auth/plugins";
import { getPool, consumeLimit } from "@sohoin/database";
import { createHash } from "node:crypto";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL) throw new Error("Configure BETTER_AUTH_SECRET and BETTER_AUTH_URL");
  return betterAuth({
    appName:"sohoin", baseURL, secret, database:getPool(), telemetry:{enabled:false},
    emailAndPassword:{enabled:true,disableSignUp:true,minPasswordLength:12,maxPasswordLength:128},
    session:{expiresIn:60*60*24*7,updateAge:60*60*24,cookieCache:{enabled:false}},
    trustedOrigins:[new URL(baseURL).origin], plugins:[admin(),bearer()],
    rateLimit:{ enabled:true,window:60,max:60,
      customRules:{"/sign-in/email":{window:60,max:10}},
      customStorage:{consume:async (key, rule) => {
        const result = await consumeLimit(createHash("sha256").update("auth:"+key).digest("hex"),rule.window,rule.max);
        return {allowed:result.allowed,retryAfter:result.allowed?null:result.retryAfter};
      }},
    },
    advanced:{ipAddress:{ipAddressHeaders:process.env.TRUSTED_CLIENT_IP_HEADER ? [process.env.TRUSTED_CLIENT_IP_HEADER] : []}},
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
