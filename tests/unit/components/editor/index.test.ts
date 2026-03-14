/**
 * Editor Module 单元测试入口
 * 运行所有编辑器模块测试
 */
import { describe, it, expect } from 'bun:test';

// Import all test suites to ensure they're registered
import './types.test';
import './utils/tableHelpers.test';
import './utils/editorActions.test';
// Skip hooks tests in Bun environment (requires DOM)
// import './hooks/index.test';
import './commands/formatting.test';
import './commands/paragraph.test';
import './commands/table.test';

describe('Editor Module Test Suite', () => {
  it('should load all test modules', () => {
    expect(true).toBe(true);
  });
});
