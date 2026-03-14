import React, { useState, useMemo, useRef } from 'react';
import { Plus, Edit, Trash2, Save, X, Package, Camera, Video, ArrowUpDown, GripVertical } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { Product } from '../../types';
import ImageUpload from '../ImageUpload';
import EditableContent from '../EditableContent';
import toast from 'react-hot-toast';

// ─── Reorderable image grid ───────────────────────────────────────────────────
interface ReorderableImagesProps {
  images: string[];
  onChange: (images: string[]) => void;
  onRemove: (index: number) => void;
}

const ReorderableImages: React.FC<ReorderableImagesProps> = ({ images, onChange, onRemove }) => {
  const dragIndex = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    dragIndex.current = idx;
    setDraggingIdx(idx);
  };

  const handleDragEnter = (idx: number) => {
    if (dragIndex.current === null || dragIndex.current === idx) return;
    setOverIdx(idx);
  };

  const handleDragEnd = () => {
    if (dragIndex.current !== null && overIdx !== null && dragIndex.current !== overIdx) {
      const next = [...images];
      const [moved] = next.splice(dragIndex.current, 1);
      next.splice(overIdx, 0, moved);
      onChange(next);
    }
    dragIndex.current = null;
    setDraggingIdx(null);
    setOverIdx(null);
  };

  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
      {images.map((image, index) => (
        <div
          key={`${image}-${index}`}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragEnter={() => handleDragEnter(index)}
          onDragOver={(e) => e.preventDefault()}
          onDragEnd={handleDragEnd}
          className="relative group cursor-grab active:cursor-grabbing select-none"
          style={{
            opacity: draggingIdx === index ? 0.4 : 1,
            transform: overIdx === index && draggingIdx !== index ? 'scale(1.03)' : 'scale(1)',
            transition: 'transform 0.15s ease, opacity 0.15s ease',
            outline: overIdx === index && draggingIdx !== index ? '2px solid #f97316' : 'none',
            borderRadius: '0.5rem',
          }}
        >
          {/* Cover badge */}
          {index === 0 && (
            <span className="absolute top-1 left-1 z-10 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
              Cover
            </span>
          )}

          {/* Drag handle overlay */}
          <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-black/50 rounded-full p-1">
              <GripVertical size={16} className="text-white" />
            </div>
          </div>

          <img
            src={image}
            alt={`Product ${index + 1}`}
            className="w-full h-24 object-cover rounded-lg pointer-events-none"
            draggable={false}
          />

          {/* Position number */}
          <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded pointer-events-none">
            {index + 1}
          </span>

          {/* Remove button */}
          <button
            onClick={() => onRemove(index)}
            className="absolute top-1 right-1 p-1 bg-error text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const ProductsManager: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sliderValues, setSliderValues] = useState<Record<number, number>>({});

  const arrayBounds = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 100 };
    const arrays = products.map(p => p.array || 0);
    return { min: Math.min(...arrays), max: Math.max(...arrays) };
  }, [products]);

  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'photo' as 'photo' | 'video',
    images: [] as string[],
    links: [] as { title: string; url: string }[],
    is_editing_included: false,
    array: arrayBounds.max,
  });

  React.useEffect(() => {
    setNewProduct(prev => ({ ...prev, array: arrayBounds.max }));
  }, [arrayBounds.max]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.description.trim() || newProduct.price <= 0) {
      toast.error('Udfyld alle påkrævede felter');
      return;
    }
    if (newProduct.images.length === 0) {
      toast.error('Tilføj mindst ét billede');
      return;
    }
    try {
      await addProduct(newProduct);
      setNewProduct({ name: '', description: '', price: 0, category: 'photo', images: [], links: [], is_editing_included: false, array: arrayBounds.max });
      setShowAddForm(false);
      toast.success('Produkt tilføjet');
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    if (!editingProduct.name.trim() || !editingProduct.description.trim() || editingProduct.price <= 0) {
      toast.error('Udfyld alle påkrævede felter');
      return;
    }
    try {
      await updateProduct(editingProduct.id, {
        name: editingProduct.name,
        description: editingProduct.description,
        price: editingProduct.price,
        category: editingProduct.category,
        images: editingProduct.images,
        links: editingProduct.links,
        is_editing_included: editingProduct.is_editing_included,
      });
      setEditingProduct(null);
      toast.success('Produkt opdateret');
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Er du sikker på at du vil slette dette produkt?')) return;
    try {
      await deleteProduct(id);
      toast.success('Produkt slettet');
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleArrayChange = async (productId: number, newArray: number) => {
    try {
      await updateProduct(productId, { array: newArray });
      toast.success('Rækkefølge opdateret');
    } catch (error) {
      console.error('Error updating array:', error);
      toast.error('Kunne ikke opdatere rækkefølge');
    }
  };

  const handleSliderChange = (productId: number, value: number) =>
    setSliderValues(prev => ({ ...prev, [productId]: value }));

  const handleSliderRelease = async (productId: number, value: number) => {
    await handleArrayChange(productId, value);
    setSliderValues(prev => { const n = { ...prev }; delete n[productId]; return n; });
  };

  // Image handlers — now images are just a string[] maintained in order
  const handleImageUpload = (url: string, isForEdit = false) => {
    if (isForEdit && editingProduct) {
      setEditingProduct({ ...editingProduct, images: [...editingProduct.images, url] });
    } else {
      setNewProduct({ ...newProduct, images: [...newProduct.images, url] });
    }
  };

  const removeImage = (index: number, isForEdit = false) => {
    if (isForEdit && editingProduct) {
      setEditingProduct({ ...editingProduct, images: editingProduct.images.filter((_, i) => i !== index) });
    } else {
      setNewProduct({ ...newProduct, images: newProduct.images.filter((_, i) => i !== index) });
    }
  };

  // Image reorder handlers
  const reorderNewImages = (images: string[]) => setNewProduct(p => ({ ...p, images }));
  const reorderEditImages = (images: string[]) => editingProduct && setEditingProduct(p => p ? { ...p, images } : p);

  const addLink = (isForEdit = false) => {
    const newLink = { title: '', url: '' };
    if (isForEdit && editingProduct) {
      if (editingProduct.links.length >= 4) { toast.error('Maksimalt 4 links per produkt'); return; }
      setEditingProduct({ ...editingProduct, links: [...editingProduct.links, newLink] });
    } else {
      if (newProduct.links.length >= 4) { toast.error('Maksimalt 4 links per produkt'); return; }
      setNewProduct({ ...newProduct, links: [...newProduct.links, newLink] });
    }
  };

  const updateLink = (index: number, field: 'title' | 'url', value: string, isForEdit = false) => {
    if (isForEdit && editingProduct) {
      const updatedLinks = [...editingProduct.links];
      updatedLinks[index] = { ...updatedLinks[index], [field]: value };
      setEditingProduct({ ...editingProduct, links: updatedLinks });
    } else {
      const updatedLinks = [...newProduct.links];
      updatedLinks[index] = { ...updatedLinks[index], [field]: value };
      setNewProduct({ ...newProduct, links: updatedLinks });
    }
  };

  const removeLink = (index: number, isForEdit = false) => {
    if (isForEdit && editingProduct) {
      setEditingProduct({ ...editingProduct, links: editingProduct.links.filter((_, i) => i !== index) });
    } else {
      setNewProduct({ ...newProduct, links: newProduct.links.filter((_, i) => i !== index) });
    }
  };

  // ── Slider style helper ────────────────────────────────────────────────────
  const sliderBg = (value: number) => {
    const pct = arrayBounds.max > 0 ? (value / arrayBounds.max) * 100 : 0;
    return `linear-gradient(to right, #f97316 0%, #f97316 ${pct}%, #404040 ${pct}%, #404040 100%)`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <EditableContent contentKey="admin-products-title" as="h2" className="text-2xl font-bold" fallback="Produkt Administration" />
        <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center">
          <Plus size={20} className="mr-2" />
          <EditableContent contentKey="admin-products-add-button" fallback="Tilføj Produkt" />
        </button>
      </div>

      {/* ── Add Product Form ───────────────────────────────────────────────── */}
      {showAddForm && (
        <div className="bg-neutral-700/20 rounded-lg p-6">
          <EditableContent contentKey="admin-products-add-form-title" as="h3" className="text-xl font-semibold mb-4" fallback="Tilføj Nyt Produkt" />
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <EditableContent contentKey="admin-products-name-label" as="label" className="form-label" fallback="Produktnavn" />
                <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="form-input" placeholder="Indtast produktnavn" />
              </div>
              <div>
                <EditableContent contentKey="admin-products-price-label" as="label" className="form-label" fallback="Pris (DKK)" />
                <input type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: parseInt(e.target.value) || 0 })} className="form-input" placeholder="0" />
              </div>
            </div>

            <div>
              <EditableContent contentKey="admin-products-category-label" as="label" className="form-label" fallback="Kategori" />
              <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value as 'photo' | 'video' })} className="form-input">
                <option value="photo">Foto</option>
                <option value="video">Video</option>
              </select>
            </div>

            <div className="flex items-center space-x-3">
              <input type="checkbox" id="editing-included" checked={newProduct.is_editing_included} onChange={(e) => setNewProduct({ ...newProduct, is_editing_included: e.target.checked })} className="form-checkbox" />
              <div>
                <EditableContent contentKey="admin-products-editing-included-label" as="label" htmlFor="editing-included" className="form-label cursor-pointer" fallback="Redigering inkluderet" />
                <EditableContent contentKey="admin-products-editing-included-description" as="p" className="text-sm text-neutral-400" fallback="Dette produkt inkluderer professionel redigering som standard" />
              </div>
            </div>

            <div>
              <EditableContent contentKey="admin-products-description-label" as="label" className="form-label" fallback="Beskrivelse" />
              <textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} className="form-input resize-none" rows={4} placeholder="Indtast produktbeskrivelse" />
            </div>

            {/* Array Order Control */}
            <div className="bg-neutral-800/30 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <ArrowUpDown size={16} className="text-neutral-400 mr-2" />
                <EditableContent contentKey="admin-products-order-label" as="span" className="text-sm font-medium text-neutral-400" fallback="Rækkefølge" />
              </div>
              <div className="mb-4">
                <input type="number" value={newProduct.array} onChange={(e) => setNewProduct({ ...newProduct, array: parseInt(e.target.value) || 0 })} className="form-input text-sm" placeholder="Rækkefølge værdi" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>0</span>
                  <span className="font-medium text-neutral-300">
                    <EditableContent contentKey="products-manager-vaerdi" fallback="Værdi:" />{newProduct.array}
                  </span>
                  <span><EditableContent contentKey="products-manager-hoejest" fallback="Højest (" />{arrayBounds.max})</span>
                </div>
                <div className="relative">
                  <input type="range" min={0} max={arrayBounds.max} value={newProduct.array} onChange={(e) => setNewProduct({ ...newProduct, array: parseInt(e.target.value) })} className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb" style={{ background: sliderBg(newProduct.array), transition: 'background 0.1s ease' }} />
                  {arrayBounds.min > 0 && arrayBounds.max > 0 && (
                    <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none" style={{ left: `calc(${(arrayBounds.min / arrayBounds.max) * 100}% - 4px)` }}>
                      <div className="w-2 h-2 bg-yellow-400 rounded-full border border-neutral-800" title={`Laveste: ${arrayBounds.min}`} />
                    </div>
                  )}
                </div>
                {arrayBounds.min > 0 && <p className="text-xs text-yellow-400/70">● Gul markør = laveste eksisterende ({arrayBounds.min})</p>}
              </div>
            </div>

            {/* Images with reorder */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <EditableContent contentKey="admin-products-images-label" as="label" className="form-label" fallback="Billeder" />
                {newProduct.images.length > 1 && (
                  <span className="text-xs text-neutral-400 flex items-center gap-1">
                    <GripVertical size={12} /> Træk for at ændre rækkefølge · første = cover
                  </span>
                )}
              </div>
              <ImageUpload onImageUploaded={(url) => handleImageUpload(url)} bucket="product-images" />
              <ReorderableImages
                images={newProduct.images}
                onChange={reorderNewImages}
                onRemove={(i) => removeImage(i)}
              />
            </div>

            {/* Links */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <EditableContent contentKey="admin-products-links-label" as="label" className="form-label" fallback="Links (valgfrit)" />
                <button onClick={() => addLink()} className="text-sm text-primary hover:text-primary-dark" disabled={newProduct.links.length >= 4}>
                  <EditableContent contentKey="products-manager-tilfoej-link" fallback="+ Tilføj Link" />
                </button>
              </div>
              {newProduct.links.map((link, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input type="text" value={link.title} onChange={(e) => updateLink(index, 'title', e.target.value)} placeholder="Link titel" className="form-input flex-1" />
                  <input type="url" value={link.url} onChange={(e) => updateLink(index, 'url', e.target.value)} placeholder="https://..." className="form-input flex-1" />
                  <button onClick={() => removeLink(index)} className="p-2 text-error hover:bg-error/10 rounded"><X size={16} /></button>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3">
              <button onClick={() => { setShowAddForm(false); setNewProduct({ name: '', description: '', price: 0, category: 'photo', images: [], links: [], is_editing_included: false, array: arrayBounds.max }); }} className="btn-secondary">
                <EditableContent contentKey="admin-products-cancel-button" fallback="Annuller" />
              </button>
              <button onClick={handleAddProduct} className="btn-primary">
                <EditableContent contentKey="admin-products-save-button" fallback="Gem Produkt" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Products List ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-neutral-700/20 rounded-lg p-6">
            {editingProduct?.id === product.id ? (
              // ── Edit Form ────────────────────────────────────────────────
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <EditableContent contentKey="admin-products-edit-name-label" as="label" className="form-label" fallback="Produktnavn" />
                    <input type="text" value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} className="form-input" />
                  </div>
                  <div>
                    <EditableContent contentKey="admin-products-edit-price-label" as="label" className="form-label" fallback="Pris (DKK)" />
                    <input type="number" value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: parseInt(e.target.value) || 0 })} className="form-input" />
                  </div>
                </div>

                <div>
                  <EditableContent contentKey="admin-products-edit-category-label" as="label" className="form-label" fallback="Kategori" />
                  <select value={editingProduct.category} onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value as 'photo' | 'video' })} className="form-input">
                    <option value="photo">Foto</option>
                    <option value="video">Video</option>
                  </select>
                </div>

                <div className="flex items-center space-x-3">
                  <input type="checkbox" id="editing-included-edit" checked={editingProduct.is_editing_included} onChange={(e) => setEditingProduct({ ...editingProduct, is_editing_included: e.target.checked })} className="form-checkbox" />
                  <div>
                    <EditableContent contentKey="admin-products-edit-editing-included-label" as="label" htmlFor="editing-included-edit" className="form-label cursor-pointer" fallback="Redigering inkluderet" />
                    <EditableContent contentKey="admin-products-edit-editing-included-description" as="p" className="text-sm text-neutral-400" fallback="Dette produkt inkluderer professionel redigering som standard" />
                  </div>
                </div>

                <div>
                  <EditableContent contentKey="admin-products-edit-description-label" as="label" className="form-label" fallback="Beskrivelse" />
                  <textarea value={editingProduct.description} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} className="form-input resize-none" rows={4} />
                </div>

                {/* Images with reorder */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <EditableContent contentKey="admin-products-edit-images-label" as="label" className="form-label" fallback="Billeder" />
                    {editingProduct.images.length > 1 && (
                      <span className="text-xs text-neutral-400 flex items-center gap-1">
                        <GripVertical size={12} /> Træk for at ændre rækkefølge · første = cover
                      </span>
                    )}
                  </div>
                  <ImageUpload onImageUploaded={(url) => handleImageUpload(url, true)} bucket="product-images" />
                  <ReorderableImages
                    images={editingProduct.images}
                    onChange={reorderEditImages}
                    onRemove={(i) => removeImage(i, true)}
                  />
                </div>

                {/* Links */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <EditableContent contentKey="admin-products-edit-links-label" as="label" className="form-label" fallback="Links" />
                    <button onClick={() => addLink(true)} className="text-sm text-primary hover:text-primary-dark" disabled={editingProduct.links.length >= 4}>+ Tilføj Link</button>
                  </div>
                  {editingProduct.links.map((link, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input type="text" value={link.title} onChange={(e) => updateLink(index, 'title', e.target.value, true)} placeholder="Link titel" className="form-input flex-1" />
                      <input type="url" value={link.url} onChange={(e) => updateLink(index, 'url', e.target.value, true)} placeholder="https://..." className="form-input flex-1" />
                      <button onClick={() => removeLink(index, true)} className="p-2 text-error hover:bg-error/10 rounded"><X size={16} /></button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end space-x-3">
                  <button onClick={() => setEditingProduct(null)} className="btn-secondary flex items-center">
                    <X size={16} className="mr-2" />
                    <EditableContent contentKey="admin-products-edit-cancel-button" fallback="Annuller" />
                  </button>
                  <button onClick={handleUpdateProduct} className="btn-primary flex items-center">
                    <Save size={16} className="mr-2" />
                    <EditableContent contentKey="admin-products-edit-save-button" fallback="Gem" />
                  </button>
                </div>
              </div>
            ) : (
              // ── Display Mode ─────────────────────────────────────────────
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${product.category === 'video' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                      {product.category === 'video' ? <Video size={20} /> : <Camera size={20} />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{product.name}</h3>
                      <p className="text-primary font-bold">{product.price} <EditableContent contentKey="products-manager-kr" fallback="kr" /></p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => setEditingProduct(product)} className="p-2 text-neutral-400 hover:text-white transition-colors"><Edit size={16} /></button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-neutral-400 hover:text-error transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>

                <p className="text-neutral-300 mb-4">{product.description}</p>

                {product.is_editing_included && (
                  <div className="flex items-center text-green-400 mb-4">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <EditableContent contentKey="admin-products-editing-included-display" as="span" className="text-sm font-medium" fallback="Redigering inkluderet" />
                  </div>
                )}

                {/* Array Order */}
                <div className="bg-neutral-800/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center mb-3">
                    <ArrowUpDown size={16} className="text-neutral-400 mr-2" />
                    <EditableContent contentKey="admin-products-order-label" as="span" className="text-sm font-medium text-neutral-400" fallback="Rækkefølge" />
                  </div>
                  <div className="mb-4">
                    <input type="number" value={product.array || 0} onChange={(e) => handleArrayChange(product.id, parseInt(e.target.value) || 0)} className="form-input text-sm" placeholder="Rækkefølge værdi" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <span>0</span>
                      <span className="font-medium text-neutral-300">Værdi: {sliderValues[product.id] ?? product.array ?? 0}</span>
                      <span>Højest ({arrayBounds.max})</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={0}
                        max={arrayBounds.max}
                        value={sliderValues[product.id] ?? product.array ?? 0}
                        onChange={(e) => handleSliderChange(product.id, parseInt(e.target.value))}
                        onMouseUp={(e) => handleSliderRelease(product.id, parseInt((e.target as HTMLInputElement).value))}
                        onTouchEnd={(e) => handleSliderRelease(product.id, parseInt((e.target as HTMLInputElement).value))}
                        className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                        style={{ background: sliderBg(sliderValues[product.id] ?? product.array ?? 0), transition: 'background 0.1s ease' }}
                      />
                      {arrayBounds.min > 0 && arrayBounds.max > 0 && (
                        <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none" style={{ left: `calc(${(arrayBounds.min / arrayBounds.max) * 100}% - 4px)` }}>
                          <div className="w-2 h-2 bg-yellow-400 rounded-full border border-neutral-800" title={`Laveste: ${arrayBounds.min}`} />
                        </div>
                      )}
                    </div>
                    {arrayBounds.min > 0 && <p className="text-xs text-yellow-400/70">● Gul markør = laveste eksisterende ({arrayBounds.min})</p>}
                  </div>
                </div>

                {/* Image preview — first image gets cover badge */}
                {product.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {product.images.slice(0, 3).map((image, index) => (
                      <div key={index} className="relative">
                        {index === 0 && (
                          <span className="absolute top-1 left-1 z-10 bg-primary text-white text-[10px] font-bold px-1 py-0.5 rounded">Cover</span>
                        )}
                        <img src={image} alt={`${product.name} ${index + 1}`} className="w-full h-16 object-cover rounded" />
                      </div>
                    ))}
                  </div>
                )}

                {product.links && product.links.length > 0 && (
                  <div className="space-y-1">
                    <EditableContent contentKey="admin-products-links-display-label" as="p" className="text-sm font-medium text-neutral-400" fallback="Links:" />
                    {product.links.map((link, index) => (
                      <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:text-primary-dark">{link.title}</a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12 text-neutral-400">
          <Package size={48} className="mx-auto mb-4 opacity-50" />
          <EditableContent contentKey="admin-products-no-products" as="p" fallback="Ingen produkter fundet. Tilføj det første produkt for at komme i gang." />
        </div>
      )}

      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .slider-thumb::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

export default ProductsManager;
