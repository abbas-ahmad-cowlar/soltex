// src/js/logParser.js
// SolteX -- LaTeX Log File Parser

/**
 * Parse a LaTeX log string into structured entries.
 * @param {string} logText - Raw log file content
 * @returns {Array<{type: string, message: string, line: number|null, raw: string}>}
 */
export function parseLatexLog(logText) {
  const entries = [];
  if (!logText) return entries;
  const lines = logText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Errors: lines starting with "! "
    if (line.startsWith('! ')) {
      const message = line.substring(2).trim();
      let sourceLine = null;
      let raw = line;

      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        raw += '\n' + lines[j];
        const lineMatch = lines[j].match(/^l\.(\d+)\s/);
        if (lineMatch) {
          sourceLine = parseInt(lineMatch[1], 10);
          break;
        }
      }

      entries.push({ type: 'error', message, line: sourceLine, raw });
      continue;
    }

    // 2. Warnings: "LaTeX Warning:" or "Package <name> Warning:"
    if (line.includes('Warning:')) {
      const warningMatch = line.match(/(LaTeX Warning|Package \w+ Warning):\s*(.*)/);
      if (warningMatch) {
        let message = warningMatch[2].trim();
        let raw = line;

        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== '' && !lines[j].startsWith('!') && !lines[j].includes('Warning:')) {
          message += ' ' + lines[j].trim();
          raw += '\n' + lines[j];
          j++;
        }

        let sourceLine = null;
        const lineInText = message.match(/on input line (\d+)/);
        if (lineInText) sourceLine = parseInt(lineInText[1], 10);

        entries.push({ type: 'warning', message, line: sourceLine, raw });
        continue;
      }
    }

    // 3. Badboxes: "Overfull" or "Underfull"
    if (line.startsWith('Overfull') || line.startsWith('Underfull')) {
      const message = line.trim();
      let sourceLine = null;
      const lineMatch = line.match(/at lines? (\d+)/);
      if (lineMatch) sourceLine = parseInt(lineMatch[1], 10);

      entries.push({ type: 'badbox', message, line: sourceLine, raw: line });
    }
  }

  return entries;
}

/**
 * Count entries by type.
 */
export function countEntries(entries) {
  return {
    errors: entries.filter(e => e.type === 'error').length,
    warnings: entries.filter(e => e.type === 'warning').length,
    badboxes: entries.filter(e => e.type === 'badbox').length,
  };
}
