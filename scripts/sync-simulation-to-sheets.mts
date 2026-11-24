import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
const payload = JSON.parse(readFileSync('.runtime/simulation/google-sheets-anonymous.json','utf8'));
if (payload.manifest?.synthetic !== true) throw Error('Synthetic manifest required');
const tabs = Object.entries(payload.sheets) as [string, Record<string, unknown>[]][];
const allowed = ['SIM_Players','SIM_StudyRuns','SIM_Sessions','SIM_Assessments','SIM_ScenarioResults','SIM_EventsIndex','SIM_SystemLogs'];
if(tabs.some(([name])=>!allowed.includes(name))) throw Error('Unexpected tab');
if(JSON.stringify(payload).includes('full_name')) throw Error('Name fields forbidden');
const sheetId=process.env.GOOGLE_SHEETS_ID;
console.log(JSON.stringify({dry_run:!process.argv.includes('--apply'),sheet_id:sheetId || 'NOT_CONFIGURED',rows:Object.fromEntries(tabs.map(([name,rows])=>[name,rows.length]))}));
if(process.argv.includes('--apply')) {
 if(process.env.SIMULATION_UPLOAD_CONFIRM!=='true'||!sheetId) throw Error('Require GOOGLE_SHEETS_ID and SIMULATION_UPLOAD_CONFIRM=true');
 const sa=JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || '', 'base64').toString());
 const now=Math.floor(Date.now()/1000),b64=(o:unknown)=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const unsigned=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:sa.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const signature=createSign('RSA-SHA256').update(unsigned).sign(sa.private_key,'base64url');
 const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature})});
 if(!tokenResponse.ok) throw Error('Google authentication failed: '+tokenResponse.status);
 const token=(await tokenResponse.json()).access_token;
 const base='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(sheetId);
 const api=async(path:string,body?:unknown)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(`Google request failed ${r.status}`);return r.json();};
 const metadata=await api('?fields=sheets.properties.title');
 const existing=new Set(metadata.sheets.map((s:any)=>s.properties.title));
 // Refuse to overwrite any existing tab. Review/delete obsolete simulation tabs manually.
 if(tabs.some(([name])=>existing.has(name))) throw Error('SIM tabs already exist: refusing overwrite');
 await api(':batchUpdate',{requests:tabs.map(([title])=>({addSheet:{properties:{title}}}))});
 await api('/values:batchUpdate',{valueInputOption:'RAW',data:tabs.map(([name,records])=>{
 const keys=records.length?Object.keys(records[0]):['synthetic'];
 return {range:`'${name}'!A1`,values:[[payload.manifest.data_label],keys,...records.map(r=>keys.map(k=>r[k]===undefined?'':typeof r[k]==='object'?JSON.stringify(r[k]):r[k]))]};})});
 console.log('Uploaded synthetic anonymous tabs only.');
}
