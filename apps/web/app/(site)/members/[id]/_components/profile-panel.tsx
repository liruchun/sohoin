import {useTranslations} from "next-intl";
import {CalendarDays,LayoutDashboard,Wrench,Sparkles,Briefcase,MessagesSquare} from "lucide-react";
import {Button} from "@sohoin/ui/button";
import {Tooltip,TooltipProvider} from "@sohoin/ui/tooltip";
import {RecentMentionVisit} from "../../../_components/content/recent-mention-members";
import {AuthorAvatar} from "../../../_components/content/author-avatar";
import {MedalIcon} from "../../../_components/content/medal-icon";
import {ProfileHeaderRegistration} from "../../../_components/shell/profile-header-context";
import styles from "./profile-panel.module.css";
import type {readSiteProfile} from "@/lib/site";
import type {ReactNode} from 'react';

type Profile=Awaited<ReturnType<typeof readSiteProfile>>;
const sections=[
 {key:"myBoard",icon:LayoutDashboard},
 {key:"toolCollection",icon:Wrench},
 {key:"skillCollection",icon:Sparkles},
 {key:"gearCollection",icon:Briefcase},
 {key:"profileInteractions",icon:MessagesSquare},
] as const;

export function ProfilePanel({profile,children}:{profile:Profile;children?:ReactNode}){
 const t=useTranslations("Web");
 const bio=profile.bio.replace(/\s+/gu," ").trim();
 const joined=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(profile.joinedAt));
 return <section className={styles.panel} aria-labelledby="profile-name" data-skeleton-item="">
  <RecentMentionVisit id={profile.publicId}/>
  <ProfileHeaderRegistration publicId={profile.publicId} name={profile.name}/>
  <div className={styles.identity}>
   <div className={styles.avatarRow}>
   <AuthorAvatar src={profile.avatar} name={profile.name} publicId={profile.publicId} wornBadge={profile.wornBadge}/>
   {profile.badges.length>0&&<TooltipProvider delayDuration={300}><ul className={styles.badges} aria-label={t("earnedProfileBadges")}>
    {profile.badges.map(badge=><li key={badge.key}><Tooltip label={badge.name}><Button variant="plain" size="icon-sm" className={styles.badgeButton} aria-label={badge.name}><span className={styles.badge}><MedalIcon badge={badge}/></span></Button></Tooltip></li>)}
   </ul></TooltipProvider>}
   </div>
   <div className={styles.details}>
   <h1 id="profile-name" className={styles.name} data-skeleton-part="title">{profile.name}</h1>
   <p className={styles.bio} data-skeleton-part="body">{bio||t("noBio")}</p>
   {profile.region&&<p className={styles.joined}>{profile.region}</p>}
   {children}
   <p className={styles.joined}>
    <CalendarDays size="1rem" aria-hidden="true"/>
    <span>{t("memberNumber",{number:profile.publicId})}</span>
    <time dateTime={profile.joinedAt}>{t("memberJoined",{date:joined})}</time>
   </p>
   </div>
  </div>
  <nav className={styles.sections} aria-label={t("profileSections")}>
   {/* Presentation-only menus: hover/focus feedback without claiming loaded content. */}
   {sections.map(({key,icon:Icon},index)=>index===0
    ?<span key={key} className={styles.current} aria-current="page"><Icon size="1rem" aria-hidden="true"/>{t(key)}</span>
    :<Button key={key} variant="plain" className={styles.tab}><Icon size="1rem" data-icon="inline-start" aria-hidden="true"/>{t(key)}</Button>)}
  </nav>
 </section>;
}
