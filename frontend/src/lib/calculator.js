// Parse arithmetic without executing user input as JavaScript.
export function calculate(expression,answer=0){
  const source=expression.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/π/g,'pi')
  if(source.length>500)throw new Error('Keep expressions under 500 characters.')
  const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-z]+|[^\s]/g)||[]
  let index=0
  const peek=()=>tokens[index],take=()=>tokens[index++]
  const finite=value=>{if(!Number.isFinite(value))throw new Error('Result is undefined or too large.');return value}
  const primary=()=>{
    const token=take();let value
    if(token==='('){value=sum();if(take()!==')')throw new Error('Close the parentheses.')}
    else if(token==='pi')value=Math.PI
    else if(token==='ans')value=answer
    else if(['sqrt','abs'].includes(token)){
      if(take()!=='(')throw new Error(`Use ${token}(number).`)
      const argument=sum();if(take()!==')')throw new Error('Close the parentheses.')
      value=token==='sqrt'?Math.sqrt(argument):Math.abs(argument)
    }else if(token&&/^(?:\d|\.)/.test(token))value=Number(token)
    else throw new Error('Enter a number, parentheses, or supported operation.')
    while(peek()==='%'){take();value/=100}
    return finite(value)
  }
  const power=()=>{const left=primary();return peek()==='^'?(take(),finite(left**unary())):left}
  const unary=()=>peek()==='+'?(take(),unary()):peek()==='-'?(take(),-unary()):power()
  const product=()=>{let value=unary();while(['*','/'].includes(peek())){const operator=take(),right=unary();if(operator==='/'&&right===0)throw new Error('Cannot divide by zero.');value=finite(operator==='*'?value*right:value/right)}return value}
  const sum=()=>{let value=product();while(['+','-'].includes(peek())){const operator=take(),right=product();value=finite(operator==='+'?value+right:value-right)}return value}
  if(!tokens.length)throw new Error('Enter an expression first.')
  const result=sum();if(index!==tokens.length)throw new Error('Check the expression. Use × between numbers and parentheses.')
  return Object.is(result,-0)?0:result
}
