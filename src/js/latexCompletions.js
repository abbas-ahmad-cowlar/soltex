// src/js/latexCompletions.js
// SolteX — LaTeX Autocomplete Dictionary & Completion Source

import { snippetCompletion } from '@codemirror/autocomplete';

// ── Sectioning Commands ──────────────────────────────────────────────────────
const sectioningCommands = [
  snippetCompletion('\\part{${1:title}}', { label: '\\part{}', type: 'keyword', detail: 'Sectioning', info: 'Top-level document part' }),
  snippetCompletion('\\chapter{${1:title}}', { label: '\\chapter{}', type: 'keyword', detail: 'Sectioning', info: 'Chapter heading (book/report)' }),
  snippetCompletion('\\section{${1:title}}', { label: '\\section{}', type: 'keyword', detail: 'Sectioning', info: 'Section heading' }),
  snippetCompletion('\\subsection{${1:title}}', { label: '\\subsection{}', type: 'keyword', detail: 'Sectioning', info: 'Subsection heading' }),
  snippetCompletion('\\subsubsection{${1:title}}', { label: '\\subsubsection{}', type: 'keyword', detail: 'Sectioning', info: 'Sub-subsection heading' }),
  snippetCompletion('\\paragraph{${1:title}}', { label: '\\paragraph{}', type: 'keyword', detail: 'Sectioning', info: 'Paragraph heading' }),
  snippetCompletion('\\subparagraph{${1:title}}', { label: '\\subparagraph{}', type: 'keyword', detail: 'Sectioning', info: 'Sub-paragraph heading' }),
  snippetCompletion('\\title{${1:title}}', { label: '\\title{}', type: 'keyword', detail: 'Document', info: 'Document title' }),
  snippetCompletion('\\author{${1:name}}', { label: '\\author{}', type: 'keyword', detail: 'Document', info: 'Author name' }),
  snippetCompletion('\\date{${1:\\\\today}}', { label: '\\date{}', type: 'keyword', detail: 'Document', info: 'Document date' }),
];

// ── Document Structure ───────────────────────────────────────────────────────
const structureCommands = [
  snippetCompletion('\\documentclass[${1:options}]{${2:class}}', { label: '\\documentclass[]{}', type: 'keyword', detail: 'Document', info: 'Set document class' }),
  snippetCompletion('\\usepackage[${1:options}]{${2:package}}', { label: '\\usepackage[]{}', type: 'keyword', detail: 'Document', info: 'Import a package' }),
  snippetCompletion('\\usepackage{${1:package}}', { label: '\\usepackage{}', type: 'keyword', detail: 'Document', info: 'Import a package' }),
  snippetCompletion('\\begin{${1:environment}}', { label: '\\begin{}', type: 'keyword', detail: 'Structure', info: 'Begin an environment' }),
  snippetCompletion('\\end{${1:environment}}', { label: '\\end{}', type: 'keyword', detail: 'Structure', info: 'End an environment' }),
  snippetCompletion('\\input{${1:filename}}', { label: '\\input{}', type: 'keyword', detail: 'Structure', info: 'Include a file inline' }),
  snippetCompletion('\\include{${1:filename}}', { label: '\\include{}', type: 'keyword', detail: 'Structure', info: 'Include file on new page' }),
  { label: '\\maketitle', type: 'keyword', detail: 'Document', info: 'Render the title block' },
  { label: '\\tableofcontents', type: 'keyword', detail: 'Document', info: 'Insert table of contents' },
  { label: '\\listoffigures', type: 'keyword', detail: 'Document', info: 'Insert list of figures' },
  { label: '\\listoftables', type: 'keyword', detail: 'Document', info: 'Insert list of tables' },
  { label: '\\appendix', type: 'keyword', detail: 'Document', info: 'Switch to appendix numbering' },
  snippetCompletion('\\bibliography{${1:bibfile}}', { label: '\\bibliography{}', type: 'keyword', detail: 'Document', info: 'Include bibliography file' }),
  snippetCompletion('\\bibliographystyle{${1:style}}', { label: '\\bibliographystyle{}', type: 'keyword', detail: 'Document', info: 'Set bibliography style' }),
  { label: '\\newpage', type: 'keyword', detail: 'Document', info: 'Start a new page' },
  { label: '\\clearpage', type: 'keyword', detail: 'Document', info: 'Clear floats and start new page' },
  { label: '\\pagebreak', type: 'keyword', detail: 'Document', info: 'Force page break' },
];

// ── Text Formatting ──────────────────────────────────────────────────────────
const formattingCommands = [
  snippetCompletion('\\textbf{${1:text}}', { label: '\\textbf{}', type: 'function', detail: 'Formatting', info: 'Bold text' }),
  snippetCompletion('\\textit{${1:text}}', { label: '\\textit{}', type: 'function', detail: 'Formatting', info: 'Italic text' }),
  snippetCompletion('\\underline{${1:text}}', { label: '\\underline{}', type: 'function', detail: 'Formatting', info: 'Underlined text' }),
  snippetCompletion('\\emph{${1:text}}', { label: '\\emph{}', type: 'function', detail: 'Formatting', info: 'Emphasized text' }),
  snippetCompletion('\\texttt{${1:text}}', { label: '\\texttt{}', type: 'function', detail: 'Formatting', info: 'Monospace/typewriter text' }),
  snippetCompletion('\\textrm{${1:text}}', { label: '\\textrm{}', type: 'function', detail: 'Formatting', info: 'Roman (serif) text' }),
  snippetCompletion('\\textsf{${1:text}}', { label: '\\textsf{}', type: 'function', detail: 'Formatting', info: 'Sans-serif text' }),
  snippetCompletion('\\textsc{${1:text}}', { label: '\\textsc{}', type: 'function', detail: 'Formatting', info: 'Small caps text' }),
  { label: '\\tiny', type: 'function', detail: 'Font Size', info: 'Smallest text size' },
  { label: '\\small', type: 'function', detail: 'Font Size', info: 'Small text size' },
  { label: '\\normalsize', type: 'function', detail: 'Font Size', info: 'Normal text size' },
  { label: '\\large', type: 'function', detail: 'Font Size', info: 'Large text size' },
  { label: '\\Large', type: 'function', detail: 'Font Size', info: 'Larger text size' },
  { label: '\\LARGE', type: 'function', detail: 'Font Size', info: 'Very large text size' },
  { label: '\\huge', type: 'function', detail: 'Font Size', info: 'Huge text size' },
  { label: '\\Huge', type: 'function', detail: 'Font Size', info: 'Largest text size' },
  { label: '\\centering', type: 'function', detail: 'Alignment', info: 'Center-align text' },
  { label: '\\raggedright', type: 'function', detail: 'Alignment', info: 'Left-align text' },
  { label: '\\raggedleft', type: 'function', detail: 'Alignment', info: 'Right-align text' },
  { label: '\\noindent', type: 'function', detail: 'Formatting', info: 'Remove paragraph indent' },
];

// ── Math Commands ────────────────────────────────────────────────────────────
const mathCommands = [
  snippetCompletion('\\frac{${1:num}}{${2:den}}', { label: '\\frac{}{}', type: 'function', detail: 'Math', info: 'Fraction' }),
  snippetCompletion('\\sqrt{${1:x}}', { label: '\\sqrt{}', type: 'function', detail: 'Math', info: 'Square root' }),
  snippetCompletion('\\sqrt[${1:n}]{${2:x}}', { label: '\\sqrt[]{}', type: 'function', detail: 'Math', info: 'Nth root' }),
  { label: '\\sum', type: 'function', detail: 'Math', info: 'Summation' },
  { label: '\\prod', type: 'function', detail: 'Math', info: 'Product' },
  { label: '\\int', type: 'function', detail: 'Math', info: 'Integral' },
  { label: '\\oint', type: 'function', detail: 'Math', info: 'Contour integral' },
  { label: '\\lim', type: 'function', detail: 'Math', info: 'Limit' },
  { label: '\\infty', type: 'function', detail: 'Math', info: 'Infinity symbol' },
  { label: '\\partial', type: 'function', detail: 'Math', info: 'Partial derivative' },
  { label: '\\nabla', type: 'function', detail: 'Math', info: 'Nabla/gradient operator' },
  { label: '\\cdot', type: 'function', detail: 'Math', info: 'Center dot' },
  { label: '\\times', type: 'function', detail: 'Math', info: 'Times/cross product' },
  { label: '\\div', type: 'function', detail: 'Math', info: 'Division sign' },
  { label: '\\pm', type: 'function', detail: 'Math', info: 'Plus/minus' },
  { label: '\\mp', type: 'function', detail: 'Math', info: 'Minus/plus' },
  { label: '\\leq', type: 'function', detail: 'Math', info: 'Less than or equal' },
  { label: '\\geq', type: 'function', detail: 'Math', info: 'Greater than or equal' },
  { label: '\\neq', type: 'function', detail: 'Math', info: 'Not equal' },
  { label: '\\approx', type: 'function', detail: 'Math', info: 'Approximately equal' },
  { label: '\\equiv', type: 'function', detail: 'Math', info: 'Equivalent/identical' },
  { label: '\\sim', type: 'function', detail: 'Math', info: 'Similar to' },
  { label: '\\propto', type: 'function', detail: 'Math', info: 'Proportional to' },
  { label: '\\in', type: 'function', detail: 'Math', info: 'Element of' },
  { label: '\\notin', type: 'function', detail: 'Math', info: 'Not element of' },
  { label: '\\subset', type: 'function', detail: 'Math', info: 'Subset' },
  { label: '\\supset', type: 'function', detail: 'Math', info: 'Superset' },
  { label: '\\cup', type: 'function', detail: 'Math', info: 'Union' },
  { label: '\\cap', type: 'function', detail: 'Math', info: 'Intersection' },
  { label: '\\forall', type: 'function', detail: 'Math', info: 'For all' },
  { label: '\\exists', type: 'function', detail: 'Math', info: 'There exists' },
  { label: '\\rightarrow', type: 'function', detail: 'Math', info: 'Right arrow' },
  { label: '\\leftarrow', type: 'function', detail: 'Math', info: 'Left arrow' },
  { label: '\\Rightarrow', type: 'function', detail: 'Math', info: 'Double right arrow (implies)' },
  { label: '\\Leftarrow', type: 'function', detail: 'Math', info: 'Double left arrow' },
  { label: '\\leftrightarrow', type: 'function', detail: 'Math', info: 'Bidirectional arrow' },
  snippetCompletion('\\hat{${1:x}}', { label: '\\hat{}', type: 'function', detail: 'Math', info: 'Hat accent' }),
  snippetCompletion('\\bar{${1:x}}', { label: '\\bar{}', type: 'function', detail: 'Math', info: 'Bar accent' }),
  snippetCompletion('\\vec{${1:x}}', { label: '\\vec{}', type: 'function', detail: 'Math', info: 'Vector arrow' }),
  snippetCompletion('\\dot{${1:x}}', { label: '\\dot{}', type: 'function', detail: 'Math', info: 'Time derivative dot' }),
  snippetCompletion('\\tilde{${1:x}}', { label: '\\tilde{}', type: 'function', detail: 'Math', info: 'Tilde accent' }),
  snippetCompletion('\\overline{${1:x}}', { label: '\\overline{}', type: 'function', detail: 'Math', info: 'Overline' }),
  snippetCompletion('\\underbrace{${1:expr}}_{${2:label}}', { label: '\\underbrace{}', type: 'function', detail: 'Math', info: 'Underbrace with label' }),
  snippetCompletion('\\overbrace{${1:expr}}^{${2:label}}', { label: '\\overbrace{}', type: 'function', detail: 'Math', info: 'Overbrace with label' }),
  { label: '\\ldots', type: 'function', detail: 'Math', info: 'Low dots (ellipsis)' },
  { label: '\\cdots', type: 'function', detail: 'Math', info: 'Center dots' },
  { label: '\\vdots', type: 'function', detail: 'Math', info: 'Vertical dots' },
  { label: '\\ddots', type: 'function', detail: 'Math', info: 'Diagonal dots' },
  { label: '\\quad', type: 'function', detail: 'Spacing', info: 'Quad space' },
  { label: '\\qquad', type: 'function', detail: 'Spacing', info: 'Double quad space' },
  { label: '\\hspace{1cm}', type: 'function', detail: 'Spacing', info: 'Horizontal space' },
  { label: '\\vspace{1cm}', type: 'function', detail: 'Spacing', info: 'Vertical space' },
];

// ── Greek Letters ────────────────────────────────────────────────────────────
const greekLetters = [
  '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\varepsilon',
  '\\zeta', '\\eta', '\\theta', '\\vartheta', '\\iota', '\\kappa',
  '\\lambda', '\\mu', '\\nu', '\\xi', '\\pi', '\\varpi',
  '\\rho', '\\varrho', '\\sigma', '\\varsigma', '\\tau', '\\upsilon',
  '\\phi', '\\varphi', '\\chi', '\\psi', '\\omega',
  '\\Gamma', '\\Delta', '\\Theta', '\\Lambda', '\\Xi', '\\Pi',
  '\\Sigma', '\\Phi', '\\Psi', '\\Omega',
].map(l => ({ label: l, type: 'text', detail: 'Greek', info: `Greek letter ${l.replace('\\', '')}` }));

// ── References & Labels ──────────────────────────────────────────────────────
const referenceCommands = [
  snippetCompletion('\\label{${1:key}}', { label: '\\label{}', type: 'function', detail: 'Reference', info: 'Set a label' }),
  snippetCompletion('\\ref{${1:key}}', { label: '\\ref{}', type: 'function', detail: 'Reference', info: 'Reference a label' }),
  snippetCompletion('\\eqref{${1:key}}', { label: '\\eqref{}', type: 'function', detail: 'Reference', info: 'Reference an equation' }),
  snippetCompletion('\\pageref{${1:key}}', { label: '\\pageref{}', type: 'function', detail: 'Reference', info: 'Reference page number' }),
  snippetCompletion('\\cite{${1:key}}', { label: '\\cite{}', type: 'function', detail: 'Reference', info: 'Cite a reference' }),
  snippetCompletion('\\footnote{${1:text}}', { label: '\\footnote{}', type: 'function', detail: 'Reference', info: 'Add a footnote' }),
];

// ── Figures & Tables ─────────────────────────────────────────────────────────
const figureTableCommands = [
  snippetCompletion('\\includegraphics[width=${1:\\\\textwidth}]{${2:file}}', { label: '\\includegraphics[]{}', type: 'function', detail: 'Figures', info: 'Include an image' }),
  snippetCompletion('\\caption{${1:caption}}', { label: '\\caption{}', type: 'function', detail: 'Figures', info: 'Add a caption' }),
  { label: '\\hline', type: 'function', detail: 'Tables', info: 'Horizontal line in table' },
  snippetCompletion('\\cline{${1:i}-${2:j}}', { label: '\\cline{}', type: 'function', detail: 'Tables', info: 'Partial horizontal line' }),
  snippetCompletion('\\multicolumn{${1:n}}{${2:align}}{${3:text}}', { label: '\\multicolumn{}{}{}', type: 'function', detail: 'Tables', info: 'Span multiple columns' }),
  { label: '\\toprule', type: 'function', detail: 'Tables', info: 'Top rule (booktabs)' },
  { label: '\\midrule', type: 'function', detail: 'Tables', info: 'Middle rule (booktabs)' },
  { label: '\\bottomrule', type: 'function', detail: 'Tables', info: 'Bottom rule (booktabs)' },
];

// ── Environment names (for \\begin{} context) ────────────────────────────────
export const environments = [
  { label: 'document', type: 'type', detail: 'Environment', info: 'Main document body' },
  { label: 'itemize', type: 'type', detail: 'Environment', info: 'Bullet point list' },
  { label: 'enumerate', type: 'type', detail: 'Environment', info: 'Numbered list' },
  { label: 'description', type: 'type', detail: 'Environment', info: 'Description list' },
  { label: 'figure', type: 'type', detail: 'Environment', info: 'Floating figure' },
  { label: 'table', type: 'type', detail: 'Environment', info: 'Floating table' },
  { label: 'tabular', type: 'type', detail: 'Environment', info: 'Table content' },
  { label: 'equation', type: 'type', detail: 'Environment', info: 'Numbered equation' },
  { label: 'equation*', type: 'type', detail: 'Environment', info: 'Unnumbered equation' },
  { label: 'align', type: 'type', detail: 'Environment', info: 'Aligned equations (numbered)' },
  { label: 'align*', type: 'type', detail: 'Environment', info: 'Aligned equations (unnumbered)' },
  { label: 'gather', type: 'type', detail: 'Environment', info: 'Centered equations' },
  { label: 'multline', type: 'type', detail: 'Environment', info: 'Multi-line equation' },
  { label: 'array', type: 'type', detail: 'Environment', info: 'Math array' },
  { label: 'matrix', type: 'type', detail: 'Environment', info: 'Matrix (no delimiters)' },
  { label: 'pmatrix', type: 'type', detail: 'Environment', info: 'Matrix with parentheses' },
  { label: 'bmatrix', type: 'type', detail: 'Environment', info: 'Matrix with brackets' },
  { label: 'cases', type: 'type', detail: 'Environment', info: 'Piecewise cases' },
  { label: 'center', type: 'type', detail: 'Environment', info: 'Centered content' },
  { label: 'flushleft', type: 'type', detail: 'Environment', info: 'Left-aligned content' },
  { label: 'flushright', type: 'type', detail: 'Environment', info: 'Right-aligned content' },
  { label: 'minipage', type: 'type', detail: 'Environment', info: 'Mini page box' },
  { label: 'abstract', type: 'type', detail: 'Environment', info: 'Abstract section' },
  { label: 'verbatim', type: 'type', detail: 'Environment', info: 'Verbatim text' },
  { label: 'quote', type: 'type', detail: 'Environment', info: 'Block quote' },
  { label: 'theorem', type: 'type', detail: 'Environment', info: 'Theorem block' },
  { label: 'proof', type: 'type', detail: 'Environment', info: 'Proof block' },
  { label: 'tikzpicture', type: 'type', detail: 'Environment', info: 'TikZ drawing' },
];

// ── Package names (for \\usepackage{} context) ───────────────────────────────
export const packages = [
  { label: 'amsmath', type: 'variable', detail: 'Package', info: 'Enhanced math typesetting' },
  { label: 'amssymb', type: 'variable', detail: 'Package', info: 'Math symbols' },
  { label: 'amsthm', type: 'variable', detail: 'Package', info: 'Theorem environments' },
  { label: 'graphicx', type: 'variable', detail: 'Package', info: 'Include graphics' },
  { label: 'hyperref', type: 'variable', detail: 'Package', info: 'Hyperlinks and PDF metadata' },
  { label: 'geometry', type: 'variable', detail: 'Package', info: 'Page layout and margins' },
  { label: 'babel', type: 'variable', detail: 'Package', info: 'Multi-language support' },
  { label: 'fontenc', type: 'variable', detail: 'Package', info: 'Font encoding' },
  { label: 'inputenc', type: 'variable', detail: 'Package', info: 'Input encoding' },
  { label: 'xcolor', type: 'variable', detail: 'Package', info: 'Color support' },
  { label: 'listings', type: 'variable', detail: 'Package', info: 'Code listings' },
  { label: 'tikz', type: 'variable', detail: 'Package', info: 'TikZ drawings' },
  { label: 'pgfplots', type: 'variable', detail: 'Package', info: 'Plots and charts' },
  { label: 'booktabs', type: 'variable', detail: 'Package', info: 'Professional tables' },
  { label: 'multirow', type: 'variable', detail: 'Package', info: 'Multi-row table cells' },
  { label: 'caption', type: 'variable', detail: 'Package', info: 'Caption customization' },
  { label: 'subcaption', type: 'variable', detail: 'Package', info: 'Sub-figures and sub-tables' },
  { label: 'float', type: 'variable', detail: 'Package', info: 'Float placement control' },
  { label: 'fancyhdr', type: 'variable', detail: 'Package', info: 'Custom headers and footers' },
  { label: 'setspace', type: 'variable', detail: 'Package', info: 'Line spacing control' },
  { label: 'natbib', type: 'variable', detail: 'Package', info: 'Natural bibliography citations' },
  { label: 'biblatex', type: 'variable', detail: 'Package', info: 'Modern bibliography management' },
  { label: 'cleveref', type: 'variable', detail: 'Package', info: 'Smart cross-references' },
  { label: 'siunitx', type: 'variable', detail: 'Package', info: 'SI units typesetting' },
  { label: 'enumitem', type: 'variable', detail: 'Package', info: 'Customize list environments' },
  { label: 'tcolorbox', type: 'variable', detail: 'Package', info: 'Colored boxes' },
  { label: 'microtype', type: 'variable', detail: 'Package', info: 'Micro-typographic refinements' },
  { label: 'algorithm2e', type: 'variable', detail: 'Package', info: 'Algorithm typesetting' },
];

// ── All commands (for \\ context) ────────────────────────────────────────────
export const commands = [
  ...sectioningCommands,
  ...structureCommands,
  ...formattingCommands,
  ...mathCommands,
  ...greekLetters,
  ...referenceCommands,
  ...figureTableCommands,
];

// ── Completion Source Function ────────────────────────────────────────────────

/**
 * CodeMirror completion source for LaTeX.
 * @param {import('@codemirror/autocomplete').CompletionContext} context
 */
export function latexCompletionSource(context) {
  // 1. Check if we're inside \begin{ or \usepackage{
  const beforeCursor = context.matchBefore(/\\(begin|usepackage)\{[^}]*/);
  if (beforeCursor) {
    const isBegin = beforeCursor.text.includes('\\begin{');
    const bracePos = beforeCursor.text.lastIndexOf('{') + 1;
    const from = beforeCursor.from + bracePos;

    return {
      from,
      options: isBegin ? environments : packages,
      validFor: /^[a-zA-Z*]*/,
    };
  }

  // 2. Check if we're after a backslash (command completion)
  const word = context.matchBefore(/\\[a-zA-Z]*/);
  if (word) {
    if (word.from === word.to && !context.explicit) return null;
    return {
      from: word.from,
      options: commands,
      validFor: /^\\[a-zA-Z]*/,
    };
  }

  return null;
}
