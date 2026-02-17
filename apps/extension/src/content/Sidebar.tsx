import React, { useState } from 'react';
import css from './Sidebar.module.css';

export const XjurSidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
    // Ajusta o body do WhatsApp para dar espaço
    // Use requestAnimationFrame para garantir sincronia com render
    requestAnimationFrame(() => {
      document.body.style.width = isOpen ? '100%' : 'calc(100% - 300px)'; // Exemplo simples, melhor refinement depois
      document.body.style.marginLeft = isOpen ? '0' : '0'; // Se for Sidebar Esquerda
      document.body.style.marginRight = isOpen ? '0' : '300px'; // Sidebar Direita
    });
  };

  return (
    <div className={`${css.sidebarContainer} ${isOpen ? css.open : css.closed}`}>
      {/* Botão de Toggle */}
      <button className={css.toggleBtn} onClick={toggleSidebar}>
        {isOpen ? '>' : '<'}
      </button>

      {/* Conteúdo da Sidebar (Visível apenas se Aberto) */}
      <div className={css.content}>
        <div className={css.header}>
          <h2>Xjur</h2>
          <span className={css.version}>v1.0 Demo</span>
        </div>

        <div className={css.menu}>
          <button className={css.menuItem}>📥 CRM</button>
          <button className={css.menuItem}>📝 Tarefas</button>
          <button className={css.menuItem}>⚙️ Config</button>
        </div>

        <div className={css.body}>
          <p>Selecione uma conversa para ver detalhes do cliente.</p>
          {/* Aqui entrará o componente de detalhes do contato */}
        </div>
      </div>
    </div>
  );
};
