module.exports=value=>{
  if(value===undefined||value===null||value==='')return '';
  if(typeof value!=='string')throw new Error('Enter a valid contact email or leave it blank.');
  const email=value.trim();
  if(!email)return '';
  if(email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw new Error('Enter a valid contact email or leave it blank.');
  return email;
};
