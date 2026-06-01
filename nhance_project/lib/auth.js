export const demoUserKey = 'nhanceme_user';
export function getUser(){ if(typeof window==='undefined') return null; try{return JSON.parse(localStorage.getItem(demoUserKey)||'null')}catch{return null}}
export function signIn(email,password){ const user={email,name:email.split('@')[0],plan:'Launch Demo',createdAt:new Date().toISOString()}; localStorage.setItem(demoUserKey,JSON.stringify(user)); return user; }
export function signOut(){ localStorage.removeItem(demoUserKey); window.location.href='/login'; }
export function requireUser(router){ const user=getUser(); if(!user){router.replace('/login'); return null} return user; }
