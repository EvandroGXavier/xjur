import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard, Chat, Processes, Financial, AI, ContactList, ContactForm, Login, Register, Settings, Documents, UsersPage } from './pages';

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
        {/* Futura rota de Login apareceria aqui */}
        {/* <Route path="/login" element={<LoginPage />} /> */}
        
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="chat" element={<Chat />} />
          <Route path="processes" element={<Processes />} />
          <Route path="financial" element={<Financial />} />
          <Route path="contacts" element={<ContactList />} />
          <Route path="contacts/new" element={<ContactForm />} />
          <Route path="contacts/:id" element={<ContactForm />} />
          <Route path="ai" element={<AI />} />
          <Route path="documents" element={<Documents />} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;