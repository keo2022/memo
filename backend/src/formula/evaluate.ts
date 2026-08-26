type GetValue = (row: number, col: number) => number;

const CELL_REF = /^[A-Za-z]+[0-9]+$/;
const RANGE_REF = /^[A-Za-z]+[0-9]+:[A-Za-z]+[0-9]+$/;

function colLettersToIndex(letters: string): number {
  let idx = 0;
  for (const ch of letters.toUpperCase()) {
    idx = idx * 26 + (ch.charCodeAt(0) - 64);
  }
  return idx - 1; // 0-based
}

function parseCellRef(ref: string): { row: number; col: number } {
  const match = ref.match(/^([A-Za-z]+)([0-9]+)$/);
  if (!match) throw new Error(`Invalid cell reference: ${ref}`);
  return { row: parseInt(match[2], 10) - 1, col: colLettersToIndex(match[1]) };
}

function tokenize(formula: string): string[] {
  const regex = /[A-Za-z]+[0-9]+:[A-Za-z]+[0-9]+|[A-Za-z]+[0-9]+|[A-Za-z]+|[0-9]+(\.[0-9]+)?|>=|<=|<>|[()+\-*/,<>=]/g;
  return formula.match(regex) ?? [];
}

const COMPARISON_OPS = ['>=', '<=', '<>', '>', '<', '='];

class Parser {
  private pos = 0;

  constructor(private tokens: string[], private getValue: GetValue) {}

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private next(): string {
    return this.tokens[this.pos++];
  }

  // IF의 조건처럼 "A1>10" 같은 비교식이 필요한 자리에서 씁니다. 비교 연산자가 없으면 그냥 일반 수식값을 반환합니다.
  parseComparison(): number {
    const value = this.parseExpression();
    const op = this.peek();
    if (op !== undefined && COMPARISON_OPS.includes(op)) {
      this.next();
      const rhs = this.parseExpression();
      switch (op) {
        case '>':
          return value > rhs ? 1 : 0;
        case '<':
          return value < rhs ? 1 : 0;
        case '>=':
          return value >= rhs ? 1 : 0;
        case '<=':
          return value <= rhs ? 1 : 0;
        case '<>':
          return value !== rhs ? 1 : 0;
        case '=':
          return value === rhs ? 1 : 0;
      }
    }
    return value;
  }

  parseExpression(): number {
    let value = this.parseTerm();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.next();
      const rhs = this.parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (this.peek() === '*' || this.peek() === '/') {
      const op = this.next();
      const rhs = this.parseFactor();
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  }

  private parseFactor(): number {
    const token = this.peek();
    if (token === undefined) throw new Error('Unexpected end of formula');

    if (token === '(') {
      this.next();
      const value = this.parseExpression();
      if (this.peek() === ')') this.next();
      return value;
    }
    if (token === '-') {
      this.next();
      return -this.parseFactor();
    }
    if (/^[A-Za-z]+$/.test(token) && this.tokens[this.pos + 1] === '(') {
      return this.parseFunction();
    }
    if (CELL_REF.test(token)) {
      this.next();
      const { row, col } = parseCellRef(token);
      return this.getValue(row, col);
    }
    if (!isNaN(Number(token))) {
      this.next();
      return Number(token);
    }
    throw new Error(`Unexpected token: ${token}`);
  }

  private parseFunction(): number {
    const name = this.next().toUpperCase();
    this.next(); // '('
    const args: number[] = [];
    while (this.peek() !== ')') {
      const t = this.peek();
      if (t !== undefined && RANGE_REF.test(t)) {
        this.next();
        const [startRef, endRef] = t.split(':');
        const start = parseCellRef(startRef);
        const end = parseCellRef(endRef);
        for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
          for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
            args.push(this.getValue(r, c));
          }
        }
      } else {
        args.push(this.parseComparison());
      }
      if (this.peek() === ',') this.next();
    }
    this.next(); // ')'

    switch (name) {
      case 'SUM':
        return args.reduce((a, b) => a + b, 0);
      case 'AVERAGE':
        return args.length ? args.reduce((a, b) => a + b, 0) / args.length : 0;
      case 'MAX':
        return args.length ? Math.max(...args) : 0;
      case 'MIN':
        return args.length ? Math.min(...args) : 0;
      // 빈 셀과 값이 0인 셀을 구분할 수 없어서, 정확한 COUNT 대신 "0이 아닌 값의 개수"로 근사합니다.
      case 'COUNT':
        return args.filter((v) => v !== 0).length;
      case 'ROUND': {
        const [num, digits] = args;
        const factor = Math.pow(10, digits ?? 0);
        return Math.round((num ?? 0) * factor) / factor;
      }
      case 'IF': {
        const [cond, whenTrue, whenFalse] = args;
        return cond ? whenTrue ?? 0 : whenFalse ?? 0;
      }
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }
}

/**
 * '=SUM(A1:A3)+B2*2' 형태의 아주 기본적인 수식만 지원합니다.
 * 지원 함수: SUM, AVERAGE, MAX, MIN, COUNT, ROUND, IF / 연산자: + - * / ( ) > < >= <= = <>
 * 비교식은 참이면 1, 거짓이면 0을 반환합니다 (예: =IF(A1>10,1,0), =A1>10 도 그대로 최상위 수식으로 가능).
 */
export function evaluateFormula(formula: string, getValue: GetValue): number {
  const expr = formula.startsWith('=') ? formula.slice(1) : formula;
  const tokens = tokenize(expr);
  if (tokens.length === 0) return 0;
  const parser = new Parser(tokens, getValue);
  return parser.parseComparison();
}
