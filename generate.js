import 'dotenv/config';
import OpenAI from 'openai';
import { config } from './config.js';
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildReviewSystemPrompt,
  buildReviewUserPrompt,
} from './prompt.js';
import { loadProfileSummary } from './profile.js';

/**
 * Gera o texto de um post usando o DeepSeek.
 * @param {string} [tema] - Tema específico. Se omitido, escolhe um aleatório de config.temas.
 * @returns {Promise<string>} texto do post pronto para publicar.
 */
export async function generatePost(tema) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('❌ DEEPSEEK_API_KEY não encontrada. Defina no arquivo .env.');
  }

  // Escolhe um tema aleatório se nenhum for passado
  const temaEscolhido =
    tema || config.temas[Math.floor(Math.random() * config.temas.length)];

  console.log(`🤖 Gerando post sobre: "${temaEscolhido}"...`);

  // Carrega o resumo do perfil (se já foi extraído com `node profile.js`).
  const profileSummary = loadProfileSummary();
  if (profileSummary) console.log('👤 Usando o resumo do seu perfil como contexto.');

  const client = new OpenAI({
    apiKey,
    baseURL: config.ia.baseURL,
  });

  const response = await client.chat.completions.create({
    model: config.ia.modelo,
    temperature: config.ia.temperatura,
    max_tokens: config.ia.maxTokens,
    messages: [
      { role: 'system', content: buildSystemPrompt(config, profileSummary) },
      { role: 'user', content: buildUserPrompt(temaEscolhido) },
    ],
  });

  let texto = response.choices[0]?.message?.content?.trim();
  if (!texto) {
    throw new Error('❌ A IA não retornou conteúdo.');
  }

  // Passo opcional de revisão/humanização
  if (config.estilo.revisarHumanizar) {
    console.log('✍️ Revisando para remover marcas de texto gerado por IA...');
    texto = await reviewPost(client, texto);
  }

  return texto;
}

/**
 * Segundo passo: reescreve o texto removendo bordões e padrões típicos de IA.
 */
async function reviewPost(client, texto) {
  const response = await client.chat.completions.create({
    model: config.ia.modelo,
    temperature: 0.7,
    max_tokens: config.ia.maxTokens,
    messages: [
      { role: 'system', content: buildReviewSystemPrompt(config) },
      { role: 'user', content: buildReviewUserPrompt(texto) },
    ],
  });

  const revisado = response.choices[0]?.message?.content?.trim();
  return revisado || texto; // se falhar, mantém o original
}

// Permite rodar diretamente: `node generate.js` ou `node generate.js "meu tema"`
if (import.meta.url === `file://${process.argv[1]}`) {
  const temaArg = process.argv.slice(2).join(' ') || undefined;
  generatePost(temaArg)
    .then((texto) => {
      console.log('\n===== POST GERADO =====\n');
      console.log(texto);
      console.log('\n=======================\n');
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
