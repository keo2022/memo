const TOKEN_REGEX = /[A-Za-z]+[0-9]+:[A-Za-z]+[0-9]+|[A-Za-z]+[0-9]+|[A-Za-z]+|[0-9]+(\.[0-9]+)?|[()+\-*/,]/g;
const CELL_REF = /^[A-Za-z]+[0-9]+$/;

function colLettersToIndex(letters: string): number {
  let idx = 0;
  for (const ch of letters.toUpperCase()) {
    idx = idx * 26 + (ch.charCodeAt(0) - 64);
  }
  return idx - 1;
}

function colIndexToLetters(index: number): string {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function parseCellRef(ref: string): { row: number; col: number } {
  const match = ref.match(/^([A-Za-z]+)([0-9]+)$/);
  if (!match) throw new Error(`Invalid cell reference: ${ref}`);
  return { row: parseInt(match[2], 10) - 1, col: colLettersToIndex(match[1]) };
}

function cellRefToString(row: number, col: number): string {
  return `${colIndexToLetters(col)}${row + 1}`;
}

/**
 * 탭에 행/열이 중간에 삽입될 때, 수식 안의 셀 참조(A1, A1:A3 등)가 계속 같은 칸을
 * 가리키도록 좌표를 밀어줍니다. (Excel이 행/열 삽입 시 수식을 자동으로 조정하는 것과 동일한 개념)
 */
export function shiftFormulaRefs(formula: string, axis: 'row' | 'col', insertIndex: number): string {
  const expr = formula.startsWith('=') ? formula.slice(1) : formula;
  const tokens = expr.match(TOKEN_REGEX) ?? [];

  const shiftRef = (ref: string): string => {
    const { row, col } = parseCellRef(ref);
    if (axis === 'row' && row >= insertIndex) return cellRefToString(row + 1, col);
    if (axis === 'col' && col >= insertIndex) return cellRefToString(row, col + 1);
    return cellRefToString(row, col);
  };

  const shifted = tokens.map((token) => {
    if (token.includes(':')) {
      const [startRef, endRef] = token.split(':');
      return `${shiftRef(startRef)}:${shiftRef(endRef)}`;
    }
    if (CELL_REF.test(token)) {
      return shiftRef(token);
    }
    return token;
  });

  return `=${shifted.join('')}`;
}
