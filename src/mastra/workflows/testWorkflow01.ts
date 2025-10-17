import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const uppercaseBranchStep = createStep({
  id: 'uppercase-branch',
  inputSchema: z.object({
    text: z.string().min(1, 'text is required'),
  }),
  outputSchema: z.object({
    original: z.string(),
    uppercase: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();
    logger.info('[workflow:test-workflow-01][step:uppercase-branch] start', { inputText: inputData.text });

    const uppercase = inputData.text.toUpperCase();

    logger.info('[workflow:test-workflow-01][step:uppercase-branch] completed');
    return {
      original: inputData.text,
      uppercase,
    };
  },
});

const reverseBranchStep = createStep({
  id: 'reverse-branch',
  inputSchema: z.object({
    text: z.string().min(1, 'text is required'),
  }),
  outputSchema: z.object({
    original: z.string(),
    reversed: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();
    logger.info('[workflow:test-workflow-01][step:reverse-branch] start', { inputText: inputData.text });

    const reversed = inputData.text.split('').reverse().join('');

    logger.info('[workflow:test-workflow-01][step:reverse-branch] completed');
    return {
      original: inputData.text,
      reversed,
    };
  },
});

const mergeParallelStep = createStep({
  id: 'merge-parallel-results',
  inputSchema: z.object({
    'uppercase-branch': z.object({
      original: z.string(),
      uppercase: z.string(),
    }),
    'reverse-branch': z.object({
      original: z.string(),
      reversed: z.string(),
    }),
  }),
  outputSchema: z.object({
    original: z.string(),
    uppercase: z.string(),
    reversed: z.string(),
    combinedMessage: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();
    logger.info('[workflow:test-workflow-01][step:merge-parallel-results] start');

    const uppercasePart = inputData['uppercase-branch'];
    const reversePart = inputData['reverse-branch'];
    const original = uppercasePart.original;
    const combinedMessage = `Original: ${original} | Uppercase: ${uppercasePart.uppercase} | Reversed: ${reversePart.reversed}`;

    logger.info('[workflow:test-workflow-01][step:merge-parallel-results] completed');
    return {
      original,
      uppercase: uppercasePart.uppercase,
      reversed: reversePart.reversed,
      combinedMessage,
    };
  },
});

export const testWorkflow01 = createWorkflow({
  id: 'test-workflow-01',
  inputSchema: z.object({
    text: z.string().min(1, 'text is required'),
  }),
  outputSchema: z.object({
    original: z.string(),
    uppercase: z.string(),
    reversed: z.string(),
    combinedMessage: z.string(),
  }),
  steps: [uppercaseBranchStep, reverseBranchStep, mergeParallelStep],
});

testWorkflow01.parallel([uppercaseBranchStep, reverseBranchStep]).then(mergeParallelStep).commit();

