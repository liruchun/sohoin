"use client";
import type {ComponentProps} from "react";
import {Switch as Primitive} from "radix-ui";
import {cn} from "./utils";
import styles from "./switch.module.css";
export function Switch({className,...props}:ComponentProps<typeof Primitive.Root>){return <Primitive.Root className={cn(styles.root,className)} {...props}><Primitive.Thumb className={styles.thumb}/></Primitive.Root>;}
