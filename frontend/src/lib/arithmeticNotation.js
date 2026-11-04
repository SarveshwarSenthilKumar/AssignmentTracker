// A period within a number is decimal; a spaced period between operands is multiplication.
export function normalizeArithmeticNotation(expression){
  return expression.replace(/[xX×·⋅∙•]/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/π/g,'pi')
    .replace(/([\d)%])\s+\.\s+(?=[\d(])/g,'$1*')
}
