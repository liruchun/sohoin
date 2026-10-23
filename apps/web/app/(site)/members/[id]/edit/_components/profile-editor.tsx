"use client";

import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import type {MemberMedia,MemberProfileDetails} from "@sohoin/extension-api/profiles";
import {useTranslations} from "next-intl";
import {Check,Gamepad2,LocateFixed,Mail,MessageCircle,MessagesSquare,Phone,Send,X} from "lucide-react";
import {Button} from "@sohoin/ui/button";
import {InputGroup,InputGroupInput,InputGroupTextarea,InputGroupAddon,InputGroupButton} from "@sohoin/ui/input-group";
import {Select,SelectTrigger,SelectValue,SelectContent,SelectGroup,SelectItem} from "@sohoin/ui/select";
import {Dialog,DialogTrigger} from "@sohoin/ui/dialog";
import {DialogClose,DialogContent,DialogDescription,DialogTitle} from "@sohoin/ui/dialog-content";
import {FieldError} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import {ImagePicker} from "../../../../_features/media/image-picker";
import {MediaLibraryProvider} from "../../../../_features/media/media-library";
import {ProfileHeaderRegistration} from "../../../../_components/shell/profile-header-context";
import {ReadingLink} from "../../../../_components/feedback/reading-navigation";
import buttonStyles from "../../../../_components/content/detail-panel.module.css";
import styles from "./profile-editor.module.css";

const contacts=[
 {key:"wechat",icon:MessagesSquare,qr:true},
 {key:"whatsapp",icon:Phone,qr:false},
 {key:"line",icon:MessageCircle,qr:true},
 {key:"email",icon:Mail,qr:false},
 {key:"discord",icon:Gamepad2,qr:false},
 {key:"telegram",icon:Send,qr:false},
 {key:"phone",icon:Phone,qr:false},
 {key:"qq",icon:MessageCircle,qr:true},
 {key:"feishu",icon:Send,qr:true},
] as const;
type Contact=typeof contacts[number];
type ContactValue={text:string;file:MemberMedia|null};

function ContactEditor({contact,value,onChange}:{contact:Contact;value:ContactValue;onChange:(value:ContactValue)=>void}){
 const t=useTranslations("ProfileEditor"),[open,setOpen]=useState(false);
 const [text,setText]=useState(value.text),[file,setFile]=useState(value.file);
 const Icon=contact.icon,label=t(contact.key),filled=Boolean(value.text||value.file);
 function changeOpen(next:boolean){if(next){setText(value.text);setFile(value.file);}setOpen(next);}
 return <Dialog open={open} onOpenChange={changeOpen}>
  <DialogTrigger asChild><Button variant="outline" className={styles.contact} data-skeleton-part="block" data-filled={filled||undefined}>
   <Icon size="1.25rem" aria-hidden="true"/>{label}{filled&&<Check size=".875rem" aria-hidden="true"/>}
  </Button></DialogTrigger>
  <DialogContent className={styles.dialog}>
   <DialogTitle>{label}</DialogTitle>
   <DialogDescription>{t(contact.qr?"qrDescription":"textDescription",{name:label})}</DialogDescription>
   <form className={styles.contactForm} onSubmit={event=>{event.preventDefault();event.stopPropagation();onChange({text:text.trim(),file});setOpen(false);}}>
    {contact.qr?<ImagePicker file={file} onChange={setFile}/>:<div className={styles.field}>
     <label className="sr-only" htmlFor={`contact-${contact.key}`}>{label}</label>
     <InputGroup data-skeleton-part="block"><InputGroupInput id={`contact-${contact.key}`} type={contact.key==="email"?"email":contact.key==="phone"?"tel":"text"} maxLength={200} value={text} onChange={event=>setText(event.target.value)} placeholder={t(`${contact.key}Placeholder`)} autoComplete="off"/></InputGroup>
    </div>}
    <div className={styles.dialogActions}>
     {filled&&<Button variant="plain" className={styles.remove} onClick={()=>{onChange({text:"",file:null});setOpen(false);}}><X size="1rem" aria-hidden="true"/>{t("remove")}</Button>}
     <DialogClose asChild><Button variant="outline">{t("cancel")}</Button></DialogClose>
     <Button type="submit" disabled={contact.qr?!file:!text.trim()}>{t("done")}</Button>
    </div>
   </form>
  </DialogContent>
 </Dialog>;
}

/** Profile fields are saved together; image uploads remain in the private library. */
export function ProfileEditor({profile}:{profile:{publicId:string;name:string;bio:string;avatar:string|null}&MemberProfileDetails}){
 const t=useTranslations("ProfileEditor"),router=useRouter(),{notify}=useToast();
 const [uploading,setUploading]=useState(false);
 const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState("");
 const saveLock=useRef(false);
 const [name,setName]=useState(profile.name),[bio,setBio]=useState(profile.bio),[avatar,setAvatar]=useState<MemberMedia|null>(null);
 const [region,setRegion]=useState(profile.region),[locating,setLocating]=useState(false),[locationError,setLocationError]=useState("");
 const [coordinates,setCoordinates]=useState("");
 const [visibility,setVisibility]=useState<string>(profile.visibility);
 const [values,setValues]=useState<Partial<Record<Contact["key"],ContactValue>>>(()=>Object.fromEntries(profile.contacts.map(c=>[c.kind,{text:c.text,file:c.media}])));
 const version=useRef(profile.version);
 const draft={name,bio,region,visibility,avatarId:avatar?.id??null,contacts:contacts.flatMap(c=>{const v=values[c.key];return v&&(v.text||v.file)?[{kind:c.key,text:c.qr?"":v.text,mediaId:c.qr?v.file?.id??null:null}]:[];})};
 const fingerprint=JSON.stringify(draft);
 const [savedFingerprint,setSavedFingerprint]=useState(fingerprint),[hasSaved,setHasSaved]=useState(false);
 const dirty=fingerprint!==savedFingerprint;
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
 async function save(){
  if(saveLock.current||uploading||!dirty)return;saveLock.current=true;setSaving(true);setSaveError("");
  try{
   const response=await fetch("/api/v1/account/profile/details",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:version.current,...draft})});
   const result=await response.json();if(!response.ok)throw new Error(result.error?.message||t("saveError"));
   version.current=result.version;setSavedFingerprint(fingerprint);setHasSaved(true);
   notify({variant:"success",id:`profile-saved:${result.version}`,message:t("savedMessage")});
   router.refresh();
  }catch(error){setSaveError(error instanceof Error?error.message:t("saveError"));}
  finally{saveLock.current=false;setSaving(false);}
 }
 function locate(){
  if(locating)return;
  setLocationError("");
  if(!navigator.geolocation){setLocationError(t("locationUnavailable"));return;}
  setLocating(true);
  navigator.geolocation.getCurrentPosition(position=>{
   if(!mounted.current)return;
   setCoordinates(t("coordinates",{latitude:position.coords.latitude.toFixed(3),longitude:position.coords.longitude.toFixed(3)}));setLocating(false);
  },error=>{if(!mounted.current)return;setLocating(false);setLocationError(t(error.code===1?"locationDenied":"locationUnavailable"));},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
 }
 return <MediaLibraryProvider><section className={styles.panel} aria-labelledby="edit-profile-title" data-skeleton-item="">
  <ProfileHeaderRegistration publicId={profile.publicId} name={profile.name}/>
  <h1 id="edit-profile-title" data-skeleton-part="title" className={styles.title}>{t("title")}</h1>
  <form className={styles.form} inert={saving} aria-busy={saving} onSubmit={event=>{event.preventDefault();void save();}}>
   <div className={styles.field}><span data-skeleton-part="name">{t("avatar")}</span><ImagePicker file={avatar} onChange={setAvatar} avatar={profile.avatar} name={name} onBusyChange={setUploading}/></div>
   <div className={styles.field}><label data-skeleton-part="name" htmlFor="profile-nickname">{t("nickname")}</label><InputGroup data-skeleton-part="block"><InputGroupInput id="profile-nickname" value={name} onChange={event=>setName(event.target.value)} autoComplete="nickname" maxLength={80} required/></InputGroup></div>
   <div className={styles.field}><label data-skeleton-part="name" htmlFor="profile-bio">{t("bio")}</label><InputGroup data-skeleton-part="block"><InputGroupTextarea id="profile-bio" rows={3} maxLength={500} value={bio} onChange={event=>setBio(event.target.value)} aria-describedby="bio-count"/><InputGroupAddon align="block-end"><span id="bio-count">{bio.length}/500</span></InputGroupAddon></InputGroup></div>
   <div className={styles.field}>
    <label data-skeleton-part="name" htmlFor="profile-region">{t("region")}</label>
    <InputGroup data-skeleton-part="block"><InputGroupInput id="profile-region" value={region} onChange={event=>setRegion(event.target.value)} autoComplete="address-level2" maxLength={100} placeholder={t("regionPlaceholder")}/><InputGroupAddon align="inline-end"><InputGroupButton onClick={locate} disabled={locating}><LocateFixed size="1rem" aria-hidden="true"/>{t(locating?"locating":"locate")}</InputGroupButton></InputGroupAddon></InputGroup>
    {coordinates&&<p className={styles.hint} role="status">{coordinates}</p>}
    {locationError&&<FieldError id="location-error">{locationError}</FieldError>}
   </div>
   <section className={styles.contactField} aria-labelledby="contact-heading"><div className={styles.contactHeading}>
    <h2 id="contact-heading" data-skeleton-part="name">{t("contacts")}</h2>
    <Select value={visibility} onValueChange={setVisibility}>
     <SelectTrigger data-skeleton-part="block" aria-label={t("visibility")}><SelectValue/></SelectTrigger>
     <SelectContent><SelectGroup>
      <SelectItem value="public">{t("visibilityPublic")}</SelectItem>
      <SelectItem value="friends">{t("visibilityFriends")}</SelectItem>
      <SelectItem value="hidden">{t("visibilityHidden")}</SelectItem>
     </SelectGroup></SelectContent>
    </Select>
   </div><div className={styles.contacts}>
    {contacts.map(contact=><ContactEditor key={contact.key} contact={contact} value={values[contact.key]??{text:"",file:null}} onChange={value=>setValues(current=>({...current,[contact.key]:value}))}/>)}
   </div></section>
   {saveError&&<FieldError id="profile-save-error">{saveError}</FieldError>}
   <div className={styles.actions} data-skeleton-part="actions" data-magnetic-area="">
    <Button variant="plain" className={buttonStyles.back} data-skeleton-shape="" asChild><ReadingLink href={`/members/${profile.publicId}`}><MagneticSurface className={buttonStyles.backSurface}>{t("backToProfile")}</MagneticSurface></ReadingLink></Button>
    <Button variant="plain" className={buttonStyles.publish} data-skeleton-shape="" type="submit" disabled={saving||uploading||!dirty}><MagneticSurface className={buttonStyles.publishSurface} disabled={saving||uploading||!dirty}>{t(saving?"saving":hasSaved&&!dirty?"saved":"save")}</MagneticSurface></Button>
   </div>
  </form>
 </section></MediaLibraryProvider>;
}
