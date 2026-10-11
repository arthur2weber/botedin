import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA_DIR = path.join(__dirname, '.browser-profile');
const COOKIES_FILE = './linkedin_cookies.json';

async function authenticate() {
  console.log('🔐 Iniciando autenticação no LinkedIn...');
  console.log('Por favor, faça login no LinkedIn manualmente no navegador que será aberto.');
  console.log('A sessão será salva automaticamente quando você chegar na feed.\n');

  // Usa um contexto persistente com configurações anti-detecção
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--start-maximized',
    ],
    viewport: null,
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  // Remove a flag navigator.webdriver que denuncia a automação
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

    console.log('⏳ Aguardando autenticação (até 5 minutos)...');
    console.log('💡 Dica: faça login direto com email e senha do LinkedIn (evite "Entrar com Google").');

    await page.waitForURL('**/feed/**', { timeout: 5 * 60 * 1000 });

    console.log('✅ Autenticação bem-sucedida!');

    const cookies = await context.cookies();
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log(`📁 Cookies salvos em: ${COOKIES_FILE}`);
    console.log('📁 Perfil do navegador salvo. A sessão persiste entre execuções.');
  } catch (error) {
    console.error('❌ Erro durante autenticação:', error.message);
  } finally {
    await context.close();
  }
}

authenticate();
