interface Session { readonly id:string;readonly csrf:string;readonly sub:string;readonly exp:number; }
const encode=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
function decode(value:string):Uint8Array<ArrayBuffer>{if(!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('Invalid session');return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),ch=>ch.charCodeAt(0));}
async function key(secret:string){if(secret.length<64)throw new Error('Control session secret required');return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function readSession(cookie:string|null,secret:string,subject:string,now:number):Promise<Session|null>{
 try{const value=cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith('__Host-teach-control='))?.slice('__Host-teach-control='.length);if(!value||value.length>4096)return null;
 const parts=value.split('.');if(parts.length!==2)return null;const [payload,signature]=parts as [string,string];
 if(!await crypto.subtle.verify('HMAC',await key(secret),decode(signature),new TextEncoder().encode(payload)))return null;
 const session=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(payload))) as Session;
 return typeof session.id==='string'&&/^[a-f0-9-]{36}$/.test(session.id)&&typeof session.csrf==='string'&&/^[a-f0-9-]{36}$/.test(session.csrf)&&session.sub===subject&&Number.isSafeInteger(session.exp)&&session.exp>now?session:null;
 }catch{return null;}
}
export async function newSession(secret:string,subject:string,now:number){
 const session={id:crypto.randomUUID(),csrf:crypto.randomUUID(),sub:subject,exp:now+1800000};
 const payload=encode(new TextEncoder().encode(JSON.stringify(session)));const signature=encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),new TextEncoder().encode(payload))));
 return {session,cookie:`__Host-teach-control=${payload}.${signature}; Path=/; Max-Age=1800; HttpOnly; Secure; SameSite=Strict`};
}
