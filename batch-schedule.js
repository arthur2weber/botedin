import 'dotenv/config';
import { config } from './config.js';
import { generatePost } from './generate.js';
import { launchBrowser, openComposerAndType, setNativeSchedule } from './post.js';

/**
 * Gera e agenda vários posts de uma vez usando o agendamento NATIVO do LinkedIn.
 * Como o LinkedIn publica mesmo com o PC desligado, basta uma execução.
 *
 * Uso:
 *   node batch-schedule.js 5         -> agenda os próximos 5 slots (ex.: 1 semana útil)
 *   node batch-schedule.js 48        -> agenda ~3 meses (limite do LinkedIn)
 *   START_DATE=2026-10-26 node batch-schedule.js 40  -> começa a partir dessa data
 *   DRY_RUN=true node batch-schedule.js 2  -> só mostra as datas e textos, sem agendar
 *
 * OBS.: o LinkedIn só permite agendar até ~3 meses no futuro. Datas além disso
 * são descartadas automaticamente (com aviso).
 */

const MAX_DIAS_FUTURO = 90; // limite prático do LinkedIn (~3 meses)

/** Calcula os próximos N horários de publicação conforme config.agendamento. */
function computeSlots(n) {
  const { horaDoDia, minuto, diasDaSemana, postsPorDia } = config.agendamento;
  const slots = [];
  const cursor = new Date();
  cursor.setSeconds(0, 0);

  // Data de início: amanhã por padrão, ou START_DATE se informado
  // (útil para continuar de onde um agendamento anterior parou).
  if (process.env.START_DATE) {
    const d = new Date(process.env.START_DATE.replace(' ', 'T'));
    if (!isNaN(d.getTime())) {
      cursor.setTime(d.getTime());
      cursor.setHours(0, 0, 0, 0);
    }
  } else {
    cursor.setDate(cursor.getDate() + 1);
  }

  // Limite de 3 meses no futuro.
  const limite = new Date();
  limite.setDate(limite.getDate() + MAX_DIAS_FUTURO);

  while (slots.length < n) {
    if (cursor > limite) {
      console.log(`⚠️  Limite de ~3 meses atingido. Agendando ${slots.length} de ${n} pedidos.`);
      break;
    }
    if (diasDaSemana.includes(cursor.getDay())) {
      for (let p = 0; p < postsPorDia && slots.length < n; p++) {
        const slot = new Date(cursor);
        slot.setHours(horaDoDia + p * 3, minuto, 0, 0);
        slots.push(slot);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}

/** Escolhe um tema evitando repetir o anterior quando possível. */
function pickTema(usados) {
  const temas = config.temas;
  const disponiveis = temas.filter((t) => !usados.has(t));
  const pool = disponiveis.length ? disponiveis : temas;
  const escolhido = pool[Math.floor(Math.random() * pool.length)];
  usados.add(escolhido);
  if (usados.size >= temas.length) usados.clear();
  return escolhido;
}

async function main() {
  const quantidade = parseInt(process.argv[2], 10);
  const dryRun = process.env.DRY_RUN === 'true';

  if (!quantidade || quantidade < 1) {
    console.log('Uso: node batch-schedule.js <quantidade>');
    console.log('Ex.: node batch-schedule.js 5     (próximos 5 posts)');
    return;
  }

  const slots = computeSlots(quantidade);

  console.log(`\n🗓️  Vou gerar e agendar ${quantidade} post(s) nos seguintes horários:`);
  slots.forEach((s, i) => console.log(`   ${i + 1}. ${s.toLocaleString()}`));
  console.log('');

  // 1. Gera todos os textos primeiro (sem navegador).
  const usados = new Set();
  const posts = [];
  for (let i = 0; i < quantidade; i++) {
    const tema = pickTema(usados);
    const texto = await generatePost(tema);
    posts.push({ texto, tema, quando: slots[i] });
    console.log(`\n----- POST ${i + 1}/${quantidade} (${slots[i].toLocaleString()}) -----`);
    console.log(`Tema: ${tema}\n`);
    console.log(texto);
  }

  if (dryRun) {
    console.log('\n🧪 DRY_RUN: nada foi agendado. Remova DRY_RUN=true para agendar de verdade.');
    return;
  }

  // 2. Abre o navegador UMA vez e agenda todos nativamente.
  console.log('\n🌐 Abrindo o navegador para agendar todos os posts...');
  const context = await launchBrowser();
  const page = context.pages()[0] || (await context.newPage());

  let sucesso = 0;
  try {
    for (let i = 0; i < posts.length; i++) {
      const { texto, quando } = posts[i];
      console.log(`\n📤 Agendando post ${i + 1}/${posts.length} para ${quando.toLocaleString()}...`);
      try {
        await openComposerAndType(page, texto);
        await setNativeSchedule(page, quando);

        const scheduleBtn = page.getByRole('button', { name: /^Schedule$|^Agendar$/ });
        await scheduleBtn.first().waitFor({ state: 'visible', timeout: 10000 });
        await scheduleBtn.first().click();
        await page.waitForTimeout(3000);
        console.log(`✅ Post ${i + 1} agendado.`);
        sucesso++;
      } catch (err) {
        console.error(`❌ Falha ao agendar post ${i + 1}:`, err.message);
        // Recupera o estado: fecha modais e descarta o rascunho atual para
        // começar o próximo post do zero, sem resíduos.
        await recoverToCleanState(page);
      }
    }
  } finally {
    await context.close();
  }

  console.log(`\n🎉 Concluído: ${sucesso}/${posts.length} post(s) agendado(s) no LinkedIn.`);
  console.log('💡 Para ver/editar, abra o compositor no LinkedIn e clique no relógio > "View scheduled posts".');
}

/**
 * Volta a página a um estado limpo após uma falha, descartando o rascunho atual.
 * Trata o popup "Save this post as a draft?" que aparece ao fechar o compositor.
 */
async function recoverToCleanState(page) {
  try {
    // Tenta fechar o compositor (botão Dismiss/X).
    const dismiss = page.getByRole('button', { name: /^Dismiss$|^Fechar$|^Close$/ });
    if ((await dismiss.count()) > 0) {
      await dismiss.first().click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Se aparecer o popup "Save this post as a draft?", clica em Discard.
    const discard = page.getByRole('button', { name: /^Discard$|^Descartar$/ });
    if ((await discard.count()) > 0) {
      await discard.first().click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  } catch {
    // Último recurso: recarrega a feed.
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
