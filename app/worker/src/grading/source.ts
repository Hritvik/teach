import {z} from 'zod';
export interface SourceCaptureInput {readonly url:string;readonly locator:{readonly kind:'lines';readonly start:number;readonly end:number};readonly sourceVersion:string;}
export interface CapturedSource {readonly canonicalUrl:string;readonly sourceVersion:string;readonly locator:SourceCaptureInput['locator'];readonly passage:string;readonly sourceHash:string;readonly passageHash:string;readonly capturedAt:string;readonly provenance:{readonly authority:'public-source-capture';readonly transport:'public-only';readonly etag:string|null;readonly requestedVersion:string;readonly mime:string;readonly redirects:number};}
const inputSchema=z.strictObject({url:z.string().max(4096),locator:z.strictObject({kind:z.literal('lines'),start:z.number().int().positive(),end:z.number().int().positive()}),sourceVersion:z.string().min(1).max(1024)});
function publicUrl(value:string):URL{
 const url=new URL(value);const host=url.hostname;
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!host.includes('.')||host.endsWith('.')||/^\d+(?:\.\d+)*$/.test(host)||host.includes(':')||/\.(localhost|local|internal|invalid)$/.test(host))throw new Error('Named public HTTPS source required');
 return url;
}
export function parseSourceOrigins(value:string):readonly string[]{
 const values=z.array(z.string()).min(1).max(30).parse(JSON.parse(value));
 return [...new Set(values.map(value=>{const url=publicUrl(value);if(url.origin!==value)throw new Error('Exact source origin required');return url.origin;}))];
}
async function sha256(bytes:Uint8Array<ArrayBuffer>){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');}
async function bodyBytes(response:Response):Promise<Uint8Array<ArrayBuffer>>{
 if(!response.body)throw new Error('Source body unavailable');
 const length=response.headers.get('Content-Length');if(length&&Number(length)>1048576){await response.body.cancel();throw new Error('Source exceeds 1 MiB');}
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let total=0;
 try{while(true){const next=await reader.read();if(next.done)break;total+=next.value.byteLength;if(total>1048576){await reader.cancel();throw new Error('Source exceeds 1 MiB');}chunks.push(next.value);}}finally{reader.releaseLock();}
 const combined=new Uint8Array(total);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.byteLength;}return combined;
}
/** publicNetworkOnly asserts the trusted transport enforces public addresses at connect time, including DNS changes. */
export function createSourceCapture(policy:{readonly approvedOrigins:readonly string[];readonly publicNetworkOnly:boolean},deps:{readonly fetch?:typeof fetch;readonly now?:()=>Date}={}){
 if(!policy.publicNetworkOnly)throw new Error('Public-only network enforcement is required');
 const approved=new Set(parseSourceOrigins(JSON.stringify(policy.approvedOrigins)));const fetcher=deps.fetch??fetch;
 return async(input:SourceCaptureInput):Promise<CapturedSource>=>{
  const parsed=inputSchema.parse(input);if(parsed.locator.end<parsed.locator.start)throw new Error('Invalid source locator');
  const signal=AbortSignal.timeout(10000);let url=publicUrl(parsed.url);let response:Response|undefined;let redirects=0;
  while(true){if(!approved.has(url.origin))throw new Error('Source origin is not approved');
   response=await fetcher(url.href,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'text/plain, text/markdown;q=0.9'},signal});
   if(![301,302,303,307,308].includes(response.status))break;
   const location=response.headers.get('Location');await response.body?.cancel();if(!location||redirects===3)throw new Error('Source redirect refused');
   url=publicUrl(new URL(location,url).href);redirects++;
  }
  if(!response.ok)throw new Error('Source unavailable');
  const mime=response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  // Raw text is the initial supported format. HTML/PDF require a separate reviewed extractor.
  if(mime!=='text/plain'&&mime!=='text/markdown'){await response.body?.cancel();throw new Error('Unsupported source type');}
  const bytes=await bodyBytes(response);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);const lines=text.split('\n');
  if(parsed.locator.end>lines.length)throw new Error('Source locator is missing');
  const passage=lines.slice(parsed.locator.start-1,parsed.locator.end).join('\n');const selected=new TextEncoder().encode(passage);
  if(!passage.trim()||selected.byteLength>16384)throw new Error('Passage must be nonempty and at most 16 KiB');
  const sourceHash=await sha256(bytes);const etag=response.headers.get('ETag');
  return {canonicalUrl:url.href,sourceVersion:etag??`sha256:${sourceHash}`,locator:parsed.locator,passage,sourceHash,passageHash:await sha256(selected),capturedAt:(deps.now??(()=>new Date()))().toISOString(),provenance:{authority:'public-source-capture',transport:'public-only',etag,requestedVersion:parsed.sourceVersion,mime,redirects}};
 };
}
export function workerSourceCapture(origins:readonly string[]){
 const enforcing=typeof Cloudflare!=='undefined'&&Cloudflare.compatibilityFlags?.global_fetch_strictly_public===true;
 return createSourceCapture({approvedOrigins:origins,publicNetworkOnly:enforcing});
}
