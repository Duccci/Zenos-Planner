/**
 * Tests for cyclomatic complexity calculator
 */

import { describe, it, expect } from 'vitest';
import { calculateComplexity, calculateComplexityMetrics } from '../../../src/analysis/metrics/complexity.js';
import type { File as BabelFile } from '@babel/types';

// Helper to create mock AST nodes
function createMockFunctionDeclaration(
  name: string,
  body: any[] = [],
  params: any[] = []
): any {
  return {
    type: 'FunctionDeclaration',
    id: { name },
    params,
    body: { type: 'BlockStatement', body },
    loc: { start: { line: 1 }, end: { line: 10 } },
  };
}

function createMockIfStatement(test: any, consequent: any, alternate?: any): any {
  return {
    type: 'IfStatement',
    test,
    consequent,
    alternate,
  };
}

function createMockForStatement(init: any, test: any, update: any, body: any): any {
  return {
    type: 'ForStatement',
    init,
    test,
    update,
    body,
  };
}

function createMockSwitchStatement(discriminant: any, cases: any[]): any {
  return {
    type: 'SwitchStatement',
    discriminant,
    cases,
  };
}

function createMockSwitchCase(test: any, consequent: any[]): any {
  return {
    type: 'SwitchCase',
    test,
    consequent,
  };
}

function createMockLogicalExpression(left: any, operator: string, right: any): any {
  return {
    type: 'LogicalExpression',
    left,
    operator,
    right,
  };
}

describe('calculateComplexity', () => {
  it('calculates base complexity for empty function', () => {
    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test')],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    const moduleComplexity = result.modules.get('test.ts')!;

    expect(moduleComplexity.functions).toHaveLength(1);
    expect(moduleComplexity.functions[0].name).toBe('test');
    expect(moduleComplexity.functions[0].complexity).toBe(1);
    expect(result.maxComplexity).toBe(1);
    expect(result.averageComplexity).toBe(1);
  });

  it('counts if statements', () => {
    const ifStmt = createMockIfStatement(
      { type: 'Identifier', name: 'x' },
      { type: 'BlockStatement', body: [] }
    );

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [ifStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    const moduleComplexity = result.modules.get('test.ts')!;

    expect(moduleComplexity.functions[0].complexity).toBe(2); // 1 + 1 if
  });

  it('counts nested if statements', () => {
    const innerIf = createMockIfStatement(
      { type: 'Identifier', name: 'y' },
      { type: 'BlockStatement', body: [] }
    );

    const outerIf = createMockIfStatement(
      { type: 'Identifier', name: 'x' },
      { type: 'BlockStatement', body: [innerIf] }
    );

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [outerIf])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    const moduleComplexity = result.modules.get('test.ts')!;

    expect(moduleComplexity.functions[0].complexity).toBe(3); // 1 + 1 outer if + 1 inner if
  });

  it('counts switch cases', () => {
    const switchStmt = createMockSwitchStatement(
      { type: 'Identifier', name: 'x' },
      [
        createMockSwitchCase({ type: 'Literal', value: 1 }, []),
        createMockSwitchCase({ type: 'Literal', value: 2 }, []),
        createMockSwitchCase(null, []), // default case
      ]
    );

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [switchStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    const moduleComplexity = result.modules.get('test.ts')!;

    expect(moduleComplexity.functions[0].complexity).toBe(3); // 1 + 2 cases (default not counted)
  });

  it('counts loops', () => {
    const forStmt = createMockForStatement(
      null,
      { type: 'Identifier', name: 'x' },
      null,
      { type: 'BlockStatement', body: [] }
    );

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [forStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    const moduleComplexity = result.modules.get('test.ts')!;

    expect(moduleComplexity.functions[0].complexity).toBe(2); // 1 + 1 for
  });

  it('counts ternary operators', () => {
    const ternary = {
      type: 'ConditionalExpression',
      test: { type: 'Identifier', name: 'x' },
      consequent: { type: 'Literal', value: 1 },
      alternate: { type: 'Literal', value: 2 },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [ternary])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    const moduleComplexity = result.modules.get('test.ts')!;

    expect(moduleComplexity.functions[0].complexity).toBe(2); // 1 + 1 ternary
  });

  it('counts logical operators in conditions', () => {
    const logicalExpr = createMockLogicalExpression(
      { type: 'Identifier', name: 'x' },
      '&&',
      { type: 'Identifier', name: 'y' }
    );

    const ifStmt = createMockIfStatement(
      logicalExpr,
      { type: 'BlockStatement', body: [] }
    );

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [ifStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    const moduleComplexity = result.modules.get('test.ts')!;

    expect(moduleComplexity.functions[0].complexity).toBe(3); // 1 + 1 if + 1 logical
  });

  it('handles multiple functions', () => {
    const func1 = createMockFunctionDeclaration('func1', [
      createMockIfStatement({ type: 'Identifier', name: 'x' }, { type: 'BlockStatement', body: [] })
    ]);

    const func2 = createMockFunctionDeclaration('func2', [
      createMockForStatement(null, { type: 'Identifier', name: 'i' }, null, { type: 'BlockStatement', body: [] }),
      createMockForStatement(null, { type: 'Identifier', name: 'j' }, null, { type: 'BlockStatement', body: [] })
    ]);

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [func1, func2],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    const moduleComplexity = result.modules.get('test.ts')!;

    expect(moduleComplexity.functions).toHaveLength(2);
    expect(moduleComplexity.functions[0].complexity).toBe(2); // func1: 1 + 1 if
    expect(moduleComplexity.functions[1].complexity).toBe(3); // func2: 1 + 1 for + 1 for
    expect(result.maxComplexity).toBe(3);
    expect(result.averageComplexity).toBe(2.5);
  });
});

describe('calculateComplexityMetrics', () => {
  it('calculates metrics for multiple files', () => {
    const ast1: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('simple')],
      },
    } as any;

    const ast2: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('complex', [
          createMockIfStatement({ type: 'Identifier', name: 'x' }, { type: 'BlockStatement', body: [] }),
          createMockForStatement(null, { type: 'Identifier', name: 'i' }, null, { type: 'BlockStatement', body: [] })
        ])],
      },
    } as any;

    const asts = new Map([
      ['file1.ts', ast1],
      ['file2.ts', ast2],
    ]);

    const result = calculateComplexityMetrics(asts);

    expect(result.modules.size).toBe(2);
    expect(result.modules.get('file1.ts')!.maxComplexity).toBe(1);
    expect(result.modules.get('file2.ts')!.maxComplexity).toBe(3);
    expect(result.maxComplexity).toBe(3);
    expect(result.averageComplexity).toBe(2); // (1 + 3) / 2
  });
});