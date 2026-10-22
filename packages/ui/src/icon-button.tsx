import type {ComponentProps} from "react";
import {cva,type VariantProps} from "class-variance-authority";
import cn from "cn/lite";
import {Button} from "./button";
import styles from "./icon-button.module.css";

const iconButtonVariants=cva(styles.root,{
 variants:{animation:{none:"",menu:styles.menu,rotate:styles.rotate}},
 defaultVariants:{animation:"none"},
});
type IconButtonProps=Omit<ComponentProps<typeof Button>,"variant"|"size">&VariantProps<typeof iconButtonVariants>&{active?:boolean};

export function IconButton({className,animation="none",active=false,...props}:IconButtonProps){
 return <Button variant="plain" size="icon" data-icon-active={active} className={cn(iconButtonVariants({animation}),className)} {...props}/>;
}
