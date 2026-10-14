export function validTimeZone(value) {
  if(typeof value!=='string'||!value||value.length>100)return false
  try {new Intl.DateTimeFormat('en',{timeZone:value}).format();return true} catch{return false}
}
async function lookup(url, signal, fetcher) {
  const response=await fetcher(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'})
  if(response.status===429)throw new Error('The lookup service is busy. Try again later or choose a time zone manually.')
  if(!response.ok)throw new Error('The lookup service is unavailable. Try again or choose a time zone manually.')
  const data=await response.json()
  if(data.error)throw new Error('The lookup service could not determine a location. Choose a time zone manually.')
  return data
}
export async function searchCityTimeZones(city,{signal,fetcher=fetch}={}) {
  const name=city.trim()
  if(name.length<2||name.length>100)throw new Error('Enter a city name between 2 and 100 characters.')
  const data=await lookup(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({name,count:'10',language:'en',format:'json'})}`,signal,fetcher)
  const seen=new Set()
  return (Array.isArray(data.results)?data.results:[]).filter(place=>{
    if(!place.name||!validTimeZone(place.timezone)||seen.has(place.id))return false
    seen.add(place.id);return true
  }).map(place=>({id:String(place.id),label:[place.name,place.admin1,place.country].filter(Boolean).join(', '),timeZone:place.timezone}))
}
export async function detectIPTimeZone({signal,fetcher=fetch}={}) {
  // Runs from the browser so the service sees the user's public IP, not the API server's.
  const data=await lookup('https://ipapi.co/json/',signal,fetcher)
  if(!validTimeZone(data.timezone))throw new Error('No time zone was found for your IP address. Search for your city or choose a time zone manually.')
  return {timeZone:data.timezone,label:[data.city,data.region,data.country_name].filter(Boolean).join(', ')||'Your network location'}
}
