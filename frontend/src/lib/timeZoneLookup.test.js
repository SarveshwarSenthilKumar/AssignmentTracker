import test from 'node:test'
import assert from 'node:assert/strict'
import {searchCityTimeZones,detectIPTimeZone} from './timeZoneLookup.js'
const response=data=>({ok:true,json:async()=>data})
test('city lookup encodes search terms and returns distinct valid locations for user selection',async()=>{
  const places=await searchCityTimeZones(' Springfield & town ',{fetcher:async(url,options)=>{
    const query=new URL(url).searchParams
    assert.equal(query.get('name'),'Springfield & town');assert.equal(query.get('count'),'10')
    assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined)
    return response({results:[{id:1,name:'Springfield',admin1:'Illinois',country:'United States',timezone:'America/Chicago'},{id:2,name:'Springfield',admin1:'Massachusetts',country:'United States',timezone:'America/New_York'},{id:1,name:'Duplicate',timezone:'UTC'},{id:3,name:'Bad',timezone:'Unknown/Zone'}]})
  }})
  assert.equal(places.length,2);assert.match(places[0].label,/Illinois/);assert.equal(places[1].timeZone,'America/New_York')
  assert.deepEqual(await searchCityTimeZones('Unknown',{fetcher:async()=>response({})}),[])
  await assert.rejects(searchCityTimeZones('a'),/city name/)
})
test('IP detection requests the browser IP without account credentials and validates the zone',async()=>{
  const signal=new AbortController().signal
  const result=await detectIPTimeZone({signal,fetcher:async(url,options)=>{
    assert.equal(url,'https://ipapi.co/json/');assert.equal(options.signal,signal);assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.headers,undefined)
    return response({city:'Tokyo',country_name:'Japan',timezone:'Asia/Tokyo',ip:'not retained'})
  }})
  assert.deepEqual(result,{timeZone:'Asia/Tokyo',label:'Tokyo, Japan'})
  await assert.rejects(detectIPTimeZone({fetcher:async()=>response({timezone:'Invalid'})}),/No time zone/)
  await assert.rejects(detectIPTimeZone({fetcher:async()=>({ok:false,status:429})}),/busy/)
  await assert.rejects(detectIPTimeZone({fetcher:async()=>response({error:true})}),/could not determine/)
})
