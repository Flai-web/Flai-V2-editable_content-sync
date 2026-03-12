import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { compressImage } from '../../utils/imageCompression';
import toast from 'react-hot-toast';
import EditableContent from '../EditableContent';

interface ExternalImage {
  id: string;
  url: string;
  filename: string;
  size: number;
  created_at: string;
}

const ExternalImagesManager: React.FC = () => {
  const [images, setImages] = useState<ExternalImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const { data, error } = await supabase
        .from('external_images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImages(data || []);
    } catch (err) {
      console.error('Error loading images:', err);
      toast.error('Kunne ikke indlæse billeder');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Kun billedfiler er tilladt');
      return;
    }

    setUploading(true);
    try {
      const compressedFile = await compressImage(file, {
        maxSizeKB: 1000,
        maxWidth: 2400,
        maxHeight: 2400,
        quality: 0.85,
        format: 'webp'
      });

      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('external-images')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('external-images')
        .getPublicUrl(uploadData.path);

      const { error: dbError } = await supabase
        .from('external_images')
        .insert([{
          url: publicUrl,
          filename: file.name,
          size: compressedFile.size,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (dbError) throw dbError;

      toast.success('Billede uploadet');
      await loadImages();
      event.target.value = '';
    } catch (err) {
      console.error('Error uploading image:', err);
      toast.error('Kunne ikke uploade billede');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (image: ExternalImage) => {
    if (!confirm('Er du sikker på at du vil slette dette billede?')) return;

    try {
      const pathParts = image.url.split('/');
      const fileName = pathParts[pathParts.length - 1];

      const { error: storageError } = await supabase.storage
        .from('external-images')
        .remove([fileName]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('external_images')
        .delete()
        .eq('id', image.id);

      if (dbError) throw dbError;

      toast.success('Billede slettet');
      await loadImages();
    } catch (err) {
      console.error('Error deleting image:', err);
      toast.error('Kunne ikke slette billede');
    }
  };

  const handleCopyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success('URL kopieret til udklipsholder');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      toast.error('Kunne ikke kopiere URL');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold"><EditableContent contentKey="external-images-manager-eksterne-billeder" fallback="Eksterne Billeder" /></h2>
        <label className="btn-primary flex items-center cursor-pointer">
          <Upload size={20} className="mr-2" />
          {uploading ? 'Uploader...' : 'Upload Billede'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      <div className="bg-neutral-700/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-neutral-400 text-sm"><EditableContent contentKey="external-images-manager-total-billeder" fallback="Total Billeder" /></p>
            <p className="text-xl font-bold">{images.length}</p>
          </div>
          <ImageIcon className="text-primary" size={20} />
        </div>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p><EditableContent contentKey="external-images-manager-ingen-eksterne-billeder-fundet-upload" fallback="Ingen eksterne billeder fundet. Upload det første billede for at komme i gang." /></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((image) => (
            <div key={image.id} className="bg-neutral-700/20 rounded-lg overflow-hidden">
              <div className="relative aspect-video">
                <img
                  src={image.url}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <p className="font-medium truncate" title={image.filename}>
                    {image.filename}
                  </p>
                  <p className="text-sm text-neutral-400">
                    {formatFileSize(image.size)} • {new Date(image.created_at).toLocaleDateString('da-DK')}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCopyUrl(image.url, image.id)}
                    className="flex-1 btn-secondary flex items-center justify-center text-sm"
                  >
                    {copiedId === image.id ? (
                      <>
                        <Check size={16} className="mr-2" />
                        <EditableContent contentKey="external-images-manager-kopieret" fallback="Kopieret" /></>
                    ) : (
                      <>
                        <Copy size={16} className="mr-2" />
                        <EditableContent contentKey="external-images-manager-kopier-url" fallback="Kopier URL" /></>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(image)}
                    className="btn-secondary p-2 hover:bg-error transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExternalImagesManager;
