"use client";
import {useTranslations} from 'next-intl';
import {X} from 'lucide-react';
import type {ContactKind} from '@sohoin/extension-api/profiles';
import {Dialog,DialogTrigger} from '@sohoin/ui/dialog';
import {DialogClose,DialogContent,DialogTitle} from '@sohoin/ui/dialog-content';
import {Button} from '@sohoin/ui/button';
import styles from './profile-panel.module.css';

export function ProfileContacts({contacts}:{contacts:{kind:ContactKind;text:string;qrUrl:string|null}[]}){
 const t=useTranslations('ProfileEditor'),ui=useTranslations('UI');
 if(!contacts.length)return null;
 return <div className={styles.contacts} aria-label={t('contacts')}>
  {contacts.map(contact=>contact.qrUrl?<Dialog key={contact.kind}><DialogTrigger asChild><Button variant="outline" size="sm">{t(contact.kind)}</Button></DialogTrigger><DialogContent className={styles.contactDialog} showCloseButton={false} aria-describedby={undefined}>
   <div className={styles.contactDialogHeader}><DialogTitle>{t(contact.kind)}</DialogTitle><DialogClose asChild><Button variant="ghost" size="icon-sm" aria-label={ui('close')}><X aria-hidden="true"/></Button></DialogClose></div>
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img className={styles.contactQr} src={contact.qrUrl} alt={t(contact.kind)} width={320} height={320}/>
  </DialogContent></Dialog>:<span key={contact.kind} className={styles.contactText}><span>{t(contact.kind)}</span><span>{contact.text}</span></span>)}
 </div>;
}
