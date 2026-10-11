/**
 * Carregador de configuração.
 * Toda a configuração vive em config.json (perfil, estilo, temas, limites, IA).
 * Edite o config.json; este módulo apenas carrega e expõe os valores.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error('❌ config.json não encontrado na raiz do projeto.');
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (err) {
    throw new Error(`❌ Erro ao ler config.json: ${err.message}`);
  }
}

/** Configuração completa carregada do config.json. */
export const config = loadConfig();

/** Retorna o resumo do perfil (ou null se não houver). */
export function getProfileSummary() {
  return config.perfil?.resumo || null;
}

/**
 * Atualiza a seção "perfil" no config.json (usado pelo extrator de perfil).
 * Preserva o restante da configuração.
 */
export function saveProfile(perfil) {
  const atual = loadConfig();
  atual.perfil = { ...atual.perfil, ...perfil };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(atual, null, 2));
  return atual.perfil;
}
