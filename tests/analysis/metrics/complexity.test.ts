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

  it('calculates metrics for empty file map', () => {
    const asts = new Map<string, BabelFile>();
    const result = calculateComplexityMetrics(asts);

    expect(result.modules.size).toBe(0);
    expect(result.maxComplexity).toBe(0);
    expect(result.averageComplexity).toBe(0);
  });

  it('counts FunctionExpression statements', () => {
    const funcExpr = {
      type: 'FunctionExpression',
      params: [],
      body: { type: 'BlockStatement', body: [] },
      loc: { start: { line: 1 }, end: { line: 2 } },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [funcExpr],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions).toHaveLength(1);
    expect(result.modules.get('test.ts')!.functions[0].name).toBe('<anonymous>');
  });

  it('counts ArrowFunctionExpression statements', () => {
    const arrowFunc = {
      type: 'ArrowFunctionExpression',
      params: [],
      body: { type: 'BlockStatement', body: [] },
      loc: { start: { line: 1 }, end: { line: 2 } },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [arrowFunc],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions).toHaveLength(1);
    expect(result.modules.get('test.ts')!.functions[0].name).toBe('<arrow>');
  });

  it('counts ClassMethod statements', () => {
    const classMethod = {
      type: 'ClassMethod',
      kind: 'method',
      key: { name: 'myMethod' },
      params: [],
      body: { type: 'BlockStatement', body: [] },
      loc: { start: { line: 1 }, end: { line: 2 } },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [classMethod],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions).toHaveLength(1);
    expect(result.modules.get('test.ts')!.functions[0].name).toBe('myMethod');
  });

  it('handles while statements', () => {
    const whileStmt = {
      type: 'WhileStatement',
      test: { type: 'Identifier', name: 'x' },
      body: { type: 'BlockStatement', body: [] },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [whileStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBe(2); // 1 + 1 while
  });

  it('handles do-while statements', () => {
    const doWhileStmt = {
      type: 'DoWhileStatement',
      test: { type: 'Identifier', name: 'x' },
      body: { type: 'BlockStatement', body: [] },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [doWhileStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBe(2); // 1 + 1 do-while
  });

  it('handles for-in statements', () => {
    const forInStmt = {
      type: 'ForInStatement',
      left: { type: 'Identifier', name: 'key' },
      right: { type: 'Identifier', name: 'obj' },
      body: { type: 'BlockStatement', body: [] },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [forInStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBe(2); // 1 + 1 for-in
  });

  it('handles for-of statements', () => {
    const forOfStmt = {
      type: 'ForOfStatement',
      left: { type: 'Identifier', name: 'item' },
      right: { type: 'Identifier', name: 'arr' },
      body: { type: 'BlockStatement', body: [] },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [forOfStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBe(2); // 1 + 1 for-of
  });

  it('handles catch clause statements', () => {
    const tryStmt = {
      type: 'TryStatement',
      block: { type: 'BlockStatement', body: [] },
      handler: {
        type: 'CatchClause',
        param: { type: 'Identifier', name: 'e' },
        body: { type: 'BlockStatement', body: [] },
      },
      finalizer: null,
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [tryStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBe(2); // 1 + 1 catch
  });

  it('handles missing location information gracefully', () => {
    const funcWithoutLoc = {
      type: 'FunctionDeclaration',
      id: { name: 'test' },
      params: [],
      body: { type: 'BlockStatement', body: [] },
      loc: null,
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [funcWithoutLoc],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].startLine).toBe(0);
    expect(result.modules.get('test.ts')!.functions[0].endLine).toBe(0);
  });

  it('counts logical OR expressions', () => {
    const logicalOr = createMockLogicalExpression(
      { type: 'Identifier', name: 'a' },
      '||',
      { type: 'Identifier', name: 'b' }
    );

    const ifStmt = createMockIfStatement(logicalOr, { type: 'BlockStatement', body: [] });

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [ifStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBeGreaterThan(1);
  });

  it('counts multiple logical expressions', () => {
    const logicalAnd = createMockLogicalExpression(
      { type: 'Identifier', name: 'a' },
      '&&',
      createMockLogicalExpression(
        { type: 'Identifier', name: 'b' },
        '&&',
        { type: 'Identifier', name: 'c' }
      )
    );

    const ifStmt = createMockIfStatement(logicalAnd, { type: 'BlockStatement', body: [] });

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [ifStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBeGreaterThan(2);
  });

  it('handles alternative branch in if statement', () => {
    const ifWithAlternate = createMockIfStatement(
      { type: 'Identifier', name: 'x' },
      { type: 'BlockStatement', body: [] },
      createMockIfStatement(
        { type: 'Identifier', name: 'y' },
        { type: 'BlockStatement', body: [] }
      )
    );

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [ifWithAlternate])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBeGreaterThan(2);
  });

  it('handles ClassMethod with StringLiteral key', () => {
    const classMethod = {
      type: 'ClassMethod',
      kind: 'method',
      key: { type: 'StringLiteral', value: 'myStringMethod' },
      params: [],
      body: { type: 'BlockStatement', body: [] },
      loc: { start: { line: 1 }, end: { line: 2 } },
    };

    const ast: BabelFile = {
      type: 'File',
      program: { type: 'Program', body: [classMethod] },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].name).toBe('myStringMethod');
  });

  it('handles ClassMethod with non-standard key that has name property', () => {
    const classMethod = {
      type: 'ClassMethod',
      kind: 'method',
      key: { type: 'PrivateName', name: 'privateMethod' },
      params: [],
      body: { type: 'BlockStatement', body: [] },
      loc: { start: { line: 1 }, end: { line: 2 } },
    };

    const ast: BabelFile = {
      type: 'File',
      program: { type: 'Program', body: [classMethod] },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].name).toBe('privateMethod');
  });

  it('handles ClassMethod with computed key that has no name', () => {
    const classMethod = {
      type: 'ClassMethod',
      kind: 'method',
      key: { type: 'MemberExpression', object: { type: 'Identifier', name: 'obj' }, property: { type: 'Identifier', name: 'prop' } },
      params: [],
      body: { type: 'BlockStatement', body: [] },
      loc: { start: { line: 1 }, end: { line: 2 } },
    };

    const ast: BabelFile = {
      type: 'File',
      program: { type: 'Program', body: [classMethod] },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].name).toBe('<method>');
  });

  it('counts logical expression in do-while test condition', () => {
    const logicalExpr = createMockLogicalExpression(
      { type: 'Identifier', name: 'a' },
      '&&',
      { type: 'Identifier', name: 'b' }
    );
    const doWhile = {
      type: 'DoWhileStatement',
      test: logicalExpr,
      body: { type: 'BlockStatement', body: [] },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [doWhile])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    // 1 base + 1 do-while + 1 logical in condition
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBe(3);
  });

  it('counts logical expression in ternary test condition', () => {
    const logicalExpr = createMockLogicalExpression(
      { type: 'Identifier', name: 'a' },
      '&&',
      { type: 'Identifier', name: 'b' }
    );
    const ternary = {
      type: 'ConditionalExpression',
      test: logicalExpr,
      consequent: { type: 'Identifier', name: 'x' },
      alternate: { type: 'Identifier', name: 'y' },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [ternary])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    // 1 base + 1 ternary + 1 logical in condition
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBe(3);
  });

  it('counts logical expression in for-statement test condition', () => {
    const logicalExpr = createMockLogicalExpression(
      { type: 'Identifier', name: 'i' },
      '&&',
      { type: 'Identifier', name: 'j' }
    );
    const forStmt = {
      type: 'ForStatement',
      init: null,
      test: logicalExpr,
      update: null,
      body: { type: 'BlockStatement', body: [] },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [forStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    // 1 base + 1 for + 1 logical in condition
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBe(3);
  });

  it('counts logical expression in switch discriminant', () => {
    const logicalExpr = createMockLogicalExpression(
      { type: 'Identifier', name: 'a' },
      '||',
      { type: 'Identifier', name: 'b' }
    );
    const switchStmt = {
      type: 'SwitchStatement',
      discriminant: logicalExpr,
      cases: [],
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [switchStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    // 1 base + 1 logical in switch discriminant
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBe(2);
  });

  it('handles FunctionExpression with missing location information', () => {
    const funcExpr = {
      type: 'FunctionExpression',
      params: [],
      body: { type: 'BlockStatement', body: [] },
      loc: null,
    };

    const ast: BabelFile = {
      type: 'File',
      program: { type: 'Program', body: [funcExpr] },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].startLine).toBe(0);
    expect(result.modules.get('test.ts')!.functions[0].endLine).toBe(0);
  });

  it('handles ArrowFunctionExpression with missing location information', () => {
    const arrowFunc = {
      type: 'ArrowFunctionExpression',
      params: [],
      body: { type: 'BlockStatement', body: [] },
      loc: null,
    };

    const ast: BabelFile = {
      type: 'File',
      program: { type: 'Program', body: [arrowFunc] },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].startLine).toBe(0);
    expect(result.modules.get('test.ts')!.functions[0].endLine).toBe(0);
  });

  it('handles ClassMethod with missing location information', () => {
    const classMethod = {
      type: 'ClassMethod',
      kind: 'method',
      key: { type: 'Identifier', name: 'myMethod' },
      params: [],
      body: { type: 'BlockStatement', body: [] },
      loc: null,
    };

    const ast: BabelFile = {
      type: 'File',
      program: { type: 'Program', body: [classMethod] },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    expect(result.modules.get('test.ts')!.functions[0].startLine).toBe(0);
    expect(result.modules.get('test.ts')!.functions[0].endLine).toBe(0);
  });

  it('counts logical expression in while-statement test condition', () => {
    const logicalExpr = createMockLogicalExpression(
      { type: 'Identifier', name: 'a' },
      '&&',
      { type: 'Identifier', name: 'b' }
    );
    const whileStmt = {
      type: 'WhileStatement',
      test: logicalExpr,
      body: { type: 'BlockStatement', body: [] },
    };

    const ast: BabelFile = {
      type: 'File',
      program: {
        type: 'Program',
        body: [createMockFunctionDeclaration('test', [whileStmt])],
      },
    } as any;

    const result = calculateComplexity(ast, 'test.ts');
    // 1 base + 1 while + 1 logical in condition
    expect(result.modules.get('test.ts')!.functions[0].complexity).toBe(3);
  });
});
