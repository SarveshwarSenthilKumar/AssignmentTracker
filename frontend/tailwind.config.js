const neutral = {50:'#f6f7f9',100:'#e9edf1',200:'#d4dbe3',300:'#b1bdc9',400:'#8997a7',500:'#69798a',600:'#4e5c6d',700:'#354253',800:'#242c37',900:'#171e27',950:'#0f141b'}
const accent = {50:'#f3f5f7',100:'#e5ebf0',200:'#cdd8e2',300:'#b3c2d0',400:'#8fa5b9',500:'#6d879e',600:'#526c83',700:'#40566c',800:'#304355',900:'#243342',950:'#17232f'}
const green = {300:'#b4c7bc',400:'#96b3a3',500:'#779789',600:'#5a7669',700:'#40594d',800:'#2a4035',900:'#1b2c23',950:'#132018'}
const amber = {300:'#d0c3ab',400:'#bdab8b',500:'#a18b68',600:'#827054',700:'#665840',800:'#4d4232',900:'#332b21',950:'#211c16'}
const red = {200:'#dfcccc',300:'#cfb1b1',400:'#bf9696',500:'#a57878',600:'#875e5e',700:'#704a4a',800:'#533737',900:'#382626',950:'#241a1a'}
export default {content:['./index.html','./src/**/*.{js,ts,jsx,tsx}'],theme:{extend:{colors:{slate:neutral,primary:accent,blue:accent,indigo:accent,purple:accent,pink:accent,cyan:accent,green,emerald:green,yellow:amber,amber,orange:amber,red,rose:red}}},plugins:[]}
