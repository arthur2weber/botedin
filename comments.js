/**
 * Gerador de comentários genéricos para engajamento.
 * As frases ficam no config.json (seção "comentarios"); este módulo apenas
 * monta o comentário combinando as 4 partes:
 *   aberturas  -> Validação / Abertura  (tem mais variações)
 *   corpos[].contexto -> Contexto / Desafio
 *   corpos[].impacto  -> Impacto prático / Solução
 *   corpos[].pergunta -> Gancho de fechamento / Pergunta
 *
 * Dentro de cada "corpo", contexto/impacto/pergunta são alinhados (coesos).
 */
import { config } from './config.js';

const openings = config.comentarios?.aberturas || [];
const bodies = config.comentarios?.corpos || [];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Gera um comentário genérico.
 * @param {object} [opts]
 * @param {boolean} [opts.coerente=true] - mantém contexto/impacto/pergunta da mesma linha.
 * @param {boolean} [opts.incluirCorpo=true] - se false, retorna só a abertura (comentário curto).
 * @returns {string}
 */
export function generateComment({ coerente = true, incluirCorpo = true } = {}) {
  if (openings.length === 0) {
    throw new Error('❌ Nenhuma abertura configurada em config.json > comentarios.aberturas.');
  }

  const opening = pick(openings);
  if (!incluirCorpo || bodies.length === 0) return opening;

  let contexto, impacto, pergunta;
  if (coerente) {
    ({ contexto, impacto, pergunta } = pick(bodies));
  } else {
    contexto = pick(bodies).contexto;
    impacto = pick(bodies).impacto;
    pergunta = pick(bodies).pergunta;
  }

  return `${opening} ${contexto} ${impacto} ${pergunta}`;
}

/** Gera N comentários distintos (sem repetir, quando possível). */
export function generateMany(n, opts) {
  const set = new Set();
  let tentativas = 0;
  while (set.size < n && tentativas < n * 20) {
    set.add(generateComment(opts));
    tentativas++;
  }
  return [...set];
}

// Execução direta: mostra alguns exemplos.
if (import.meta.url === `file://${process.argv[1]}`) {
  const qtd = parseInt(process.argv[2], 10) || 5;
  const soAbertura = process.argv.includes('--short');
  console.log(`\n=== ${qtd} COMENTÁRIOS GERADOS ===\n`);
  generateMany(qtd, { incluirCorpo: !soAbertura }).forEach((c, i) => {
    console.log(`${i + 1}. ${c}\n`);
  });
}
