import { describe, expect, it } from 'vitest';

import { filterRelevantActiveTools } from '../../src/services/requestContext';

const activeTools = {
  spreadsheet: { active: true, file: { name: 'Budget.xlsx' } },
  workspace: { active: true, currentUrl: 'https://example.com' },
};

describe('filterRelevantActiveTools', () => {
  it('removes unrelated open tools from a build request', () => {
    expect(
      filterRelevantActiveTools('create a battle ship sim on a free port', activeTools)
    ).toEqual({});
  });

  it('keeps spreadsheet context for spreadsheet work', () => {
    expect(filterRelevantActiveTools('put a SUM formula in this spreadsheet', activeTools)).toEqual(
      {
        spreadsheet: activeTools.spreadsheet,
      }
    );
  });

  it('keeps browser context for page interaction', () => {
    expect(filterRelevantActiveTools('click the submit button on this page', activeTools)).toEqual({
      workspace: activeTools.workspace,
    });
  });
});
