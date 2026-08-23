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
  const regex = /[A-Za-z]+[0-9]+:[A-Za-z]+[0-9]+|[A-Za-z]+[0-9]+|[A-Za-z]+|[0-9]+(\.[0-9]+)?|[()+\-*/,]/g;
  return formula.match(regex) ?? [];
}

class Parser {
  private pos = 0;

  constructor(private tokens: string[], private getValue: GetValue) {}

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private next(): string {
    return this.tokens[this.pos++];
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
        args.push(this.parseExpression());
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
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }
}

/**
 * '=SUM(A1:A3)+B2*2' 형태의 아주 기본적인 수식만 지원합니다.
 * 지원 함수: SUM, AVERAGE, MAX, MIN / 연산자: + - * / ()
 */
export function evaluateFormula(formula: string, getValue: GetValue): number {
  const expr = formula.startsWith('=') ? formula.slice(1) : formula;
  const tokens = tokenize(expr);
  if (tokens.length === 0) return 0;
  const parser = new Parser(tokens, getValue);
  return parser.parseExpression();
}
