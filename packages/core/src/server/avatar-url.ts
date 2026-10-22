import 'server-only';
/** Only local, permission-checked image routes can be rendered as member avatars. */
export function avatarUrl(value:string|null|undefined){
 return value&&(/^\/api\/site-media\/\d{4}\/\d{2}\/[a-f0-9]{32}\.webp$/.test(value)||/^\/api\/member-media\/(?=[a-z0-9]*[a-z])[a-z0-9]{10}$/.test(value))?value+'?variant=thumbnail':null;
}
