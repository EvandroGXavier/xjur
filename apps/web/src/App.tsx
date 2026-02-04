import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard, Chat, Processos, ProcessoConfig, ModuleConfigPlaceholder, Financial, FinancialNew, FinancialConfig, AI, ContactList, ContactForm, Login, Register, Settings } from './pages';

// Simularemos uma verificação de autenticação simples
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = localStorage.getItem('token'); // Simplificação. Ideal: Validar token.
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard/config" element={<ModuleConfigPlaceholder />} />
          
          <Route path="chat" element={<Chat />} />
          <Route path="chat/config" element={<ModuleConfigPlaceholder />} />
          
          <Route path="processos" element={<Processos />} />
          <Route path="processos/configuracoes" element={<ProcessoConfig />} />
          
          <Route path="financial" element={<Financial />} />
          <Route path="financial/new" element={<FinancialNew />} />
          <Route path="financial/config" element={<FinancialConfig />} />
          
          <Route path="contacts" element={<ContactList />} />
          <Route path="contacts/config" element={<ModuleConfigPlaceholder />} />
          {/* <Route path="contacts/new" element={<ContactForm />} /> 
              <Route path="contacts/:id" element={<ContactForm />} /> 
               Wait, ContactList/Form are real pages I saw in file list. 
               I need to make sure I don't break them. existing routes were:
               <Route path="contacts" element={<ContactList />} />
               <Route path="contacts/new" element={<ContactForm />} />
               <Route path="contacts/:id" element={<ContactForm />} />
          */}
          <Route path="contacts/new" element={<ContactForm />} />
          <Route path="contacts/:id" element={<ContactForm />} />

          <Route path="ai" element={<AI />} />
          <Route path="ai/config" element={<ModuleConfigPlaceholder />} />

          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;