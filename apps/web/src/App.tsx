import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard, Processes, Financial, AI, ContactList, ContactForm, Login, Register, Settings, Library, UsersPage, Agenda, ProductsList, ForgotPassword, ResetPassword, ImportContacts, AtendimentoPage, Kanban } from './pages';
import { ProcessForm } from './pages/processes/ProcessForm';

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="chat" element={<AtendimentoPage />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="processes" element={<Processes />} />
          <Route path="processes/new" element={<ProcessForm />} />
          <Route path="processes/:id" element={<ProcessForm />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="financial" element={<Financial />} />
          <Route path="products" element={<ProductsList />} />
          <Route path="contacts" element={<ContactList />} />
          <Route path="contacts/import" element={<ImportContacts />} />
          <Route path="contacts/new" element={<ContactForm />} />
          <Route path="contacts/:id" element={<ContactForm />} />
          <Route path="ai" element={<AI />} />
          <Route path="documents" element={<Library />} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;