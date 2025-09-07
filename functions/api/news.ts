import { json } from './_utils';

function pickRich(r:any){ if(!r) return ''; if(Array.isArray(r)) return r.map(x=>x?.plain_text||'').join(''); return ''; }
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const aud = (new URL(request.url).searchParams.get('aud')||'AGENT').toLowerCase(); // 'agent' or 'admin'
  const db = env.NOTION_DB_BILLBOARD_ID;
  const token = env.NOTION_SECRET;
  if(!db || !token) return json({ error:'Notion env not set' }, 500);

  // Query the database (filter pinned & audience later client-side if you like)
  const r = await fetch(`https://api.notion.com/v1/databases/${db}/query`, {
    method:'POST',
    headers:{
      'Authorization':`Bearer ${token}`,
      'Notion-Version':'2022-06-28',
      'Content-Type':'application/json'
    },
    body: JSON.stringify({ page_size: 25, sorts: [{property:'Date',direction:'descending'}] })
  });

  if(!r.ok){
    const t = await r.text();
    return json({ items:[], note:'notion_error', status:r.status, detail:t }, r.status);
  }
  const data = await r.json();

  // Property mapping for your columns: Title, Text, Date, Date 1, Checkbox, Select/Select 1/Select 2
  const items = (data.results||[]).map((page:any)=>{
    const p = page.properties||{};
    const Title = p.Title?.title?.[0]?.plain_text || page?.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
    const Body  = pickRich(p.Text?.rich_text);
    const PublishedAt = p.Date?.date?.start || null;
    const ExpiresAt   = p['Date 1']?.date?.start || null;
    const Pinned = !!p.Checkbox?.checkbox;
    const Audience = p['Select']?.select?.name || p['Select 1']?.select?.name || p['Select 2']?.select?.name || 'all';
    return { Title, Body, PublishedAt, ExpiresAt, Pinned, Audience };
  }).filter(row=>{
    const a = String(row.Audience||'all').toLowerCase();
    if(aud==='admin') return true; // admin sees everything
    return a==='agents' || a==='all';
  });

  return json({ items });
};
