import "server-only";
import {reconcileAchievements,type AchievementMetrics} from "@sohoin/database";
import {requireAuthenticatedUser,enforceLimit} from "./security";

export const achievementRules=[
 {key:"soho-avatar",met:(m:AchievementMetrics)=>m.avatar},
 {key:"soho-first-step",met:(m:AchievementMetrics)=>m.posts>=1},
 {key:"soho-regular",met:(m:AchievementMetrics)=>m.posts>=20},
 {key:"soho-field-notes",met:(m:AchievementMetrics)=>m.tips>=5},
 {key:"soho-gear",met:(m:AchievementMetrics)=>m.gear>=3},
 {key:"soho-problem-solver",met:(m:AchievementMetrics)=>m.replies>=50},
 {key:"soho-supporter",met:(m:AchievementMetrics)=>m.likesGiven>=100},
 {key:"soho-recognized",met:(m:AchievementMetrics)=>m.likesReceived>=100},
 {key:"soho-indie-maker",met:(m:AchievementMetrics)=>m.products>=1},
 {key:"soho-seed-saver",met:(m:AchievementMetrics)=>m.seedMilestone},
 {key:"soho-conversation",met:(m:AchievementMetrics)=>m.discussion},
] as const;
export async function checkOwnAchievements(headers:Headers){
 const user=await requireAuthenticatedUser(headers);
 await enforceLimit("achievements-check",user.id,30,60);
 return {awarded:await reconcileAchievements(user.id,achievementRules.map(rule=>rule.key),metrics=>achievementRules.filter(rule=>rule.met(metrics)).map(rule=>rule.key))};
}
