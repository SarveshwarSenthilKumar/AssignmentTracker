import {useRef,useState} from 'react'
import {Github,ExternalLink,Loader2,Unlink} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'

export default function GitHubConnection({token,account,onChanged}){
  const [secret,setSecret]=useState(''),[editing,setEditing]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [repos,setRepos]=useState(null),[page,setPage]=useState(1),[more,setMore]=useState(false),[selected,setSelected]=useState(null),[path,setPath]=useState(''),[contents,setContents]=useState(null)
  const lock=useRef(false)
  const request=async(suffix,method='GET',body)=>{
    const response=await fetch(`/api/account/connections/github${suffix}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),data=await readApiJson(response)
    if(!response.ok)throw new Error(data.message||'Could not complete the GitHub request.')
    return data
  }
  const run=async(kind,action)=>{
    if(lock.current)return
    lock.current=true;setBusy(kind);setError('');setNotice('')
    try{await action()}catch(failure){setError(failure.message)}finally{lock.current=false;setBusy('')}
  }
  const connect=event=>{
    event.preventDefault()
    run('connect',async()=>{
      await request('/token','PUT',{token:secret});setSecret('');setEditing(false);setRepos(null);setSelected(null);setContents(null)
      setNotice('GitHub connected. Browse repositories to check what this token can access.');await onChanged()
    })
  }
  const disconnect=()=>run('disconnect',async()=>{
    await request('','DELETE');setSecret('');setEditing(false);setRepos(null);setSelected(null);setContents(null);setNotice('GitHub disconnected and the saved token removed.');await onChanged()
  })
  const browse=next=>run('repos',async()=>{
    const data=await request(`/repos?page=${next}`)
    setRepos(previous=>next===1?data.repositories:[...new Map([...(previous||[]),...data.repositories].map(repo=>[repo.id,repo])).values()]);setPage(next);setMore(data.hasMore);setSelected(null);setContents(null)
  })
  const open=(repo,nextPath='')=>run('contents',async()=>{
    const query=new URLSearchParams({owner:repo.owner,repo:repo.name,path:nextPath,ref:repo.defaultBranch||''})
    const data=await request(`/contents?${query}`)
    setSelected(repo);setPath(nextPath);setContents(data)
  })
  return <article className="account-connection-card github-connection">
    <div className="account-connection-heading"><Github size={24}/><h4>GitHub</h4><span className={account?.repositoryAccess?'is-connected':''}>{account?.repositoryAccess?'Connected':account?.connected?'Profile linked':'Not connected'}</span></div>
    {account?.connected&&<div className="account-connected-profile"><strong>{account.name||account.username}</strong><span>@{account.username}</span>{account.profileUrl&&<a href={account.profileUrl} target="_blank" rel="noopener noreferrer">View profile <ExternalLink size={13}/></a>}</div>}
    <p>Connect your own GitHub token to browse permitted repositories and files. No GitHub OAuth app setup is needed.</p>
    {(!account?.repositoryAccess||editing)&&<form onSubmit={connect} className="github-token-form">
      <p><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Create a fine-grained token on GitHub ↗</a>. Choose the repositories you want and grant <strong>Contents: Read-only</strong>. Metadata read access is also used. Organization access may require approval.</p>
      <label>Personal access token<input type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} maxLength={260} required disabled={!!busy} value={secret} onChange={event=>setSecret(event.target.value)} placeholder="github_pat_…"/></label>
      <p>The token is sent to this backend for GitHub requests and saved encrypted in your account. It is never saved in browser storage or sent to AI.</p>
      <div className="account-connection-actions"><button type="submit" disabled={!secret.trim()||!!busy}>{busy==='connect'?<Loader2 size={15} className="animate-spin"/>:null}Save GitHub connection</button>{editing&&<button type="button" disabled={!!busy} onClick={()=>{setEditing(false);setSecret('')}}>Cancel</button>}</div>
    </form>}
    <div className="account-connection-actions">
      {account?.repositoryAccess&&<><button type="button" disabled={!!busy} onClick={()=>browse(1)}>{busy==='repos'?'Loading repositories…':repos?'Refresh repositories':'Browse repositories'}</button><button type="button" disabled={!!busy} onClick={()=>setEditing(true)}>Replace token</button></>}
      {account?.connected&&<button type="button" disabled={!!busy} onClick={disconnect}><Unlink size={15}/>Disconnect</button>}
    </div>
    {repos&&!selected&&<section className="github-repositories" aria-label="Your GitHub repositories"><p>{repos.length} loaded · Only repositories permitted by this token are available.</p>{!repos.length&&<p>No repositories returned. Check the token’s repository selection and organization approval.</p>}{repos.map(repo=><div key={repo.id} className="github-repo"><button type="button" disabled={!!busy} onClick={()=>open(repo)}><strong>{repo.fullName}</strong><small>{repo.private?'Private':'Public'}</small>{repo.description&&<span>{repo.description}</span>}</button><a href={repo.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${repo.fullName} on GitHub`}>GitHub ↗</a></div>)}{more&&<button type="button" disabled={!!busy} onClick={()=>browse(page+1)}>Load more repositories</button>}</section>}
    {selected&&<section className="github-files" aria-label="Repository files"><h5>{selected.fullName}</h5><p>{path||'/'} · {selected.defaultBranch||'Default branch'}</p><div className="account-connection-actions"><button type="button" disabled={!!busy} onClick={()=>{setSelected(null);setContents(null)}}>← Repositories</button>{path&&<button type="button" disabled={!!busy} onClick={()=>open(selected,path.split('/').slice(0,-1).join('/'))}>↑ Parent folder</button>}<a href={selected.url} target="_blank" rel="noopener noreferrer">Open on GitHub ↗</a></div>
      {contents?.type==='directory'&&<div className="github-file-list">{!contents.entries.length&&<p>This folder is empty.</p>}{contents.entries.map(item=><button type="button" key={item.path} disabled={!!busy} onClick={()=>open(selected,item.path)}>{item.type==='dir'?'Folder':'File'} · {item.name}</button>)}{contents.entries.length>=1000&&<p>This directory may be truncated by GitHub. Open the repository on GitHub for the complete listing.</p>}</div>}
      {contents?.type==='file'&&<pre className="github-file-preview" tabIndex={0} aria-label="File contents">{contents.content}</pre>}
      {contents?.type==='unavailable'&&<p>{contents.message}</p>}
    </section>}
    {busy==='contents'&&<p role="status">Loading repository contents…</p>}{error&&<p role="alert" className="account-connection-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <p>Disconnect removes the saved credential from this app. Revoke the token in GitHub settings to invalidate it there too.</p>
  </article>
}
