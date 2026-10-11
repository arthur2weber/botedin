import 'dotenv/config';
import { launchBrowser } from './post.js';
import { config, getProfileSummary, saveProfile } from './config.js';

const PROFILE_URL = process.env.PROFILE_URL || config.perfilUrl;

/**
 * Extrai um resumo do seu perfil do LinkedIn e salva na seção "perfil" do config.json.
 * O resumo é usado para contextualizar a IA ao gerar posts.
 *
 * Uso: node profile.js            (extrai e salva)
 *      node profile.js --show     (mostra o perfil salvo)
 */
async function extractProfile() {
  console.log(`🌐 Abrindo seu perfil: ${PROFILE_URL}`);
  const context = await launchBrowser();
  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);

    // Rola para carregar as seções principais.
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(1200);
    }

    const data = await page.evaluate(() => {
      const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');

      // Nome: primeiro <h1> da página de perfil.
      const nome = txt(document.querySelector('h1'));

      // Headline: costuma ser o parágrafo logo abaixo do nome.
      // Procuramos o primeiro bloco de texto curto após o h1.
      let headline = '';
      const h1 = document.querySelector('h1');
      if (h1) {
        let sib = h1.closest('div')?.parentElement;
        const cand = sib ? sib.querySelectorAll('div') : [];
        for (const d of cand) {
          const t = txt(d);
          if (t && t.length > 10 && t.length < 220 && t !== nome) {
            headline = t;
            break;
          }
        }
      }

      // Seção "About / Sobre": procura um heading com esse texto e pega o conteúdo próximo.
      let about = '';
      const headings = Array.from(document.querySelectorAll('h2, span'));
      const aboutHeading = headings.find((h) => /^(About|Sobre)$/i.test(txt(h)));
      if (aboutHeading) {
        const section = aboutHeading.closest('section');
        if (section) {
          // Pega o maior bloco de texto da seção.
          const blocks = Array.from(section.querySelectorAll('span, p, div'))
            .map((e) => txt(e))
            .filter((t) => t.length > 40);
          about = blocks.sort((a, b) => b.length - a.length)[0] || '';
        }
      }

      // Experiências: títulos dentro da seção Experience/Experiência.
      let experiencias = [];
      const expHeading = headings.find((h) => /^(Experience|Experiência)$/i.test(txt(h)));
      if (expHeading) {
        const section = expHeading.closest('section');
        if (section) {
          experiencias = Array.from(section.querySelectorAll('span[aria-hidden="true"]'))
            .map((e) => txt(e))
            .filter((t) => t.length > 3 && t.length < 100)
            .slice(0, 12);
        }
      }

      return { nome, headline, about, experiencias };
    });

    // Monta um resumo em texto corrido para o prompt.
    const resumo = buildResumo(data);
    saveProfile({
      nome: data.nome,
      headline: limpar(data.headline),
      resumo,
      atualizadoEm: new Date().toISOString(),
    });

    console.log('\n✅ Perfil extraído e salvo na seção "perfil" do config.json\n');
    console.log('===== RESUMO =====\n');
    console.log(resumo);
    console.log('\n==================');
    console.log('\n💡 Revise o config.json e ajuste o campo perfil.resumo se quiser.');
  } catch (err) {
    console.error('❌ Erro ao extrair perfil:', err.message);
  } finally {
    await context.close();
  }
}

/** Remove ruídos comuns do texto extraído do LinkedIn. */
function limpar(t) {
  if (!t) return '';
  return t
    .replace(/^About\s*/i, '')        // prefixo "About"
    .replace(/^Sobre\s*/i, '')        // prefixo "Sobre"
    .replace(/…\s*more.*$/i, '')      // "… more" e tudo depois (Top skills etc.)
    .replace(/\.\.\.\s*see more.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildResumo(d) {
  const partes = [];
  if (d.nome) partes.push(`Nome: ${d.nome}.`);
  if (d.headline) partes.push(`Headline: ${limpar(d.headline)}.`);
  const about = limpar(d.about);
  if (about) partes.push(`Sobre: ${about}`);
  if (d.experiencias?.length) {
    partes.push(`Experiências e termos do perfil: ${d.experiencias.slice(0, 8).join('; ')}.`);
  }
  return partes.join('\n');
}

/** Lê o resumo do perfil salvo no config.json (ou null se não existir). */
export function loadProfileSummary() {
  return getProfileSummary();
}

// Execução direta
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--show')) {
    const resumo = loadProfileSummary();
    console.log(resumo || '❌ Nenhum perfil salvo. Rode: node profile.js');
  } else {
    extractProfile();
  }
}
