import React, { useState } from 'react';
import { Plus, CreditCard as Edit, Trash2, Save, X, Image as ImageIcon, ThumbsUp, ThumbsDown, Package, Images, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useData } from '../../contexts/DataContext';
import ImageUpload from '../ImageUpload';
import EditableContent from '../EditableContent';
import toast from 'react-hot-toast';

const PortfolioManager: React.FC = () => {
  const { portfolioImages, refreshPortfolio, bundles, refreshBundles } = useData();
  const [editingImage, setEditingImage] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [addToBundleId, setAddToBundleId] = useState<string | null>(null);
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());

  const [newImage, setNewImage] = useState({ title: '', image_url: '' });

  const [newBundle, setNewBundle] = useState({
    name: '',
    images: [] as Array<{ image_url: string; title: string }>
  });

  const [groupBundle, setGroupBundle] = useState({
    name: '',
    imageIds: [] as string[]
  });

  const [addToBundle, setAddToBundle] = useState({
    images: [] as Array<{ image_url: string; title: string }>
  });

  // ─── Bundle toggle ────────────────────────────────────────────────────────────

  const toggleBundle = (bundleId: string) => {
    setExpandedBundles(prev => {
      const next = new Set(prev);
      next.has(bundleId) ? next.delete(bundleId) : next.add(bundleId);
      return next;
    });
  };

  // ─── Single image ─────────────────────────────────────────────────────────────

  const handleAddImage = async () => {
    if (!newImage.title.trim() || !newImage.image_url) {
      toast.error('Udfyld alle felter');
      return;
    }
    try {
      const maxSortOrder = portfolioImages.length > 0
        ? Math.max(...portfolioImages.map(img => img.sort_order || 0))
        : -1;
      const { error } = await supabase
        .from('portfolio_images')
        .insert([{ ...newImage, sort_order: maxSortOrder + 1 }]);
      if (error) throw error;
      toast.success('Portfolio billede tilføjet');
      setNewImage({ title: '', image_url: '' });
      setShowAddForm(false);
      await refreshPortfolio();
    } catch (err) {
      console.error(err);
      toast.error('Kunne ikke tilføje billede');
    }
  };

  // ─── Create new bundle ────────────────────────────────────────────────────────

  const handleCreateBundle = async () => {
    if (!newBundle.name.trim()) {
      toast.error('Bundle navn er påkrævet');
      return;
    }
    if (newBundle.images.length === 0) {
      toast.error('Tilføj mindst ét billede til bundlen');
      return;
    }
    try {
      const { data: bundleData, error: bundleError } = await supabase
        .from('portfolio_bundles')
        .insert([{ name: newBundle.name }])
        .select()
        .single();
      if (bundleError) throw bundleError;

      const maxSortOrder = portfolioImages.length > 0
        ? Math.max(...portfolioImages.map(img => img.sort_order || 0))
        : -1;

      const rows = newBundle.images.map((img, i) => ({
        title: img.title,
        image_url: img.image_url,
        bundle_id: bundleData.id,
        sort_order: maxSortOrder + 1 + i,
      }));

      const { error: imagesError } = await supabase.from('portfolio_images').insert(rows);
      if (imagesError) throw imagesError;

      toast.success(`Bundle oprettet med ${newBundle.images.length} billeder`);
      setNewBundle({ name: '', images: [] });
      setShowBundleForm(false);
      await refreshPortfolio();
      await refreshBundles();
    } catch (err) {
      console.error(err);
      toast.error('Kunne ikke oprette bundle');
    }
  };

  // ─── Group existing images ────────────────────────────────────────────────────

  const handleGroupExisting = async () => {
    if (!groupBundle.name.trim()) { toast.error('Bundle navn er påkrævet'); return; }
    if (groupBundle.imageIds.length === 0) { toast.error('Vælg mindst ét billede'); return; }
    try {
      const { data: bundleData, error: bundleError } = await supabase
        .from('portfolio_bundles')
        .insert([{ name: groupBundle.name }])
        .select()
        .single();
      if (bundleError) throw bundleError;

      const imageOrderMap = new Map<string, number>();
      portfolioImages.forEach((img, i) => imageOrderMap.set(img.id, i));

      await Promise.all(
        groupBundle.imageIds.map(id =>
          supabase
            .from('portfolio_images')
            .update({ bundle_id: bundleData.id, sort_order: imageOrderMap.get(id) || 0 })
            .eq('id', id)
        )
      );

      toast.success(`${groupBundle.imageIds.length} billeder grupperet i bundle`);
      setGroupBundle({ name: '', imageIds: [] });
      setShowGroupForm(false);
      await refreshPortfolio();
      await refreshBundles();
    } catch (err) {
      console.error(err);
      toast.error('Kunne ikke gruppere billeder');
    }
  };

  // ─── Add images to existing bundle ───────────────────────────────────────────

  const handleAddToBundle = async () => {
    if (!addToBundleId) return;
    if (addToBundle.images.length === 0) { toast.error('Tilføj mindst ét billede'); return; }
    try {
      const maxSortOrder = portfolioImages.length > 0
        ? Math.max(...portfolioImages.map(img => img.sort_order || 0))
        : -1;

      const rows = addToBundle.images.map((img, i) => ({
        title: img.title,
        image_url: img.image_url,
        bundle_id: addToBundleId,
        sort_order: maxSortOrder + 1 + i,
      }));

      const { error } = await supabase.from('portfolio_images').insert(rows);
      if (error) throw error;

      toast.success(`${addToBundle.images.length} billeder tilføjet til bundle`);
      setAddToBundle({ images: [] });
      setAddToBundleId(null);
      await refreshPortfolio();
    } catch (err) {
      console.error(err);
      toast.error('Kunne ikke tilføje billeder til bundle');
    }
  };

  // ─── Mutation helpers ─────────────────────────────────────────────────────────

  const handleRemoveFromBundle = async (imageId: string) => {
    if (!confirm('Fjern dette billede fra bundlen?')) return;
    try {
      const { error } = await supabase
        .from('portfolio_images')
        .update({ bundle_id: null, image_name: null })
        .eq('id', imageId);
      if (error) throw error;
      toast.success('Billede fjernet fra bundle');
      await refreshPortfolio();
    } catch (err) {
      console.error(err);
      toast.error('Kunne ikke fjerne billede');
    }
  };

  const handleDeleteBundle = async (bundleId: string) => {
    if (!confirm('Slet denne bundle? Billeder vil forblive, men bundlen slettes.')) return;
    try {
      await supabase
        .from('portfolio_images')
        .update({ bundle_id: null, image_name: null })
        .eq('bundle_id', bundleId);
      const { error } = await supabase.from('portfolio_bundles').delete().eq('id', bundleId);
      if (error) throw error;
      toast.success('Bundle slettet');
      await refreshPortfolio();
      await refreshBundles();
    } catch (err) {
      console.error(err);
      toast.error('Kunne ikke slette bundle');
    }
  };

  const handleUpdateImage = async () => {
    if (!editingImage?.title.trim()) { toast.error('Titel er påkrævet'); return; }
    try {
      const { error } = await supabase
        .from('portfolio_images')
        .update({
          title: editingImage.title,
          image_url: editingImage.image_url,
          image_name: editingImage.image_name || null,
        })
        .eq('id', editingImage.id);
      if (error) throw error;
      toast.success('Portfolio billede opdateret');
      setEditingImage(null);
      await refreshPortfolio();
    } catch (err) {
      console.error(err);
      toast.error('Kunne ikke opdatere billede');
    }
  };

  const handleDeleteImage = async (id: string) => {
    if (!confirm('Er du sikker på at du vil slette dette billede?')) return;
    try {
      const { error } = await supabase.from('portfolio_images').delete().eq('id', id);
      if (error) throw error;
      toast.success('Portfolio billede slettet');
      await refreshPortfolio();
      await refreshBundles();
    } catch (err) {
      console.error(err);
      toast.error('Kunne ikke slette billede');
    }
  };

  // ─── Upload callbacks ─────────────────────────────────────────────────────────

  // ImageUpload calls onImageUploaded once per file (single or each of multi-upload)
  const handleNewBundleImageUploaded = (url: string) => {
    if (!url) return;
    setNewBundle(prev => ({
      ...prev,
      images: [...prev.images, { image_url: url, title: `Billede ${prev.images.length + 1}` }],
    }));
  };

  const handleAddToBundleImageUploaded = (url: string) => {
    if (!url) return;
    setAddToBundle(prev => ({
      images: [...prev.images, { image_url: url, title: `Billede ${prev.images.length + 1}` }],
    }));
  };

  const updateBundleImageTitle = (index: number, title: string, target: 'new' | 'addTo') => {
    if (target === 'new') {
      setNewBundle(prev => ({
        ...prev,
        images: prev.images.map((img, i) => i === index ? { ...img, title } : img),
      }));
    } else {
      setAddToBundle(prev => ({
        images: prev.images.map((img, i) => i === index ? { ...img, title } : img),
      }));
    }
  };

  const removeBundleImage = (index: number, target: 'new' | 'addTo') => {
    if (target === 'new') {
      setNewBundle(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    } else {
      setAddToBundle(prev => ({ images: prev.images.filter((_, i) => i !== index) }));
    }
  };

  const toggleImageSelection = (imageId: string) => {
    setGroupBundle(prev => ({
      ...prev,
      imageIds: prev.imageIds.includes(imageId)
        ? prev.imageIds.filter(id => id !== imageId)
        : [...prev.imageIds, imageId],
    }));
  };

  // ─── Render helpers ───────────────────────────────────────────────────────────

  const renderMedia = (image: any) => {
    if (image.image_url?.startsWith('youtube:')) {
      const videoId = image.image_url.split(':')[1];
      return (
        <div className="relative w-full aspect-video">
          <iframe
            className="absolute inset-0 w-full h-full rounded-lg"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      );
    }
    return (
      <img
        src={image.image_url}
        alt={image.title}
        className="w-full h-48 object-cover rounded-lg"
      />
    );
  };

  const renderBundleImageList = (
    images: Array<{ image_url: string; title: string }>,
    target: 'new' | 'addTo'
  ) =>
    images.length > 0 && (
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-neutral-300">
          {images.length} <EditableContent contentKey="portfolio-manager-billede" fallback="billede" />{images.length !== 1 ? 'r' : ''} <EditableContent contentKey="portfolio-manager-klar" fallback="klar" /></h4>
        {images.map((img, index) => (
          <div key={index} className="bg-neutral-800/50 rounded-lg p-3 flex items-center space-x-3">
            <img src={img.image_url} alt="" className="w-16 h-16 object-cover rounded flex-shrink-0" />
            <input
              type="text"
              value={img.title}
              onChange={(e) => updateBundleImageTitle(index, e.target.value, target)}
              className="form-input flex-1 text-sm"
              placeholder="Billede titel"
            />
            <button
              onClick={() => removeBundleImage(index, target)}
              className="text-error hover:text-red-400 p-1 flex-shrink-0"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    );

  const unbundledImages = portfolioImages.filter(img => !img.bundle_id);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <EditableContent
          contentKey="admin-portfolio-title"
          as="h2"
          className="text-2xl font-bold"
          fallback="Portfolio Administration"
        />
        <div className="flex space-x-3">
          <button onClick={() => setShowBundleForm(true)} className="btn-secondary flex items-center">
            <Package size={20} className="mr-2" /> <EditableContent contentKey="portfolio-manager-ny-bundle" fallback="Ny Bundle" /></button>
          <button onClick={() => setShowGroupForm(true)} className="btn-secondary flex items-center">
            <Images size={20} className="mr-2" /> <EditableContent contentKey="portfolio-manager-grupp-r-billeder" fallback="Gruppér Billeder" /></button>
          <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center">
            <Plus size={20} className="mr-2" /> <EditableContent contentKey="portfolio-manager-tilfoej-billede" fallback="Tilføj Billede" /></button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Billeder', value: portfolioImages.length, icon: <ImageIcon className="text-primary" size={20} /> },
          { label: 'Bundles', value: bundles.length, icon: <Package className="text-primary" size={20} /> },
          { label: 'Total Likes', value: portfolioImages.reduce((s, i) => s + i.likes, 0), icon: <ThumbsUp className="text-success" size={20} />, cls: 'text-success' },
          { label: 'Total Dislikes', value: portfolioImages.reduce((s, i) => s + i.dislikes, 0), icon: <ThumbsDown className="text-error" size={20} />, cls: 'text-error' },
        ].map(stat => (
          <div key={stat.label} className="bg-neutral-700/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-400 text-sm">{stat.label}</p>
                <p className={`text-xl font-bold ${'cls' in stat ? stat.cls : ''}`}>{stat.value}</p>
              </div>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── Create Bundle Form ─────────────────────────────────────────────── */}
      {showBundleForm && (
        <div className="bg-neutral-700/20 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-semibold"><EditableContent contentKey="portfolio-manager-opret-ny-bundle" fallback="Opret Ny Bundle" /></h3>
          <div>
            <label className="form-label"><EditableContent contentKey="portfolio-manager-bundle-navn" fallback="Bundle Navn" /></label>
            <input
              type="text"
              value={newBundle.name}
              onChange={(e) => setNewBundle({ ...newBundle, name: e.target.value })}
              className="form-input"
              placeholder="F.eks. Bryllup i København"
            />
          </div>
          <div>
            <label className="form-label"><EditableContent contentKey="portfolio-manager-tilfoej-billeder" fallback="Tilføj Billeder" /></label>
            <ImageUpload
              onImageUploaded={handleNewBundleImageUploaded}
              bucket="portfolio"
              allowMultiple
            />
          </div>
          {renderBundleImageList(newBundle.images, 'new')}
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => { setShowBundleForm(false); setNewBundle({ name: '', images: [] }); }}
              className="btn-secondary"
            >
              <EditableContent contentKey="portfolio-manager-annuller" fallback="Annuller" /></button>
            <button onClick={handleCreateBundle} className="btn-primary">
              <EditableContent contentKey="portfolio-manager-opret-bundle" fallback="Opret Bundle" /></button>
          </div>
        </div>
      )}

      {/* ── Group Existing Images Form ─────────────────────────────────────── */}
      {showGroupForm && (
        <div className="bg-neutral-700/20 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-semibold"><EditableContent contentKey="portfolio-manager-grupp-r-eksisterende-billeder" fallback="Gruppér Eksisterende Billeder" /></h3>
          <div>
            <label className="form-label">Bundle Navn</label>
            <input
              type="text"
              value={groupBundle.name}
              onChange={(e) => setGroupBundle({ ...groupBundle, name: e.target.value })}
              className="form-input"
              placeholder="F.eks. Firmaevent 2024"
            />
          </div>
          <div>
            <label className="form-label"><EditableContent contentKey="portfolio-manager-vaelg-billeder" fallback="Vælg Billeder (" />{groupBundle.imageIds.length} <EditableContent contentKey="portfolio-manager-valgt" fallback="valgt)" /></label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
              {unbundledImages.map(image => (
                <div
                  key={image.id}
                  onClick={() => toggleImageSelection(image.id)}
                  className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    groupBundle.imageIds.includes(image.id)
                      ? 'border-primary ring-2 ring-primary/50'
                      : 'border-transparent hover:border-neutral-500'
                  }`}
                >
                  <img src={image.image_url} alt={image.title} className="w-full h-32 object-cover" />
                  <div className="p-2 bg-neutral-800">
                    <p className="text-sm truncate">{image.title}</p>
                  </div>
                </div>
              ))}
            </div>
            {unbundledImages.length === 0 && (
              <p className="text-neutral-400 text-sm mt-2"><EditableContent contentKey="portfolio-manager-ingen-ubundlede-billeder-tilgaengelige" fallback="Ingen ubundlede billeder tilgængelige" /></p>
            )}
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => { setShowGroupForm(false); setGroupBundle({ name: '', imageIds: [] }); }}
              className="btn-secondary"
            >
              Annuller
            </button>
            <button onClick={handleGroupExisting} className="btn-primary">
              Gruppér Billeder
            </button>
          </div>
        </div>
      )}

      {/* ── Add Images to Existing Bundle Form ────────────────────────────── */}
      {addToBundleId && (
        <div className="bg-neutral-700/20 rounded-lg p-6 space-y-4 border-2 border-primary/30">
          <div>
            <h3 className="text-xl font-semibold"><EditableContent contentKey="portfolio-manager-tilfoej-billeder-til-bundle" fallback="Tilføj billeder til bundle" /></h3>
            <p className="text-neutral-400 text-sm mt-1">
              {bundles.find(b => b.id === addToBundleId)?.name}
            </p>
          </div>
          <div>
            <label className="form-label"><EditableContent contentKey="portfolio-manager-upload-billeder" fallback="Upload Billeder" /></label>
            <ImageUpload
              onImageUploaded={handleAddToBundleImageUploaded}
              bucket="portfolio"
              allowMultiple
            />
          </div>
          {renderBundleImageList(addToBundle.images, 'addTo')}
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => { setAddToBundleId(null); setAddToBundle({ images: [] }); }}
              className="btn-secondary"
            >
              Annuller
            </button>
            <button onClick={handleAddToBundle} className="btn-primary">
              <EditableContent contentKey="portfolio-manager-tilfoej-til-bundle" fallback="Tilføj til Bundle" /></button>
          </div>
        </div>
      )}

      {/* ── Add Single Image Form ──────────────────────────────────────────── */}
      {showAddForm && (
        <div className="bg-neutral-700/20 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-semibold"><EditableContent contentKey="portfolio-manager-tilfoej-nyt-portfolio-billede" fallback="Tilføj Nyt Portfolio Billede" /></h3>
          <div>
            <label className="form-label"><EditableContent contentKey="portfolio-manager-titel" fallback="Titel" /></label>
            <input
              type="text"
              value={newImage.title}
              onChange={(e) => setNewImage({ ...newImage, title: e.target.value })}
              className="form-input"
              placeholder="Indtast billedtitel"
            />
          </div>
          <div>
            <label className="form-label"><EditableContent contentKey="portfolio-manager-billede-eller-video" fallback="Billede eller Video" /></label>
            <ImageUpload
              onImageUploaded={(url) => setNewImage(prev => ({ ...prev, image_url: url }))}
              currentImageUrl={newImage.image_url || null}
              bucket="portfolio"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => { setShowAddForm(false); setNewImage({ title: '', image_url: '' }); }}
              className="btn-secondary"
            >
              Annuller
            </button>
            <button onClick={handleAddImage} className="btn-primary">
              <EditableContent contentKey="portfolio-manager-gem-billede" fallback="Gem Billede" /></button>
          </div>
        </div>
      )}

      {/* ── Portfolio Grid ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold flex items-center">
          <ImageIcon className="mr-2" size={24} />
          <EditableContent contentKey="portfolio-manager-portfolio-billeder" fallback="Portfolio Billeder" /></h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(() => {
            const renderedBundles = new Set<string>();
            const sorted = [...portfolioImages].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

            return sorted.map(image => {

              // ── Bundled image ─────────────────────────────────────────────
              if (image.bundle_id) {
                if (renderedBundles.has(image.bundle_id)) return null;
                renderedBundles.add(image.bundle_id);

                const bundle = bundles.find(b => b.id === image.bundle_id);
                const bundleImages = sorted.filter(img => img.bundle_id === image.bundle_id);
                const isExpanded = expandedBundles.has(image.bundle_id);

                // Collapsed bundle card
                if (!isExpanded) {
                  return (
                    <div key={`bundle-${image.bundle_id}`} className="relative scale-95">
                      <div className="relative cursor-pointer group" onClick={() => toggleBundle(image.bundle_id!)}>
                        {bundleImages.length > 2 && bundleImages[2] && (
                          <div className="absolute inset-0 bg-neutral-700/20 rounded-lg border-2 border-white/40 transform translate-x-4 translate-y-4 transition-all duration-300 group-hover:translate-x-6 group-hover:translate-y-6 overflow-hidden shadow-lg shadow-white/10">
                            <img src={bundleImages[2].image_url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/40 via-neutral-900/50 to-neutral-900/60" />
                          </div>
                        )}
                        {bundleImages.length > 1 && bundleImages[1] && (
                          <div className="absolute inset-0 bg-neutral-700/30 rounded-lg border-2 border-white/45 transform translate-x-2 translate-y-2 transition-all duration-300 group-hover:translate-x-3 group-hover:translate-y-3 overflow-hidden shadow-lg shadow-white/15">
                            <img src={bundleImages[1].image_url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/30 via-neutral-900/40 to-neutral-900/50" />
                          </div>
                        )}
                        <div className="relative bg-neutral-700/20 rounded-lg overflow-hidden border-2 border-white/50 shadow-xl shadow-white/20">
                          <div className="relative">
                            {renderMedia(bundleImages[0])}
                            <div className="absolute top-2 left-2 bg-neutral-900/90 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center space-x-2 border border-white/30">
                              <Package size={14} className="text-white" />
                              <span className="text-sm font-medium">{bundleImages.length}</span>
                            </div>
                            <div className="absolute top-2 right-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteBundle(image.bundle_id!); }}
                                className="p-2 bg-neutral-900/90 backdrop-blur-sm text-error hover:bg-error hover:text-white rounded transition-colors border border-neutral-700"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="p-3">
                            <h4 className="font-medium mb-1 flex items-center text-sm">
                              <Package size={14} className="mr-2 text-white" />
                              {bundle?.name || 'Bundle'}
                            </h4>
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-3">
                                <span className="flex items-center space-x-1 text-success">
                                  <ThumbsUp size={12} /><span>{bundleImages.reduce((s, i) => s + i.likes, 0)}</span>
                                </span>
                                <span className="flex items-center space-x-1 text-error">
                                  <ThumbsDown size={12} /><span>{bundleImages.reduce((s, i) => s + i.dislikes, 0)}</span>
                                </span>
                              </div>
                              <span className="text-white font-medium flex items-center">
                                <EditableContent contentKey="portfolio-manager-udvid" fallback="Udvid" /><ChevronDown size={14} className="ml-1" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Expanded bundle
                return (
                  <React.Fragment key={`bundle-${image.bundle_id}`}>
                    {/* Bundle header */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3">
                      <div
                        className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 cursor-pointer hover:from-primary/15 transition-all border-2 border-primary/30"
                        onClick={() => toggleBundle(image.bundle_id!)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <ChevronUp size={20} className="text-primary" />
                            <Package size={20} className="text-primary" />
                            <div>
                              <h4 className="font-medium text-lg">{bundle?.name || 'Bundle'}</h4>
                              <p className="text-sm text-neutral-400">{bundleImages.length} <EditableContent contentKey="portfolio-manager-billeder" fallback="billeder" /></p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="flex items-center space-x-1 text-success text-sm">
                              <ThumbsUp size={14} /><span>{bundleImages.reduce((s, i) => s + i.likes, 0)}</span>
                            </span>
                            <span className="flex items-center space-x-1 text-error text-sm">
                              <ThumbsDown size={14} /><span>{bundleImages.reduce((s, i) => s + i.dislikes, 0)}</span>
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddToBundleId(image.bundle_id!);
                                setAddToBundle({ images: [] });
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded transition-colors text-sm font-medium flex items-center"
                            >
                              <Plus size={14} className="mr-1" /> <EditableContent contentKey="portfolio-manager-tilfoej-billeder-2" fallback="Tilføj billeder" /></button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteBundle(image.bundle_id!); }}
                              className="px-3 py-1.5 bg-error/10 text-error hover:bg-error hover:text-white rounded transition-colors text-sm font-medium flex items-center"
                            >
                              <Trash2 size={14} className="mr-1" /> <EditableContent contentKey="portfolio-manager-slet-bundle" fallback="Slet Bundle" /></button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bundle image cards */}
                    {bundleImages.map((bundleImage, index) => (
                      <div
                        key={bundleImage.id}
                        className="animate-in fade-in slide-in-from-top-4"
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                      >
                        <div className="relative">
                          <div className="absolute -inset-1 bg-primary/10 rounded-lg" />
                          <div className="relative bg-neutral-700/20 rounded-lg overflow-hidden border-2 border-primary/40">
                            {editingImage?.id === bundleImage.id ? (
                              <div className="p-4 space-y-3">
                                <div>
                                  <label className="form-label text-sm">Titel</label>
                                  <input
                                    type="text"
                                    value={editingImage.title}
                                    onChange={(e) => setEditingImage({ ...editingImage, title: e.target.value })}
                                    className="form-input"
                                  />
                                </div>
                                <div>
                                  <label className="form-label text-sm"><EditableContent contentKey="portfolio-manager-billede-navn-intern" fallback="Billede Navn (intern)" /></label>
                                  <input
                                    type="text"
                                    value={editingImage.image_name || ''}
                                    onChange={(e) => setEditingImage({ ...editingImage, image_name: e.target.value })}
                                    className="form-input"
                                    placeholder="Valgfrit"
                                  />
                                </div>
                                <div className="flex justify-end space-x-2">
                                  <button onClick={() => setEditingImage(null)} className="btn-secondary text-sm py-1 px-3 flex items-center">
                                    <X size={14} className="mr-1" /> Annuller
                                  </button>
                                  <button onClick={handleUpdateImage} className="btn-primary text-sm py-1 px-3 flex items-center">
                                    <Save size={14} className="mr-1" /> <EditableContent contentKey="portfolio-manager-gem" fallback="Gem" /></button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="relative">
                                  {renderMedia(bundleImage)}
                                  <div className="absolute top-2 right-2 flex space-x-1">
                                    <button onClick={() => setEditingImage(bundleImage)} className="p-1 bg-neutral-800/80 text-white rounded hover:bg-neutral-700">
                                      <Edit size={14} />
                                    </button>
                                    <button onClick={() => handleRemoveFromBundle(bundleImage.id)} className="p-1 bg-neutral-800/80 text-white rounded hover:bg-warning" title="Fjern fra bundle">
                                      <X size={14} />
                                    </button>
                                    <button onClick={() => handleDeleteImage(bundleImage.id)} className="p-1 bg-neutral-800/80 text-white rounded hover:bg-error">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div className="p-3">
                                  <h5 className="font-medium text-sm mb-1">{bundleImage.title}</h5>
                                  {bundleImage.image_name && (
                                    <p className="text-xs text-neutral-400 mb-2">{bundleImage.image_name}</p>
                                  )}
                                  <div className="flex items-center space-x-3 text-xs">
                                    <span className="flex items-center space-x-1 text-success"><ThumbsUp size={14} /><span>{bundleImage.likes}</span></span>
                                    <span className="flex items-center space-x-1 text-error"><ThumbsDown size={14} /><span>{bundleImage.dislikes}</span></span>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </React.Fragment>
                );
              }

              // ── Individual image ─────────────────────────────────────────
              return (
                <div key={image.id} className="bg-neutral-700/20 rounded-lg overflow-hidden">
                  {editingImage?.id === image.id ? (
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="form-label">Titel</label>
                        <input
                          type="text"
                          value={editingImage.title}
                          onChange={(e) => setEditingImage({ ...editingImage, title: e.target.value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label"><EditableContent contentKey="portfolio-manager-billede-2" fallback="Billede" /></label>
                        <ImageUpload
                          onImageUploaded={(url) => setEditingImage({ ...editingImage, image_url: url })}
                          currentImageUrl={editingImage.image_url}
                          bucket="portfolio"
                        />
                      </div>
                      <div className="flex justify-end space-x-3">
                        <button onClick={() => setEditingImage(null)} className="btn-secondary flex items-center">
                          <X size={16} className="mr-2" /> Annuller
                        </button>
                        <button onClick={handleUpdateImage} className="btn-primary flex items-center">
                          <Save size={16} className="mr-2" /> Gem
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        {renderMedia(image)}
                        <div className="absolute top-2 right-2 flex space-x-1">
                          <button onClick={() => setEditingImage(image)} className="p-1 bg-neutral-800/80 text-white rounded hover:bg-neutral-700 transition-colors">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleDeleteImage(image.id)} className="p-1 bg-neutral-800/80 text-white rounded hover:bg-error transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-medium mb-3">{image.title}</h3>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="flex items-center space-x-1 text-success"><ThumbsUp size={16} /><span>{image.likes}</span></span>
                            <span className="flex items-center space-x-1 text-error"><ThumbsDown size={16} /><span>{image.dislikes}</span></span>
                          </div>
                          <span className="text-neutral-400">
                            {new Date(image.created_at).toLocaleDateString('da-DK')}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>

      {portfolioImages.length === 0 && (
        <div className="text-center py-12 text-neutral-400">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p><EditableContent contentKey="portfolio-manager-ingen-portfolio-billeder-fundet-tilfoej" fallback="Ingen portfolio billeder fundet. Tilføj det første billede for at komme i gang." /></p>
        </div>
      )}
    </div>
  );
};

export default PortfolioManager;