import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA_DIR = path.join(__dirname, '.browser-profile');

// Se true, insere o texto mas NÃO publica/agenda (modo de teste).
const DRY_RUN = process.env.DRY_RUN !== 'false';

/** Abre o navegador com o perfil persistente e as configurações anti-detecção. */
export async function launchBrowser() {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--start-maximized'],
    viewport: null,
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return context;
}

/** Abre o compositor na feed e insere o texto. Retorna a página pronta. */
export async function openComposerAndType(page, postContent) {
  console.log('🌐 Acessando LinkedIn...');
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });

  if (page.url().includes('/login')) {
    throw new Error('Sessão expirada. Rode "npm run authenticate" novamente.');
  }

  console.log('⏳ Aguardando a feed carregar...');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);

  console.log('✍️ Abrindo o compositor de post...');
  await page
    .getByRole('button', { name: /Start a post|Começar publicação|Criar publicação/i })
    .first()
    .click();

  const editor = page.locator(
    'div.ProseMirror[contenteditable="true"], div[role="textbox"][contenteditable="true"]'
  );
  await editor.first().waitFor({ state: 'visible', timeout: 15000 });

  console.log('📝 Inserindo conteúdo...');
  await editor.first().click();
  await page.keyboard.type(postContent, { delay: 15 });
}

/**
 * Define data e hora no modal de agendamento nativo do LinkedIn.
 * @param {import('playwright').Page} page
 * @param {Date} scheduleAt
 */
export async function setNativeSchedule(page, scheduleAt) {
  console.log('🕐 Abrindo o agendamento nativo...');

  // O botão de agendar é um link <a aria-label="Scheduled"> com SVG #clock-medium.
  const scheduleTrigger = page.locator('a[aria-label="Scheduled"], [aria-label="Scheduled"]');
  await scheduleTrigger.first().waitFor({ state: 'visible', timeout: 10000 });
  await scheduleTrigger.first().click();
  await page.waitForTimeout(2000);

  const dateStr = formatDate(scheduleAt); // mm/dd/yyyy
  const timeStr = formatTime(scheduleAt); // h:mm AM/PM (sem zero à esquerda)
  console.log(`📅 Definindo data ${dateStr} e hora ${timeStr}...`);

  // --- Data: input com placeholder "mm/dd/yyyy" (aceita digitação) ---
  // IMPORTANTE: NÃO pressionar Escape aqui. O Escape sai do compositor e dispara
  // o popup "Save this post as a draft?", que bloqueia todo o resto.
  const dateInput = page.locator('input[placeholder="mm/dd/yyyy"]');
  await dateInput.first().click();
  await selectAll(page);
  await page.keyboard.type(dateStr, { delay: 40 });
  await page.waitForTimeout(500);

  // --- Hora: dropdown com opções role="menuitemradio". ---
  // Abre pelo botão "Open time picker" e seleciona a opção pelo texto exato.
  console.log('⏰ Selecionando a hora no dropdown...');
  await page.getByRole('button', { name: /Open time picker/i }).first().click();
  await page.waitForTimeout(800);

  const timeOption = page.getByRole('menuitemradio', { name: new RegExp(`^${escapeRegex(timeStr)}$`, 'i') });
  if ((await timeOption.count()) > 0) {
    await timeOption.first().scrollIntoViewIfNeeded().catch(() => {});
    await timeOption.first().click();
    await page.waitForTimeout(400);
  } else {
    // Se a hora exata não estiver na lista, mantém o valor padrão do campo.
    console.log(`⚠️ Opção "${timeStr}" não encontrada no dropdown; mantendo o horário padrão.`);
    await page.keyboard.press('Escape').catch(() => {}); // fecha só o dropdown de hora
  }

  // --- Confirm: fecha o modal de data/hora e volta ao compositor. ---
  const confirmBtn = page.getByRole('button', { name: /^Confirm$|^Confirmar$/ });
  await confirmBtn.first().waitFor({ state: 'visible', timeout: 10000 });
  await confirmBtn.first().click();
  await confirmBtn.first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  console.log('✅ Data/hora confirmadas.');
}

/** Escapa caracteres especiais de regex. */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Publica ou agenda um post no LinkedIn.
 * @param {string} postContent
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun]
 * @param {Date} [opts.scheduleAt] - se informado, agenda nativamente.
 */
export async function postOnLinkedIn(postContent, { dryRun = DRY_RUN, scheduleAt = null } = {}) {
  console.log('📱 Preparando para postar no LinkedIn...');
  if (dryRun) console.log('🧪 MODO DE TESTE (DRY_RUN): nada será publicado/agendado.\n');
  if (scheduleAt) console.log(`🗓️  Agendando para: ${scheduleAt.toLocaleString()}\n`);

  const context = await launchBrowser();
  const page = context.pages()[0] || (await context.newPage());

  try {
    await openComposerAndType(page, postContent);

    // Define o agendamento ANTES de confirmar, se solicitado.
    if (scheduleAt && !dryRun) {
      await setNativeSchedule(page, scheduleAt);
    }

    if (dryRun) {
      console.log('🧪 Texto inserido. O navegador ficará aberto para você conferir.');
      console.log('   Feche o navegador manualmente quando terminar.');
      await page.waitForEvent('close', { timeout: 0 }).catch(() => {});
      return;
    }

    // Ao agendar, o botão "Post" passa a ser "Schedule". Cobrimos os dois nomes.
    const actionLabel = scheduleAt ? /^Schedule$|^Agendar$/ : /^Post$|^Publicar$/;
    console.log(scheduleAt ? '🗓️  Confirmando agendamento...' : '🚀 Publicando...');

    const actionButton = page.getByRole('button', { name: actionLabel });
    await actionButton.first().waitFor({ state: 'visible', timeout: 10000 });
    await actionButton.first().click();

    await page.waitForTimeout(4000);
    console.log(scheduleAt ? `✅ Post agendado para ${scheduleAt.toLocaleString()}!` : '✅ Post publicado!');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    if (!dryRun) await context.close();
  }
}

/** Formata data como mm/dd/yyyy (padrão do campo do LinkedIn em en-US). */
function formatDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** Formata hora como "h:mm AM/PM" (ex.: 1:00 PM, 9:30 AM). */
function formatTime(d) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/** Seleciona todo o conteúdo do campo focado para substituir. */
async function selectAll(page) {
  await page.keyboard.press('Control+A').catch(() => {});
  await page.keyboard.press('Delete').catch(() => {});
}

// Execução direta para teste.
if (import.meta.url === `file://${process.argv[1]}`) {
  const examplePost = `🧪 Post de teste (automação com Playwright) — pode ignorar.`;
  postOnLinkedIn(examplePost).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
