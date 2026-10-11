import 'dotenv/config';
import { config } from './config.js';
import { launchBrowser } from './post.js';
import { generateComment } from './comments.js';

// Deriva a URL de atividade a partir do perfil configurado no config.json.
const ACTIVITY_URL = config.perfilUrl.replace(/\/+$/, '') + '/recent-activity/all/';
// Opcional: URL de um post específico (mais confiável que navegar pela atividade).
// Ex.: POST_URL="https://www.linkedin.com/feed/update/urn:li:activity:123/" node interact.js
const POST_URL = process.env.POST_URL || null;

// Modo de simulação: não clica em nada de verdade, só mostra o que faria.
const DRY_RUN = process.env.DRY_RUN !== 'false';
// Se true, apenas curte (não posta respostas públicas). Útil para validar o Like.
const SKIP_REPLY = process.env.SKIP_REPLY === 'true';

/** Pausa aleatória entre min e max ms (salvaguarda anti-bot). */
function humanDelay(min = 1500, max = 4000) {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fase 1: curtir e responder os comentários feitos nos SEUS posts.
 * Percorre seus posts recentes, abre os comentários e, para cada comentário
 * de outra pessoa: dá Like e responde com uma resposta sugerida pronta.
 */
async function main() {
  const limites = config.interacoes;
  console.log('🤝 Iniciando interações com comentários nos seus posts...');
  if (DRY_RUN) console.log('🧪 MODO DE TESTE (DRY_RUN): nada será clicado de verdade.\n');

  const context = await launchBrowser();
  const page = context.pages()[0] || (await context.newPage());

  try {
    if (POST_URL) {
      console.log(`🌐 Abrindo o post: ${POST_URL}`);
      await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await humanDelay(2500, 3500);
      // Rola um pouco para carregar os comentários.
      await page.mouse.wheel(0, 1000);
      await humanDelay(1500, 2500);
    } else {
      console.log('🌐 Abrindo sua atividade recente...');
      await page.goto(ACTIVITY_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await humanDelay(2000, 3000);
      await abrirPrimeiroPost(page);
      await humanDelay(2000, 3500);
    }

    const resultado = await processarComentarios(page, limites);
    console.log(`\n🎉 Concluído: ${resultado.curtidos} curtida(s), ${resultado.respondidos} resposta(s).`);
  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    if (!DRY_RUN) await context.close();
    else {
      console.log('\n🧪 DRY_RUN: navegador aberto para inspeção. Feche quando terminar.');
      await page.waitForEvent('close', { timeout: 0 }).catch(() => {});
    }
  }
}

/** Abre o primeiro post da lista de atividade para exibir os comentários. */
async function abrirPrimeiroPost(page) {
  console.log('📄 Abrindo o primeiro post...');
  // O link do post costuma estar no timestamp/corpo. Clicamos no botão "Comment"
  // do primeiro post para focar/expandir a área de comentários.
  const commentBtn = page.getByRole('button', { name: /^Comment$/ });
  if ((await commentBtn.count()) > 0) {
    await commentBtn.first().click().catch(() => {});
    await humanDelay(2000, 3000);
  }
}

/**
 * Percorre os comentários visíveis e aplica Like + resposta sugerida.
 * Usa seletores baseados na estrutura real do comentário.
 */
async function processarComentarios(page, limites) {
  let curtidos = 0;
  let respondidos = 0;

  // Âncora estável: o botão de reação de cada comentário tem um
  // svg[aria-label^="Reaction button state"]. A partir dele, achamos o
  // container do comentário (ancestral que também contém o link /in/ e o Reply).
  const reactionSvgs = page.locator('svg[aria-label^="Reaction button state"]');
  const total = await reactionSvgs.count();
  console.log(`💬 Comentários detectados: ${total}`);

  const maxComentarios = Math.min(total, limites.maxComentariosPorExecucao);

  for (let i = 0; i < maxComentarios; i++) {
    const svg = reactionSvgs.nth(i);

    const info = await svg.evaluate((node) => {
      // Sobe até o ancestral que contém link /in/ E um botão "Reply".
      let container = node;
      for (let d = 0; d < 12 && container; d++) {
        container = container.parentElement;
        if (!container) break;
        const link = container.querySelector('a[href*="/in/"]');
        const reply = Array.from(container.querySelectorAll('button')).find(
          (b) => /^reply$/i.test((b.textContent || '').trim()) ||
                 /reply|responder/i.test(b.getAttribute('aria-label') || '')
        );
        if (link && reply) {
          const hiddenSpan = link.querySelector('span[aria-hidden="true"]');
          const raw = (hiddenSpan ? hiddenSpan.textContent : link.textContent) || '';
          const nome = raw.split('•')[0].replace(/\s+/g, ' ').trim().slice(0, 40);
          const state = node.getAttribute('aria-label') || '';
          return {
            autor: nome || '(sem nome)',
            href: link.getAttribute('href'),
            // "Reaction button state: Like" = já curtido; "no reaction" = não.
            jaCurtido: /state:\s*Like/i.test(state),
          };
        }
      }
      return null;
    });

    if (!info) {
      console.log(`\n⚠️  Comentário ${i + 1}: estrutura não reconhecida, pulando.`);
      continue;
    }
    console.log(`\n👤 Comentário de: ${info.autor} (já curtido: ${info.jaCurtido})`);

    // 1. Curtir (se ainda não curtido)
    if (!info.jaCurtido) {
      if (DRY_RUN) {
        console.log('   🧪 [DRY] Daria Like neste comentário.');
      } else {
        const ok = await curtirPorSvg(svg);
        if (ok) { curtidos++; console.log('   👍 Curtido.'); }
        else console.log('   ⚠️  Não consegui clicar no Like.');
      }
      await humanDelay();
    } else {
      console.log('   ⏭️  Já estava curtido, pulando o Like.');
    }

    // 2. Responder com comentário gerado
    if (SKIP_REPLY) {
      console.log('   ⏭️  SKIP_REPLY ativo: não vou responder (só curtir).');
    } else if (DRY_RUN) {
      const exemplo = generateComment({ coerente: true, incluirCorpo: config.interacoes.comentarioComCorpo });
      console.log(`   🧪 [DRY] Responderia com: "${exemplo}"`);
    } else {
      const ok = await responderPorSvg(page, svg);
      if (ok) { respondidos++; console.log('   💬 Respondido.'); }
      else console.log('   ⚠️  Não consegui abrir o editor de resposta, pulando.');
    }
    await humanDelay(2500, 5000);
  }

  return { curtidos, respondidos };
}

/** Clica no botão de curtir associado a um svg de reação. */
async function curtirPorSvg(svg) {
  return svg.evaluate((node) => {
    const likeBtn = node.closest('[role="button"]');
    if (likeBtn) { likeBtn.click(); return true; }
    return false;
  });
}

/** Abre o Reply do comentário do svg, digita e envia um comentário gerado. */
async function responderPorSvg(page, svg) {
  // Clica no botão Reply dentro do mesmo container.
  const abriu = await svg.evaluate((node) => {
    let container = node;
    for (let d = 0; d < 12 && container; d++) {
      container = container.parentElement;
      if (!container) break;
      const reply = Array.from(container.querySelectorAll('button')).find(
        (b) => /^reply$/i.test((b.textContent || '').trim()) ||
               /^reply$/i.test(b.getAttribute('aria-label') || '')
      );
      const link = container.querySelector('a[href*="/in/"]');
      if (reply && link) { reply.click(); return true; }
    }
    return false;
  });
  if (!abriu) return false;

  await humanDelay(1200, 2200);

  const editor = page.locator('div[contenteditable="true"][role="textbox"]');
  if ((await editor.count()) === 0) return false;

  const texto = generateComment({ coerente: true, incluirCorpo: config.interacoes.comentarioComCorpo });
  await editor.last().click();
  await humanDelay(400, 900);
  await page.keyboard.type(texto, { delay: 15 });
  await humanDelay(800, 1500);

  const enviar = page.getByRole('button', { name: /^Reply$|^Comment$|^Post$/ });
  if ((await enviar.count()) > 0) {
    await enviar.last().click().catch(() => {});
    await humanDelay(1500, 2500);
    return true;
  }
  return false;
}



main();
