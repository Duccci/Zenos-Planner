import { consolidateGateProposals, generateConsolidationMarkdown } from './dist/utils/gate-consolidation.js';

async function main() {
  try {
    const consolidation = await consolidateGateProposals('gate-02', 'zeno/proposals');
    const markdown = generateConsolidationMarkdown(consolidation);
    console.log(markdown);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();