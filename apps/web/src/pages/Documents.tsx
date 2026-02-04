import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Edit, Trash2, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';

interface Document {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  template?: {
    id: string;
    title: string;
  };
}

export function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    status: 'DRAFT' as 'DRAFT' | 'FINALIZED',
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await api.get('/documents');
      setDocuments(response.data);
    } catch (error) {
      toast.error('Erro ao carregar documentos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este documento?')) return;
    
    try {
      await api.delete(`/documents/${id}`);
      toast.success('Documento excluído com sucesso');
      fetchDocuments();
    } catch (error) {
      toast.error('Erro ao excluir documento');
      console.error(error);
    }
  };

  const handleOpenModal = (document?: Document) => {
    if (document) {
      setEditingDocument(document);
      setFormData({
        title: document.title,
        content: document.content,
        status: document.status as 'DRAFT' | 'FINALIZED',
      });
    } else {
      setEditingDocument(null);
      setFormData({
        title: '',
        content: '',
        status: 'DRAFT',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDocument(null);
    setFormData({
      title: '',
      content: '',
      status: 'DRAFT',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      // Obter tenantId do usuário logado (simulado - deve vir do contexto de autenticação)
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tenantId = user.tenantId || 'default-tenant-id';

      if (editingDocument) {
        await api.patch(`/documents/${editingDocument.id}`, formData);
        toast.success('Documento atualizado com sucesso');
      } else {
        await api.post('/documents', {
          ...formData,
          tenantId,
        });
        toast.success('Documento criado com sucesso');
      }
      
      handleCloseModal();
      fetchDocuments();
    } catch (error) {
      toast.error(editingDocument ? 'Erro ao atualizar documento' : 'Erro ao criar documento');
      console.error(error);
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      DRAFT: { label: 'Rascunho', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
      FINALIZED: { label: 'Finalizado', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
    };
    const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileText className="text-indigo-400" size={32} />
            Biblioteca de Documentos
          </h1>
          <p className="text-slate-400 mt-1">
            Gerencie templates e documentos gerados
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Novo Documento
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Buscar documentos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto text-slate-600" size={64} />
          <h3 className="mt-4 text-xl font-medium text-slate-400">
            {searchTerm ? 'Nenhum documento encontrado' : 'Nenhum documento cadastrado'}
          </h3>
          <p className="text-slate-500 mt-2">
            {searchTerm ? 'Tente buscar com outros termos' : 'Comece criando um novo documento'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-indigo-500/50 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                    {doc.title}
                  </h3>
                  {doc.template && (
                    <p className="text-sm text-slate-400 mb-2">
                      Template: {doc.template.title}
                    </p>
                  )}
                  {getStatusBadge(doc.status)}
                </div>
              </div>

              <div className="text-sm text-slate-400 mb-4 space-y-1">
                <p>Criado: {formatDate(doc.createdAt)}</p>
                <p>Atualizado: {formatDate(doc.updatedAt)}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(doc)}
                  className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  title="Editar"
                >
                  <Edit size={16} />
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium flex items-center justify-center transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800">
              <h2 className="text-xl font-bold text-white">
                {editingDocument ? 'Editar Documento' : 'Novo Documento'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Digite o título do documento"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Conteúdo *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[200px]"
                  placeholder="Digite o conteúdo do documento"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'DRAFT' | 'FINALIZED' })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="FINALIZED">Finalizado</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  {editingDocument ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
