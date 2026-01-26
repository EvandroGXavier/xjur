import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard, Chat, Processes, Financial, AI, ContactList, ContactForm } from './pages';
// Simularemos uma verificação de autenticação simples
const isAuthenticated = true; 

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Futura rota de Login apareceria aqui */}
        {/* <Route path="/login" element={<LoginPage />} /> */}
        
        <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="chat" element={<Chat />} />
          <Route path="processes" element={<Processes />} />
          <Route path="financial" element={<Financial />} />
          <Route path="contacts" element={<ContactList />} />
          <Route path="contacts/new" element={<ContactForm />} />
          <Route path="contacts/:id" element={<ContactForm />} />
          <Route path="ai" element={<AI />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;