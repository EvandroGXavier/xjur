import React from 'react';
import { createRoot } from 'react-dom/client';
import { XjurSidebar } from './Sidebar';
import './style.css'; // Ovite vai cuidar do HMR

const WA_ROOT_SELECTOR = '#app'; // Seletor raiz do WhatsApp Web
const XJUR_CONTAINER_ID = 'xjur-client-root';

// Função para iniciar a injeção
function initXjur() {
  console.log('[Xjur] Inicializando extensão...');

  const appRoot = document.querySelector(WA_ROOT_SELECTOR);
  if (!appRoot) {
    console.log('[Xjur] WhatsApp Web ainda não carregou completamente. Tentando novamente...');
    setTimeout(initXjur, 1000); // Tentar novamente em 1s
    return;
  }

  // Verifica se já injetou
  if (document.getElementById(XJUR_CONTAINER_ID)) {
    console.log('[Xjur] Sidebar já injetada.');
    return;
  }

  // Cria o container do Xjur
  const rootDiv = document.createElement('div');
  rootDiv.id = XJUR_CONTAINER_ID;

  // Ajusta o estilo do container principal do WA para dar espaço à Sidebar
  // O app do WA geralmente é display: flex, basta adicionar nosso container como irmão
  // Mas cuidado: o WA é reativo e pode restaurar estilos. O ideal é usar wrapper ou manipular classes.
  // Vamos tentar injetar como irmão e usar CSS Grid/Flex no body se necessário,
  // ou injetar dentro do main wrapper.
  
  // Estrategia Autozap: Injeta no body e usa absolute/fixed ou ajusta margins.
  // Melhor estrategia Xjur: Fixed Sidebar na direita, empurrando o body do WA.
  
  document.body.appendChild(rootDiv);

  // Renderiza o React
  const root = createRoot(rootDiv);
  root.render(
    <React.StrictMode>
      <XjurSidebar />
    </React.StrictMode>
  );

  console.log('[Xjur] Sidebar injetada com sucesso!');
}

// Inicia quando a página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initXjur);
} else {
  initXjur();
}
