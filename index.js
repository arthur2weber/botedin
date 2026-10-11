import 'dotenv/config';
import { generatePost } from './generate.js';
import { postOnLinkedIn } from './post.js';

/**
 * Fluxo principal: gera um post com a IA e publica no LinkedIn.
 *
 * Uso:
 *   node index.js                      -> gera (tema aleatório), modo de teste
 *   node index.js "tema específico"    -> gera sobre o tema informado
 *   DRY_RUN=false node index.js        -> gera e PUBLICA agora
 *
 * Para AGENDAR em vez de publicar agora, use:
 *   node schedule.js "YYYY-MM-DD HH:mm" ["tema"]   (adiciona à fila)
 *   node scheduler.js                              (roda o agendador)
 */
async function main() {
  const tema = process.argv.slice(2).join(' ') || undefined;
  const dryRun = process.env.DRY_RUN !== 'false';

  const texto = await generatePost(tema);

  console.log('\n===== POST GERADO =====\n');
  console.log(texto);
  console.log('\n=======================\n');

  await postOnLinkedIn(texto, { dryRun });

  if (dryRun) {
    console.log('\n💡 Modo de teste: nada foi publicado. Opções:');
    console.log('   DRY_RUN=false node index.js                    (publicar agora)');
    console.log('   node schedule.js "2026-10-15 09:00"            (agendar para a fila)\n');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
