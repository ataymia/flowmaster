(function(){
  const API = "/api";
  async function who(){ try{ const r=await fetch(API+"/whoami",{credentials:"include"}); if(!r.ok) return null; return await r.json(); }catch{return null;} }
  async function post(status){ try{ await fetch(API+"/events",{method:"POST",credentials:"include",headers:{'content-type':'application/json'},body:JSON.stringify({status})}); }catch{} }

  document.addEventListener('DOMContentLoaded', async ()=>{
    const me = await who();
    if (!me || !me.username){ location.href="/"; return; }
    // show/hide admin-only bits
    if (!(me.role==='ADMIN' || me.role==='SUPERADMIN')){
      document.querySelectorAll('.admin-only,[data-admin-only="true"]').forEach(el=> el.style.display='none');
    }
    // lightweight usage signal
    post("FLOWMASTER_OPEN");
    // expose user to the app if it wants it
    window.AllstarUser = me;
  });
})();
