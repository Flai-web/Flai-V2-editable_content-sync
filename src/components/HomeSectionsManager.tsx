import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, ArrowUp, ArrowDown, Code, FileCode, Trash } from 'lucide-react';
import { supabase } from '../utils/supabase';
import ImageUpload from './ImageUpload';
import toast from 'react-hot-toast';
import EditableContent from './EditableContent';

interface CodeFile {
  filename: string;
  language: 'html' | 'javascript' | 'typescript' | 'python' | 'tsx';
  content: string;
}

interface HomeSection {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  order_index: number;
  is_active: boolean;
  section_type: 'standard' | 'code';
  code_files?: CodeFile[];
  created_at: string;
  updated_at: string;
}

const HomeSectionsManager: React.FC = () => {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<HomeSection | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSection, setNewSection] = useState({
    title: '',
    description: '',
    image_url: '',
    is_active: true,
    section_type: 'standard' as 'standard' | 'code',
    code_files: [] as CodeFile[]
  });

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      const { data, error } = await supabase
        .from('home_sections')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setSections(data || []);
    } catch (err) {
      console.error('Error fetching home sections:', err);
      toast.error('Kunne ikke hente sektioner');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSection = async () => {
    if (newSection.section_type === 'standard') {
      if (!newSection.title.trim() || !newSection.description.trim() || !newSection.image_url) {
        toast.error('Udfyld alle felter for standard sektion');
        return;
      }
    } else {
      if (newSection.code_files.length === 0) {
        toast.error('Tilføj mindst én fil til projektet');
        return;
      }
      const hasHtml = newSection.code_files.some(f => f.language === 'html');
      if (!hasHtml) {
        toast.error('Du skal have en index.html fil');
        return;
      }
    }

    try {
      const maxOrder = Math.max(...sections.map(s => s.order_index), -1);
      
      const { error } = await supabase
        .from('home_sections')
        .insert([{
          title: newSection.title || 'Code Project',
          description: newSection.description || 'Interactive Code Section',
          image_url: newSection.image_url || null,
          is_active: newSection.is_active,
          section_type: newSection.section_type,
          code_files: newSection.section_type === 'code' ? newSection.code_files : null,
          order_index: maxOrder + 1
        }]);

      if (error) throw error;

      toast.success('Sektion tilføjet');
      setNewSection({ 
        title: '', 
        description: '', 
        image_url: '', 
        is_active: true,
        section_type: 'standard',
        code_files: []
      });
      setShowAddForm(false);
      await fetchSections();
    } catch (err) {
      console.error('Error adding section:', err);
      toast.error('Kunne ikke tilføje sektion');
    }
  };

  const handleUpdateSection = async (section: HomeSection) => {
    if (section.section_type === 'standard') {
      if (!section.title.trim() || !section.description.trim() || !section.image_url) {
        toast.error('Udfyld alle felter for standard sektion');
        return;
      }
    } else {
      if (!section.code_files || section.code_files.length === 0) {
        toast.error('Tilføj mindst én fil til projektet');
        return;
      }
      const hasHtml = section.code_files.some(f => f.language === 'html');
      if (!hasHtml) {
        toast.error('Du skal have en index.html fil');
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('home_sections')
        .update({
          title: section.title,
          description: section.description,
          image_url: section.image_url || null,
          is_active: section.is_active,
          section_type: section.section_type,
          code_files: section.section_type === 'code' ? section.code_files : null
        })
        .eq('id', section.id);

      if (error) throw error;

      toast.success('Sektion opdateret');
      setEditingSection(null);
      await fetchSections();
    } catch (err) {
      console.error('Error updating section:', err);
      toast.error('Kunne ikke opdatere sektion');
    }
  };

  const handleDeleteSection = async (id: string) => {
    if (!confirm('Er du sikker på at du vil slette denne sektion?')) return;

    try {
      const { error } = await supabase
        .from('home_sections')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Sektion slettet');
      await fetchSections();
    } catch (err) {
      console.error('Error deleting section:', err);
      toast.error('Kunne ikke slette sektion');
    }
  };

  const handleMoveSection = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = sections.findIndex(s => s.id === id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    try {
      const currentSection = sections[currentIndex];
      const targetSection = sections[newIndex];

      await supabase
        .from('home_sections')
        .update({ order_index: targetSection.order_index })
        .eq('id', currentSection.id);

      await supabase
        .from('home_sections')
        .update({ order_index: currentSection.order_index })
        .eq('id', targetSection.id);

      await fetchSections();
      toast.success('Rækkefølge opdateret');
    } catch (err) {
      console.error('Error moving section:', err);
      toast.error('Kunne ikke ændre rækkefølge');
    }
  };

  const handleImageUpload = (url: string, isForEdit = false) => {
    if (isForEdit && editingSection) {
      setEditingSection({ ...editingSection, image_url: url });
    } else {
      setNewSection({ ...newSection, image_url: url });
    }
  };

  const addCodeFile = (isEdit: boolean) => {
    const files = isEdit ? editingSection!.code_files || [] : newSection.code_files;
    
    // Check limits
    const htmlCount = files.filter(f => f.language === 'html').length;
    const otherCount = files.filter(f => f.language !== 'html').length;
    
    if (htmlCount >= 1 && otherCount >= 4) {
      toast.error('Max 1 HTML fil og 4 andre filer');
      return;
    }

    const newFile: CodeFile = {
      filename: '',
      language: htmlCount === 0 ? 'html' : 'javascript',
      content: ''
    };

    if (isEdit) {
      setEditingSection({
        ...editingSection!,
        code_files: [...(editingSection!.code_files || []), newFile]
      });
    } else {
      setNewSection({
        ...newSection,
        code_files: [...newSection.code_files, newFile]
      });
    }
  };

  const updateCodeFile = (index: number, updates: Partial<CodeFile>, isEdit: boolean) => {
    const files = isEdit ? [...(editingSection!.code_files || [])] : [...newSection.code_files];
    
    // Check if changing to HTML would exceed limit
    if (updates.language === 'html') {
      const currentHtmlCount = files.filter((f, i) => i !== index && f.language === 'html').length;
      if (currentHtmlCount >= 1) {
        toast.error('Du kan kun have 1 HTML fil');
        return;
      }
    }
    
    files[index] = { ...files[index], ...updates };
    
    if (isEdit) {
      setEditingSection({ ...editingSection!, code_files: files });
    } else {
      setNewSection({ ...newSection, code_files: files });
    }
  };

  const removeCodeFile = (index: number, isEdit: boolean) => {
    const files = isEdit ? [...(editingSection!.code_files || [])] : [...newSection.code_files];
    files.splice(index, 1);
    
    if (isEdit) {
      setEditingSection({ ...editingSection!, code_files: files });
    } else {
      setNewSection({ ...newSection, code_files: files });
    }
  };

  const renderCodeEditor = (
    codeFiles: CodeFile[],
    isEdit: boolean
  ) => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="form-label"><EditableContent contentKey="home-sections-manager-project-filer" fallback="Project Filer" /></label>
          <button
            onClick={() => addCodeFile(isEdit)}
            className="btn-secondary text-sm flex items-center"
            disabled={codeFiles.length >= 5}
          >
            <Plus size={16} className="mr-1" />
            <EditableContent contentKey="home-sections-manager-tilfoej-fil" fallback="Tilføj Fil" /></button>
        </div>

        {codeFiles.map((file, index) => (
          <div key={index} className="bg-neutral-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={file.filename}
                  onChange={(e) => updateCodeFile(index, { filename: e.target.value }, isEdit)}
                  className="form-input text-sm"
                  placeholder={
                    file.language === 'html' 
                      ? 'index.html' 
                      : `script.${
                          file.language === 'typescript' 
                            ? 'ts' 
                            : file.language === 'python' 
                              ? 'py' 
                              : file.language === 'tsx' 
                                ? 'tsx' 
                                : 'js'
                        }`
                  }
                />
              </div>
              
              <select
                value={file.language}
                onChange={(e) => updateCodeFile(index, { language: e.target.value as any }, isEdit)}
                className="form-input text-sm w-40"
              >
                <option value="html">HTML</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="tsx">TSX</option>
                <option value="python">Python</option>
              </select>

              <button
                onClick={() => removeCodeFile(index, isEdit)}
                className="p-2 text-error hover:bg-error/10 rounded transition-colors"
              >
                <Trash size={16} />
              </button>
            </div>

            <textarea
              value={file.content}
              onChange={(e) => updateCodeFile(index, { content: e.target.value }, isEdit)}
              className="form-input resize-none font-mono text-sm w-full"
              rows={12}
              placeholder={`Skriv din ${file.language.toUpperCase()} kode her...`}
              spellCheck={false}
            />
          </div>
        ))}

        {codeFiles.length === 0 && (
          <div className="text-center py-8 text-neutral-400">
            <FileCode size={48} className="mx-auto mb-3 opacity-50" />
            <p><EditableContent contentKey="home-sections-manager-ingen-filer-endnu-klik-tilfoej" fallback="Ingen filer endnu. Klik &quot;Tilføj Fil&quot; for at starte." /></p>
          </div>
        )}

        <div className="text-sm text-neutral-400">
          <p><EditableContent contentKey="home-sections-manager-maksimum-1-html-fil-index" fallback="• Maksimum 1 HTML fil (index.html påkrævet)" /></p>
          <p><EditableContent contentKey="home-sections-manager-maksimum-4-andre-filer-js" fallback="• Maksimum 4 andre filer (JS, TS, TSX, eller Python)" /></p>
        </div>
      </div>
    );
  };

  const renderSectionForm = (
    section: typeof newSection | HomeSection,
    isEdit: boolean = false
  ) => {
    const updateSection = (updates: Partial<typeof section>) => {
      if (isEdit) {
        setEditingSection({ ...editingSection!, ...updates } as HomeSection);
      } else {
        setNewSection({ ...newSection, ...updates });
      }
    };

    return (
      <div className="space-y-4">
        <div>
          <label className="form-label"><EditableContent contentKey="home-sections-manager-sektion-type" fallback="Sektion Type" /></label>
          <select
            value={section.section_type}
            onChange={(e) => updateSection({ section_type: e.target.value as 'standard' | 'code' })}
            className="form-input"
          >
            <option value="standard">Standard (Billede + Tekst)</option>
            <option value="code">Code Project</option>
          </select>
        </div>

        {section.section_type === 'standard' ? (
          <>
            <div>
              <label className="form-label"><EditableContent contentKey="home-sections-manager-titel" fallback="Titel" /></label>
              <input
                type="text"
                value={section.title}
                onChange={(e) => updateSection({ title: e.target.value })}
                className="form-input"
                placeholder="Indtast titel"
              />
            </div>
            
            <div>
              <label className="form-label"><EditableContent contentKey="home-sections-manager-beskrivelse" fallback="Beskrivelse" /></label>
              <textarea
                value={section.description}
                onChange={(e) => updateSection({ description: e.target.value })}
                className="form-input resize-none"
                rows={3}
                placeholder="Indtast beskrivelse"
              />
            </div>

            <div>
              <label className="form-label"><EditableContent contentKey="home-sections-manager-billede" fallback="Billede" /></label>
              <ImageUpload
                onImageUploaded={(url) => handleImageUpload(url, isEdit)}
                bucket="home-sections"
              />
              {section.image_url && (
                <div className="mt-2">
                  <img
                    src={section.image_url}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          renderCodeEditor(section.code_files || [], isEdit)
        )}

        <div className="flex items-center">
          <input
            type="checkbox"
            id={`${isEdit ? 'edit' : 'new'}-active`}
            checked={section.is_active}
            onChange={(e) => updateSection({ is_active: e.target.checked })}
            className="mr-2"
          />
          <label htmlFor={`${isEdit ? 'edit' : 'new'}-active`} className="text-neutral-300">
            <EditableContent contentKey="home-sections-manager-aktiv" fallback="Aktiv" /></label>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-2"><EditableContent contentKey="home-sections-manager-indlaeser-sektioner" fallback="Indlæser sektioner..." /></p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold"><EditableContent contentKey="home-sections-manager-forside-sektioner" fallback="Forside Sektioner" /></h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center"
        >
          <Plus size={20} className="mr-2" />
          <EditableContent contentKey="home-sections-manager-tilfoej-sektion" fallback="Tilføj Sektion" /></button>
      </div>

      {showAddForm && (
        <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
          <h3 className="text-xl font-semibold mb-4"><EditableContent contentKey="home-sections-manager-tilfoej-ny-sektion" fallback="Tilføj Ny Sektion" /></h3>
          {renderSectionForm(newSection)}
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewSection({ 
                  title: '', 
                  description: '', 
                  image_url: '', 
                  is_active: true,
                  section_type: 'standard',
                  code_files: []
                });
              }}
              className="btn-secondary"
            >
              <EditableContent contentKey="home-sections-manager-annuller" fallback="Annuller" /></button>
            <button onClick={handleAddSection} className="btn-primary">
              Tilføj Sektion
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sections.map((section, index) => (
          <div key={section.id} className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
            {editingSection?.id === section.id ? (
              <div>
                {renderSectionForm(editingSection, true)}
                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    onClick={() => setEditingSection(null)}
                    className="btn-secondary flex items-center"
                  >
                    <X size={16} className="mr-2" />
                    Annuller
                  </button>
                  <button
                    onClick={() => handleUpdateSection(editingSection)}
                    className="btn-primary flex items-center"
                  >
                    <Save size={16} className="mr-2" />
                    <EditableContent contentKey="home-sections-manager-gem" fallback="Gem" /></button>
                </div>
              </div>
            ) : (
              <div className="flex items-start space-x-4">
                {section.section_type === 'code' ? (
                  <div className="w-24 h-24 bg-neutral-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Code size={32} className="text-primary" />
                  </div>
                ) : (
                  <img
                    src={section.image_url}
                    alt={section.title}
                    className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{section.title}</h3>
                      <p className="text-neutral-300 mt-1">{section.description}</p>
                      <div className="flex items-center mt-2 space-x-4">
                        <span className={`text-sm px-2 py-1 rounded-full ${
                          section.is_active 
                            ? 'bg-success/10 text-success' 
                            : 'bg-neutral-600/20 text-neutral-400'
                        }`}>
                          {section.is_active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                        {section.section_type === 'code' && (
                          <span className="text-sm text-neutral-400">
                            {section.code_files?.length || 0} <EditableContent contentKey="home-sections-manager-filer" fallback="filer" /></span>
                        )}
                        <span className="text-sm text-neutral-400">
                          <EditableContent contentKey="home-sections-manager-raekkefoelge" fallback="Rækkefølge:" />{section.order_index + 1}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleMoveSection(section.id, 'up')}
                        disabled={index === 0}
                        className="p-2 text-neutral-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={() => handleMoveSection(section.id, 'down')}
                        disabled={index === sections.length - 1}
                        className="p-2 text-neutral-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        onClick={() => setEditingSection(section)}
                        className="p-2 text-neutral-400 hover:text-white transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteSection(section.id)}
                        className="p-2 text-neutral-400 hover:text-error transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {sections.length === 0 && (
          <p className="text-center py-12 text-neutral-400">
            <EditableContent contentKey="home-sections-manager-ingen-sektioner-fundet-tilfoej-den" fallback="Ingen sektioner fundet. Tilføj den første sektion for at komme i gang." /></p>
        )}
      </div>
    </div>
  );
};

export default HomeSectionsManager;