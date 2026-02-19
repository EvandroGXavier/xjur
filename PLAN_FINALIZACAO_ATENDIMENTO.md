# 🛠️ Plano de Finalização: Módulo de Atendimento DR.X

Este documento estabelece o roteiro técnico e funcional para transformar o módulo de atendimento em uma ferramenta robusta, integrando o "feeling" do WhatsApp Web com o poder do ecossistema jurídico DR.X.

## 🎯 Objetivo
Atingir a paridade funcional com o WhatsApp Web nas operações básicas e superá-lo na integração com processos judiciais, reduzindo o tempo de desenvolvimento manual de cada funcionalidade.

---

## 📅 Cronograma de Execução

### Fase 1: Estabilização e Mídia (Semana 1) - **STATUS: EM INÍCIO**
Focar na resiliência da conexão e na fluidez do gerenciamento de arquivos.
- [ ] **Persistência de Sessão:** Melhorar o `WhatsappService` para evitar desconexões frequentes e garantir auto-reconnect eficiente.
- [ ] **Reparo de Mídia:** Unificar a entrega de imagens, áudios e PDFs (Correção de URLs e MIME types).
- [ ] **Gravador de Áudio Pro:** Melhorar o `AudioRecorder` para gerar arquivos `.ogg` nativos (WhatsApp PTT), garantindo que os áudios gravados no sistema sejam ouvidos perfeitamente no celular do cliente.

### Fase 2: Refatoração Visual "Premium" (Semana 2)
Dividir para conquistar. Precisamos de um código limpo para adicionar funções rápido.
- [ ] **Arquitetura de Componentes:**
    - Extrair `ChatList.tsx` (Lista lateral reativa).
    - Extrair `MessageBubble.tsx` (Bolha de mensagem com suporte a citações).
    - Extrair `ChatHeader.tsx` (Informações e ações do ticket).
- [ ] **Feedback em Tempo Real:** Implementar os "checks" de mensagem (✓ / ✓✓) e indicadores de "Digitando...".
- [ ] **Busca Global:** Pesquisa por texto dentro da conversa ativa.

### Fase 3: O "Diferencial Jurídico" (Semana 3)
A funcionalidade que justifica o uso do sistema em vez do WhatsApp Web oficial.
- [ ] **Vínculo ao Processo 1-Clique:** Adicionar botão em cada mensagem de mídia/texto para "Enviar para o Processo X".
    - Isso criará automaticamente um registro na timeline do processo jurídico no sistema.
- [ ] **Painel de Inteligência Dr.X:** Drawer lateral com resumo de IA da conversa e busca automática de processos vinculados ao CPF do contato.

### Fase 4: Automação e Produtividade (Semana 4)
- [ ] **Templates Dinâmicos:** Mensagens rápidas que buscam dados do banco (Ex: Valor de honorários, número de processo).
- [ ] **Escalonamento de Mensagens:** Interface para agendamento de cobranças e lembretes futuros.

---

## 🛠️ Mudança de Mindset Técnico
Para acelerar o desenvolvimento de "uma por uma", adotaremos:
1. **Componentes Atômicos:** Não reescrever CSS para cada função. Usar os tokens do sistema DR.X.
2. **Unified Media Store:** Centralizar como o sistema lida com arquivos em `storage/uploads` para que o frontend apenas peça a URL e o tipo.
3. **Optimistic Updates:** Toda mensagem enviada aparece instantaneamente na tela, independente da resposta do servidor, com status de "enviando".

---
*Assinado: Antigravity AI (Dr.X Architect)*
