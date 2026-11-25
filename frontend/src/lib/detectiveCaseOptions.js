export const CASE_BOARD_PRESETS={
  simple:{groups:4,density:'sparse',photos:true,timeline:false,scraps:false},
  standard:{groups:8,density:'standard',photos:true,timeline:true,scraps:true},
  complex:{groups:8,density:'dense',photos:true,timeline:true,scraps:true}
}

export function caseBoardOptions(options){
  const value={...CASE_BOARD_PRESETS.standard,...options}
  return {
    groups:Number.isInteger(value.groups)?Math.min(8,Math.max(4,value.groups)):8,
    density:['sparse','standard','dense'].includes(value.density)?value.density:'standard',
    photos:value.photos!==false,
    timeline:value.timeline!==false,
    scraps:value.scraps!==false
  }
}
