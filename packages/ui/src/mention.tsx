"use client";
import {MentionContent as Content,MentionItem as Item} from '@diceui/mention';
import type {ComponentProps} from 'react';
import {cn} from './utils';
import styles from './mention.module.css';

export {MentionRoot as Mention,MentionInput,MentionLabel,MentionPortal} from '@diceui/mention';
export function MentionContent({className,...props}:ComponentProps<typeof Content>){return <Content className={cn('site-portal',styles.content,className)} sideOffset={6} collisionPadding={12} {...props}/>;}
export function MentionItem({className,...props}:ComponentProps<typeof Item>){return <Item className={cn(styles.item,className)} {...props}/>;}
