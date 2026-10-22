// Compile a bounded mathematical expression without executing JavaScript.
export function graphExpression(text) {
  let source=String(text).trim().toLowerCase().replace(/[−–]/g,'-').replace(/[×·⋅]/g,'*').replace(/÷/g,'/').replace(/π/g,'pi')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,run=>'^'+[...run].map(c=>'⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join(''))
    .replace(/√\s*\(/g,'sqrt(').replace(/√\s*(\d+(?:\.\d+)?)/g,'sqrt($1)')
    .replace(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=/,'').trim()
  if(!source||source.length>500)throw new Error('Select one function of x, up to 500 characters.')
  return source
}

export function compileGraph(text) {
  const expression=graphExpression(text),tokens=expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-z]+|[^\s]/g)||[]
  const functions={sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,sqrt:Math.sqrt,abs:Math.abs,ln:Math.log,log:Math.log10,exp:Math.exp,floor:Math.floor,ceil:Math.ceil}
  let index=0
  const peek=()=>tokens[index],take=()=>tokens[index++]
  const primary=()=>{
    const token=take()
    if(token==='('){const node=sum();if(take()!==')')throw new Error('Close the parentheses.');return node}
    if(token==='x')return x=>x
    if(token==='pi')return()=>Math.PI
    if(token==='e')return()=>Math.E
    if(Object.hasOwn(functions,token)){
      if(take()!=='(')throw new Error(`Use ${token}(x) with parentheses.`)
      const argument=sum();if(take()!==')')throw new Error('Close the parentheses.')
      return x=>functions[token](argument(x))
    }
    if(token&&/^(?:\d|\.)/.test(token)){const value=Number(token);if(Number.isFinite(value))return()=>value}
    throw new Error('Use y = a function of x, such as y = x^2 or sin(x). Other variables and implicit equations are not supported.')
  }
  const power=()=>{const left=primary();if(peek()!=='^')return left;take();const right=unary();return x=>left(x)**right(x)}
  const unary=()=>{if(peek()==='+'){take();return unary()}if(peek()==='-'){take();const node=unary();return x=>-node(x)}return power()}
  const product=()=>{
    let left=unary()
    while(peek()==='*'||peek()==='/'||peek()==='('||peek()==='x'||peek()==='pi'||peek()==='e'||Object.hasOwn(functions,peek())){
      const op=peek()==='*'||peek()==='/'?take():'*',right=unary(),previous=left
      left=op==='*'?x=>previous(x)*right(x):x=>previous(x)/right(x)
    }
    return left
  }
  const sum=()=>{let left=product();while(peek()==='+'||peek()==='-'){const op=take(),right=product(),previous=left;left=op==='+'?x=>previous(x)+right(x):x=>previous(x)-right(x)}return left}
  const evaluate=sum();if(index!==tokens.length)throw new Error('Check the expression. Use one function of x with supported operators.')
  return {expression,evaluate}
}

export function drawGraph(canvas,compiled,bounds) {
  const [xmin,xmax,ymin,ymax]=bounds
  if(!bounds.every(Number.isFinite)||xmax<=xmin||ymax<=ymin||bounds.some(n=>Math.abs(n)>1e9)||xmax-xmin<1e-9||ymax-ymin<1e-9)throw new Error('Enter increasing axis limits between −1 billion and 1 billion.')
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pad=48,pw=w-pad*2,ph=h-pad*2
  const px=x=>pad+(x-xmin)/(xmax-xmin)*pw,py=y=>h-pad-(y-ymin)/(ymax-ymin)*ph
  ctx.fillStyle='#101827';ctx.fillRect(0,0,w,h);ctx.font='14px sans-serif';ctx.fillStyle='#e2e8f0';ctx.fillText(`y = ${compiled.expression}`.slice(0,90),pad,24)
  const step=range=>{const raw=range/7,p=10**Math.floor(Math.log10(raw)),n=raw/p;return(n<2?1:n<5?2:5)*p}
  const grid=(min,max,vertical)=>{
    const spacing=step(max-min)
    for(let i=0,value=Math.ceil(min/spacing)*spacing;i<30&&value<=max;i++,value+=spacing){
      const pos=vertical?px(value):py(value);ctx.strokeStyle='#263347';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(vertical?pos:pad,vertical?pad:pos);ctx.lineTo(vertical?pos:w-pad,vertical?h-pad:pos);ctx.stroke()
      ctx.fillStyle='#a6b4c8';const label=Number(value.toPrecision(5)).toString();ctx.fillText(label,vertical?pos-9:3,vertical?h-pad+22:pos+4)
    }
  }
  grid(xmin,xmax,true);grid(ymin,ymax,false)
  ctx.save();ctx.beginPath();ctx.rect(pad,pad,pw,ph);ctx.clip()
  ctx.strokeStyle='#8292aa';ctx.beginPath();ctx.moveTo(px(0),pad);ctx.lineTo(px(0),h-pad);ctx.moveTo(pad,py(0));ctx.lineTo(w-pad,py(0));ctx.stroke()
  ctx.strokeStyle='#63d5fa';ctx.lineWidth=2.5;ctx.beginPath();let previous=null,visible=0
  for(let i=0;i<=1600;i++){
    const x=xmin+i/1600*(xmax-xmin),y=compiled.evaluate(x),point={x:px(x),y:py(y)}
    if(!Number.isFinite(y)||point.y<pad-ph||point.y>h-pad+ph){previous=null;continue}
    if(previous&&Math.abs(point.y-previous.y)<ph*.45)ctx.lineTo(point.x,point.y);else ctx.moveTo(point.x,point.y)
    if(y>=ymin&&y<=ymax)visible++
    previous=point
  }
  ctx.stroke();ctx.restore();ctx.fillStyle='#a6b4c8';ctx.fillText('x',w-pad+15,h-pad+4);ctx.fillText('y',pad-16,pad-12)
  return visible
}
