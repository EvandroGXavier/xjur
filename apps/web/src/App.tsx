import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard, Processes, Financial, AI, ContactList, ContactForm, ContactConfig, ProcessConfig, Login, Register, Settings, Library, UsersPage, Agenda, ForgotPassword, ResetPassword, ImportContacts, Atendimento, PaymentConditions, Inventory } from './pages';
import { ProcessForm } from './pages/processes/ProcessForm';
import { getToken } from './auth/authStorage';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { SigiloProvider } from './contexts/SigiloContext';

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = getToken();
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <SigiloProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <ErrorBoundary title="Falha ao carregar o sistema">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="atendimento" element={<Atendimento />} />
              <Route path="processes" element={<Processes />} />
              <Route path="processes/config" element={<ProcessConfig />} />

              <Route path="processes/new" element={<ProcessForm />} />
              <Route path="processes/:id" element={<ProcessForm />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="financial" element={<Financial />} />
              <Route path="financial/payment-conditions" element={<PaymentConditions />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="contacts" element={<ContactList />} />
              <Route path="contacts/config" element={<ContactConfig />} />
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
        </ErrorBoundary>
      </BrowserRouter>
    </SigiloProvider>
  );
}

export default App;
