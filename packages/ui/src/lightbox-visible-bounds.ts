/** Visible rectangle, including clipping ancestors and the browser viewport. */
export function lightboxVisibleBounds(element:HTMLElement){
 const rect=element.getBoundingClientRect();
 let left=Math.max(0,rect.left),top=Math.max(0,rect.top);
 let right=Math.min(document.documentElement.clientWidth,rect.right),bottom=Math.min(window.innerHeight,rect.bottom);
 for(let parent=element.parentElement;parent;parent=parent.parentElement){
  const style=getComputedStyle(parent);
  const clipX=/hidden|clip|auto|scroll/.test(style.overflowX);
  const clipY=/hidden|clip|auto|scroll/.test(style.overflowY);
  if(!clipX&&!clipY)continue;
  const box=parent.getBoundingClientRect();
  const scaleX=parent.offsetWidth?box.width/parent.offsetWidth:1;
  const scaleY=parent.offsetHeight?box.height/parent.offsetHeight:1;
  if(clipX){const edge=box.left+parent.clientLeft*scaleX;left=Math.max(left,edge);right=Math.min(right,edge+parent.clientWidth*scaleX);}
  if(clipY){const edge=box.top+parent.clientTop*scaleY;top=Math.max(top,edge);bottom=Math.min(bottom,edge+parent.clientHeight*scaleY);}
 }
 return {left,top,right:Math.max(left,right),bottom:Math.max(top,bottom),width:Math.max(0,right-left),height:Math.max(0,bottom-top)};
}
