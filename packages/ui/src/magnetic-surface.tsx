"use client";

import {useEffect, useRef, type ComponentProps} from "react";
import {useReducedMotionPreference} from "./theme-provider";
import {cn} from "./utils";
import styles from "./magnetic-surface.module.css";

type MagneticSurfaceProps = Omit<ComponentProps<"span">, "ref"> & {
  disabled?: boolean;
  /** Radius and maximum displacement in CSS pixels, measured against the fixed parent. */
  radius?: number;
  maxOffset?: number;
  /** Pointer displacement multiplier before radius falloff and clamping. */
  strength?: number;
  /** Optional local ancestor to track instead of the nearest magnetic area. */
  areaSelector?: string;
};

/** Place directly inside a fixed button/link. An optional data-magnetic-area ancestor
 * extends pointer tracking beyond the control without expanding its click target. */
export function MagneticSurface({disabled=false, radius=112, maxOffset=10, strength=.3, areaSelector="[data-magnetic-area]", className, ...props}:MagneticSurfaceProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce=useReducedMotionPreference();

  useEffect(() => {
    const surface = ref.current;
    const anchor = surface?.parentElement;
    if (!surface || !anchor || disabled || reduce || !Number.isFinite(radius) || radius<=0 || !Number.isFinite(maxOffset) || maxOffset<=0 || !Number.isFinite(strength) || strength<=0) return;
    const area = anchor.closest<HTMLElement>(areaSelector) ?? anchor;
    const allowed = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    let pointer: {x:number;y:number} | null = null;
    let pressedPointer: number | null = null;

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      pointer = null;
      pressedPointer = null;
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancelPress);
      surface!.style.removeProperty("transform");
    }

    function update() {
      frame = 0;
      if (!pointer || !allowed.matches || anchor!.matches(":disabled, [aria-disabled='true'], :focus-visible")) { reset(); return; }
      const rect = anchor!.getBoundingClientRect();
      if (!rect.width || !rect.height) { reset(); return; }
      const x = pointer.x - rect.left - rect.width/2;
      const y = pointer.y - rect.top - rect.height/2;
      const distance = Math.hypot(x,y);
      if (distance>=radius || distance===0) { reset(); return; }
      // Smoothly enter the attraction zone, with no jump at its outer edge.
      const offset = Math.min(distance*strength, maxOffset) * (1-distance/radius);
      surface!.style.transform = `translate3d(${x/distance*offset}px, ${y/distance*offset}px, 0)`;
    }

    function move(event:PointerEvent) {
      if (pressedPointer!==null) return;
      if (!allowed.matches || event.pointerType!=="mouse" || event.buttons!==0) { reset(); return; }
      pointer = {x:event.clientX,y:event.clientY};
      if (!frame) frame = requestAnimationFrame(update);
    }

    function press(event:PointerEvent) {
      if (!allowed.matches || event.pointerType!=="mouse" || event.button!==0 ||
          !(event.target instanceof Node) || !anchor!.contains(event.target) ||
          anchor!.matches(":disabled, [aria-disabled='true']")) { reset(); return; }
      // Freeze the displayed offset, not the in-flight transition's target.
      const transform=getComputedStyle(surface!).transform;
      cancelAnimationFrame(frame);frame=0;
      pressedPointer=event.pointerId;
      surface!.style.transform=transform;
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", cancelPress);
    }

    function release(event:PointerEvent) {
      if (event.pointerId!==pressedPointer) return;
      pressedPointer=null;
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancelPress);
      if (area.matches(":hover")) move(event);
      else leave();
    }

    function cancelPress(event:PointerEvent) {
      if (event.pointerId===pressedPointer) { pressedPointer=null;leave(); }
    }

    // Only listen for page movement while the pointer is in this local region.
    function enter() {
      window.addEventListener("scroll", reset, {capture:true,passive:true});
      window.addEventListener("blur", reset);
    }
    function leave() {
      if (pressedPointer!==null) return;
      reset();
      window.removeEventListener("scroll", reset, true);
      window.removeEventListener("blur", reset);
    }

    area.addEventListener("pointerenter", enter);
    area.addEventListener("pointermove", move);
    area.addEventListener("pointerleave", leave);
    area.addEventListener("pointercancel", leave);
    area.addEventListener("pointerdown", press);
    area.addEventListener("keydown", reset);
    allowed.addEventListener("change", reset);
    return () => {
      pressedPointer=null;
      leave();
      area.removeEventListener("pointerenter", enter);
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerleave", leave);
      area.removeEventListener("pointercancel", leave);
      area.removeEventListener("pointerdown", press);
      area.removeEventListener("keydown", reset);
      allowed.removeEventListener("change", reset);
    };
  }, [disabled, reduce, radius, maxOffset, strength, areaSelector]);

  return <span {...props} ref={ref} data-magnetic-surface="" className={cn(styles.surface,className)}/>;
}
