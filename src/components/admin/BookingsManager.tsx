import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  DollarSign, 
  CheckCircle, 
  XCircle,
  Edit,
  Search,
  Filter,
  Download,
  Loader,
  Info,
  Trash2,
  Upload,
  Link as LinkIcon,
  Cloud,
  Mail,
  Plus,
  ExternalLink,
  Archive,
  ArchiveRestore,
  Zap,
  Edit3
} from 'lucide-react';
import { useBookings } from '../../hooks/useBookings';
import { supabase } from '../../utils/supabase';
import EditableContent from '../EditableContent';
import FileUpload from '../FileUpload';
import { formatDate, formatTime } from '../../utils/booking';
import { uploadToGofile, extractGofileId } from '../../utils/gofile-utils';
import toast from 'react-hot-toast';

const BookingsManager: React.FC = () => {
  console.log('BookingsManager: Component rendering...');
  
  const { bookings, updateBooking, markBookingComplete, deleteBooking, loading, error } = useBookings();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'completed' | 'not_completed' | 'smart'>('all');
  const [editingBooking, setEditingBooking] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  
  // Smart Booking States
  const [completingSmartBooking, setCompletingSmartBooking] = useState<number | null>(null);
  const [smartBookingData, setSmartBookingData] = useState({
    booking_date: '',
    booking_time: '',
  });
  
  // New state to toggle the extra information view
  const [viewingInfoId, setViewingInfoId] = useState<number | null>(null);

  // Delete confirmation modal state
  const [deletingBookingId, setDeletingBookingId] = useState<number | null>(null);

  // Create booking modal state
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Updated zip input type
  const [zipInputType, setZipInputType] = useState<'gofile' | 'upload' | 'link'>('gofile');
  
  // Gofile upload state
  const [gofileUploading, setGofileUploading] = useState(false);
  const [gofileProgress, setGofileProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // Email control state
  const [sendCompletionEmail, setSendCompletionEmail] = useState(true);
  
  const [editingData, setEditingData] = useState<{
    payment_status: string;
    payment_method: string;
    zip_file_url: string;
    share_project_url: string;
    booking_date: string;
    booking_time: string;
    include_editing: boolean;
    is_completed: boolean;
    price: number;
    product_id: number;
  }>({
    payment_status: '',
    payment_method: '',
    zip_file_url: '',
    share_project_url: '',
    booking_date: '',
    booking_time: '',
    include_editing: false,
    is_completed: false,
    price: 0,
    product_id: 0
  });

  // Create booking form state
  const [newBookingData, setNewBookingData] = useState({
    guest_email: '',
    user_id: '',
    customer_name: '',
    booking_date: '',
    booking_time: '',
    address: '',
    product_id: '',
    price: 0,
    payment_status: 'pending',
    payment_method: 'card',
    include_editing: false,
    send_confirmation_email: true,
    zip_file_url: '',
    share_project_url: ''
  });

  // Products list for dropdown
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  console.log('BookingsManager: Current state - bookings:', bookings.length, 'loading:', loading, 'error:', error);

  // Function to check if email belongs to a user
  const checkUserByEmail = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (error || !data) {
        console.log('No user found with this email in profiles');
        
        const { data: bookingData } = await supabase
          .from('bookings')
          .select('user_id')
          .eq('user_email', email)
          .not('user_id', 'is', null)
          .limit(1)
          .single();
        
        if (bookingData?.user_id) {
          console.log('Found user_id from previous bookings');
          return bookingData.user_id;
        }
        
        return null;
      }

      return data?.id;
    } catch (error) {
      console.error('Error checking user email:', error);
      return null;
    }
  };

  // Function to fetch all products
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, is_editing_included')
        .order('name');

      if (error) throw error;
      
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Kunne ikke hente produkter');
    } finally {
      setLoadingProducts(false);
    }
  };

  const getProductName = (productId: number) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : `Produkt ID: ${productId}`;
  };

  const handleGofileUpload = async (file: File) => {
    setGofileUploading(true);
    setGofileProgress(0);
    setUploadStatus('');

    try {
      const fileSize = file.size;
      const fileSizeGB = (fileSize / (1024 * 1024 * 1024)).toFixed(2);
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      
      console.log('BookingsManager: File size:', fileSizeMB, 'MB');
      
      const booking = bookings.find(b => b.id === editingBooking);
      if (!booking) {
        toast.error('Kunne ikke finde booking');
        return;
      }
      
      const sizeStr = fileSize > 1024 * 1024 * 1024 ? `${fileSizeGB}GB` : `${fileSizeMB}MB`;
      toast.loading(`Uploader ${sizeStr} til Gofile...`, { id: 'upload-toast' });
      
      setUploadStatus(`Uploader ${sizeStr}...`);
      
      const result = await uploadToGofile(file, (progress) => {
        setGofileProgress(progress);
        setUploadStatus(`Uploader ${sizeStr}... ${progress}%`);
      });
      
      console.log('BookingsManager: Upload result:', result);
      
      if (!result.success || !result.fileId) {
        throw new Error('Upload fejlede - ingen file ID returneret');
      }
      
      let shortFileId = result.fileId;
      
      if (result.downloadPage) {
        const match = result.downloadPage.match(/\/d\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
          shortFileId = match[1];
        }
      }
      
      const customDownloadUrl = `${window.location.origin}/file/gofile/${shortFileId}`;
      
      toast.success(`Fil uploadet til Gofile! (${sizeStr})`, { id: 'upload-toast' });
      
      setEditingData(prev => ({ ...prev, zip_file_url: customDownloadUrl }));
      
      return customDownloadUrl;
    } catch (error) {
      console.error('BookingsManager: Gofile upload error:', error);
      toast.error(`Upload fejlede: ${error.message}`, { id: 'upload-toast' });
      throw error;
    } finally {
      setGofileUploading(false);
      setGofileProgress(0);
      setUploadStatus('');
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader size={48} className="mx-auto mb-4 animate-spin text-primary" />
            <EditableContent
              contentKey="admin-bookings-loading"
              as="p"
              className="text-neutral-400"
              fallback="Indlæser bookinger..."
            />
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-error/10 border border-error/20 rounded-lg p-6 text-center">
          <XCircle size={48} className="text-error mx-auto mb-4" />
          <EditableContent
            contentKey="admin-bookings-error-title"
            as="h3"
            className="text-xl font-semibold mb-2 text-error"
            fallback="Fejl ved indlæsning"
          />
          <p className="text-neutral-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Genindlæs siden
          </button>
        </div>
      </div>
    );
  }

  // Filter bookings
  const filteredBookings = bookings
    .filter(booking => {
      const matchesArchiveFilter = showArchived ? booking.is_archived : !booking.is_archived;
      
      const matchesSearch = 
        booking.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'smart' && booking.mode === 'smart') ||
        (statusFilter === 'pending' && booking.payment_status === 'pending' && booking.mode !== 'smart') ||
        (statusFilter === 'paid' && booking.payment_status === 'paid' && !booking.is_completed && booking.mode !== 'smart') ||
        (statusFilter === 'not_completed' && !booking.is_completed && booking.mode !== 'smart') ||
        (statusFilter === 'completed' && booking.is_completed && booking.mode !== 'smart');

      return matchesArchiveFilter && matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return b.id - a.id;
    });

  console.log('BookingsManager: Filtered bookings:', filteredBookings.length);

  const handleStatusUpdate = async (bookingId: number, newStatus: string) => {
    try {
      await updateBooking(bookingId, { payment_status: newStatus });
      toast.success('Booking status opdateret');
    } catch (error) {
      console.error('BookingsManager: Error updating booking status:', error);
      toast.error('Kunne ikke opdatere booking status');
    }
  };

  const handleCompleteBooking = async (bookingId: number) => {
    try {
      const booking = bookings.find(b => b.id === bookingId);
      
      if (!booking) {
        toast.error('Booking ikke fundet');
        return;
      }

      await markBookingComplete(bookingId);
      
      if (booking.payment_status !== 'paid') {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/queue-invoice`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ bookingId: bookingId })
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const result = await response.json();

          if (result.error) {
            toast.error('Booking gennemført, men faktura kunne ikke køsættes');
          } else {
            toast.success('Booking gennemført! Faktura sendes til kunden.');
          }
        } catch (invoiceError) {
          console.error('BookingsManager: Error queueing invoice:', invoiceError);
          toast.error('Booking gennemført, men faktura kunne ikke køsættes');
        }
      } else {
        toast.success('Booking markeret som gennemført');
      }
    } catch (error) {
      console.error('BookingsManager: Error completing booking:', error);
      toast.error('Kunne ikke gennemføre booking');
    }
  };

  const handleEditBooking = (booking: any) => {
    setEditingBooking(booking.id);
    
    const hasExistingZipFile = booking.zip_file_url;
    let detectedType: 'gofile' | 'upload' | 'link' = 'gofile';
    
    if (hasExistingZipFile) {
      if (booking.zip_file_url.includes('/file/gofile/')) {
        detectedType = 'gofile';
      } else if (booking.zip_file_url.includes('supabase')) {
        detectedType = 'upload';
      } else {
        detectedType = 'link';
      }
    }
    
    setZipInputType(detectedType);
    setSendCompletionEmail(true);
    setEditingData({
      payment_status: booking.payment_status,
      payment_method: booking.payment_method || '',
      zip_file_url: booking.zip_file_url || '',
      share_project_url: booking.share_project_url || '',
      booking_date: booking.booking_date || '',
      booking_time: booking.booking_time || '',
      include_editing: booking.include_editing || false,
      is_completed: booking.is_completed || false,
      price: booking.price || 0,
      product_id: booking.product_id || 0
    });
  };

  const handleToggleInfo = (bookingId: number) => {
    if (viewingInfoId === bookingId) {
      setViewingInfoId(null);
    } else {
      setViewingInfoId(bookingId);
    }
  };

  const handleEditingToggle = async (checked: boolean) => {
    try {
      const currentBooking = bookings.find(b => b.id === editingBooking);
      
      if (!currentBooking) {
        toast.error('Kunne ikke finde booking');
        return;
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('is_editing_included')
        .eq('id', editingData.product_id)
        .single();

      if (productError) {
        console.error('Error fetching product:', productError);
        toast.error('Kunne ikke hente produktinfo');
        return;
      }

      if (product.is_editing_included) {
        toast.info('Dette produkt inkluderer allerede redigering');
        setEditingData(prev => ({ ...prev, include_editing: checked }));
        return;
      }

      const EDITING_COST = 100;
      const originalPrice = currentBooking.original_price || 0;
      const discountAmount = currentBooking.discount_amount || 0;
      const creditsUsed = currentBooking.credits_used || 0;
      
      let calculatedPrice = originalPrice;
      if (checked) calculatedPrice += EDITING_COST;
      calculatedPrice -= discountAmount;
      calculatedPrice -= creditsUsed;
      calculatedPrice = Math.max(0, calculatedPrice);

      setEditingData(prev => ({
        ...prev,
        include_editing: checked,
        price: calculatedPrice
      }));
    } catch (error) {
      console.error('Error in handleEditingToggle:', error);
      toast.error('Kunne ikke opdatere pris');
    }
  };

  const sendBookingCompletionEmail = async (booking: any) => {
    try {
      const emailPayload = {
        bookingId: booking.id,
        userEmail: booking.user_email,
        productName: booking.product_name,
        bookingDate: booking.booking_date,
        bookingTime: booking.booking_time,
        zipFileUrl: editingData.zip_file_url || booking.zip_file_url,
      };

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-completion-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Email sendt til kunden!');
      } else {
        throw new Error(result.error || 'Unknown error from email service');
      }
    } catch (error) {
      console.error('BookingsManager: Error sending booking completion email:', error);
      toast.error(`Kunne ikke sende email: ${error.message}`);
    }
  };

  const handleSendCompletionEmailManually = async (booking: any) => {
    try {
      await sendBookingCompletionEmail(booking);
    } catch (error) {
      console.error('Error sending completion email manually:', error);
    }
  };

  const handleSendConfirmationEmail = async (booking: any) => {
    try {
      const recipientEmail = booking.user_email || booking.guest_email;
      
      if (!recipientEmail) {
        throw new Error('Ingen email adresse fundet for denne booking');
      }

      let fullBooking = booking;
      
      if (!booking.product_name && booking.id) {
        const { data: fetchedBooking, error: fetchError } = await supabase
          .from('bookings_with_users')
          .select('*')
          .eq('id', booking.id)
          .single();
        
        if (!fetchError) {
          fullBooking = fetchedBooking;
        }
      }
      
      const emailPayload = {
        bookingId: fullBooking.id,
        email: recipientEmail,
        productName: fullBooking.product_name || 'Drone Service',
        bookingDate: fullBooking.booking_date,
        bookingTime: fullBooking.booking_time,
        address: fullBooking.address,
        totalPrice: fullBooking.price,
        paymentMethod: fullBooking.payment_method || 'card',
        includeEditing: fullBooking.include_editing || false,
        discountAmount: fullBooking.discount_amount || 0
      };

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-confirmation-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast.success('Bekræftelses email sendt!');
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      toast.error(`Kunne ikke sende bekræftelses email: ${error.message}`);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingBooking) return;

    try {
      const booking = bookings.find(b => b.id === editingBooking);
      const hadZipFile = booking?.zip_file_url;
      const hasNewZipFile = editingData.zip_file_url && editingData.zip_file_url !== hadZipFile;

      await updateBooking(editingBooking, editingData);
      
      if (hasNewZipFile && sendCompletionEmail && booking) {
        await sendBookingCompletionEmail(booking);
      }

      setEditingBooking(null);
      setEditingData({ 
        payment_status: '', 
        payment_method: '', 
        zip_file_url: '',
        share_project_url: '',
        booking_date: '',
        booking_time: '',
        include_editing: false,
        is_completed: false,
        price: 0,
        product_id: 0
      });
      setSendCompletionEmail(true);
      toast.success('Booking opdateret');
    } catch (error) {
      console.error('BookingsManager: Error updating booking:', error);
      toast.error('Kunne ikke opdatere booking');
    }
  };

  const handleCancelEdit = () => {
    setEditingBooking(null);
    setEditingData({ 
      payment_status: '', 
      payment_method: '', 
      zip_file_url: '',
      share_project_url: '',
      booking_date: '',
      booking_time: '',
      include_editing: false,
      is_completed: false,
      price: 0,
      product_id: 0
    });
    setSendCompletionEmail(true);
  };

  const handleFileUploaded = (url: string) => {
    setEditingData(prev => ({ ...prev, zip_file_url: url }));
  };

  const handleZipLinkChange = (url: string) => {
    setEditingData(prev => ({ ...prev, zip_file_url: url }));
  };

  const handleZipInputTypeChange = (type: 'gofile' | 'upload' | 'link') => {
    setZipInputType(type);
    setEditingData(prev => ({ ...prev, zip_file_url: '' }));
  };

  const handleDeleteClick = (bookingId: number) => {
    setDeletingBookingId(bookingId);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBookingId) return;

    try {
      await deleteBooking(deletingBookingId);
      toast.success('Booking slettet succesfuldt');
      setDeletingBookingId(null);
    } catch (error) {
      console.error('BookingsManager: Error deleting booking:', error);
      toast.error('Kunne ikke slette booking');
    }
  };

  const handleDeleteCancel = () => {
    setDeletingBookingId(null);
  };

  const handleArchiveBooking = async (bookingId: number, currentArchiveStatus: boolean) => {
    try {
      const newArchiveStatus = !currentArchiveStatus;
      await updateBooking(bookingId, { is_archived: newArchiveStatus });
      toast.success(newArchiveStatus ? 'Booking arkiveret' : 'Booking genoprettet');
    } catch (error) {
      console.error('BookingsManager: Error archiving booking:', error);
      toast.error('Kunne ikke arkivere booking');
    }
  };

  const handleCreateBooking = async () => {
    try {
      if (!newBookingData.guest_email) {
        toast.error('Email er påkrævet');
        return;
      }

      if (!newBookingData.customer_name || !newBookingData.booking_date || 
          !newBookingData.booking_time || !newBookingData.product_id) {
        toast.error('Udfyld alle påkrævede felter');
        return;
      }

      let userId = newBookingData.user_id;
      const email = newBookingData.guest_email;
      
      if (email) {
        const foundUserId = await checkUserByEmail(email);
        if (foundUserId) {
          userId = foundUserId;
        }
      }

      const bookingPayload = {
        user_id: userId || null,
        guest_email: userId ? null : email,
        customer_name: newBookingData.customer_name,
        booking_date: newBookingData.booking_date,
        booking_time: newBookingData.booking_time,
        address: newBookingData.address,
        product_id: parseInt(newBookingData.product_id),
        price: newBookingData.price,
        original_price: newBookingData.price,
        payment_status: newBookingData.payment_status,
        payment_method: newBookingData.payment_method,
        include_editing: newBookingData.include_editing,
        zip_file_url: newBookingData.zip_file_url,
        share_project_url: newBookingData.share_project_url,
        is_completed: false
      };

      const { data, error } = await supabase
        .from('bookings')
        .insert([bookingPayload])
        .select()
        .single();

      if (error) throw error;

      if (newBookingData.send_confirmation_email) {
        const bookingWithEmail = {
          ...data,
          guest_email: email,
          user_email: userId ? email : null
        };
        await handleSendConfirmationEmail(bookingWithEmail);
      }

      toast.success('Booking oprettet succesfuldt!');
      setShowCreateModal(false);
      
      setNewBookingData({
        guest_email: '',
        user_id: '',
        customer_name: '',
        booking_date: '',
        booking_time: '',
        address: '',
        product_id: '',
        price: 0,
        payment_status: 'pending',
        payment_method: 'card',
        include_editing: false,
        send_confirmation_email: true,
        zip_file_url: '',
        share_project_url: ''
      });

      window.location.reload();
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error(`Kunne ikke oprette booking: ${error.message}`);
    }
  };

  const getStatusColor = (status: string, isCompleted: boolean) => {
    if (isCompleted) return 'text-success bg-success/10';
    switch (status) {
      case 'paid': return 'text-primary bg-primary/10';
      case 'pending': return 'text-warning bg-warning/10';
      case 'failed': return 'text-error bg-error/10';
      default: return 'text-neutral-400 bg-neutral-400/10';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Betalt';
      case 'pending': return 'Afventer';
      case 'failed': return 'Fejlet';
      case 'awaiting_payment': return 'Afventer betaling';
      default: return 'Ukendt';
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'card': return 'Kort';
      case 'invoice': return 'Faktura';
      case 'cash': return 'Kontant';
      default: return method;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <EditableContent
          contentKey="admin-bookings-title"
          as="h2"
          className="text-2xl font-bold"
          fallback="Booking"
        />
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Søg bookinger..."
              className="form-input pl-10 w-full md:w-64"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="form-input pl-10 w-full md:w-40"
            >
              <option value="all">Alle</option>
              <option value="pending">Afventende</option>
              <option value="paid">Betalt</option>
              <option value="not_completed">Ikke Gennemført</option>
              <option value="completed">Gennemført</option>
            </select>
          </div>

          {/* Smart Bookings Filter */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'smart' ? 'all' : 'smart')}
            className={`flex items-center justify-center px-4 py-2 rounded transition-colors ${
              statusFilter === 'smart' 
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' 
                : 'bg-neutral-600 text-white hover:bg-neutral-500'
            }`}
          >
            <Zap size={16} className="mr-2" />
            Smart Bookinger
          </button>

          {/* Archive Toggle Button */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center justify-center px-4 py-2 rounded transition-colors ${
              showArchived 
                ? 'bg-warning text-white hover:bg-warning/80' 
                : 'bg-neutral-600 text-white hover:bg-neutral-500'
            }`}
          >
            {showArchived ? (
              <>
                <ArchiveRestore size={16} className="mr-2" />
                Vis Aktive
              </>
            ) : (
              <>
                <Archive size={16} className="mr-2" />
                Vis Arkiverede
              </>
            )}
          </button>

          {/* Create Booking Button */}
          <button
            onClick={() => {
              setShowCreateModal(true);
              fetchProducts();
            }}
            className="flex items-center justify-center px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
          >
            <Plus size={16} className="mr-2" />
            Opret Booking
          </button>
        </div>
      </div>

      {/* Create Booking Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-neutral-800 rounded-lg p-6 max-w-2xl w-full my-8">
            <h3 className="text-xl font-bold mb-4">Opret Ny Booking</h3>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Email * (bruges til at finde bruger automatisk)
                  </label>
                  <input
                    type="email"
                    value={newBookingData.guest_email}
                    onChange={async (e) => {
                      const email = e.target.value;
                      setNewBookingData(prev => ({ ...prev, guest_email: email }));
                      
                      if (email.includes('@') && email.includes('.')) {
                        const userId = await checkUserByEmail(email);
                        if (userId) {
                          setNewBookingData(prev => ({ ...prev, user_id: userId }));
                          toast.success('Bruger fundet! ID udfyldt automatisk.');
                        } else {
                          setNewBookingData(prev => ({ ...prev, user_id: '' }));
                        }
                      }
                    }}
                    className="form-input"
                    placeholder="kunde@example.com"
                  />
                  <p className="text-xs text-neutral-400 mt-1">
                    System tjekker automatisk om email tilhører en registreret bruger
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Bruger ID (udfyldes automatisk)
                  </label>
                  <input
                    type="text"
                    value={newBookingData.user_id}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, user_id: e.target.value }))}
                    className="form-input bg-neutral-700"
                    placeholder="Udfyldes automatisk fra email"
                    readOnly
                  />
                  {newBookingData.user_id && (
                    <p className="text-xs text-success mt-1 flex items-center">
                      <CheckCircle size={12} className="mr-1" />
                      Registreret bruger fundet
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Kunde Navn *
                  </label>
                  <input
                    type="text"
                    value={newBookingData.customer_name}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, customer_name: e.target.value }))}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Adresse *
                  </label>
                  <input
                    type="text"
                    value={newBookingData.address}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, address: e.target.value }))}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Booking Dato *
                  </label>
                  <input
                    type="date"
                    value={newBookingData.booking_date}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, booking_date: e.target.value }))}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Booking Tidspunkt *
                  </label>
                  <input
                    type="time"
                    value={newBookingData.booking_time}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, booking_time: e.target.value }))}
                    className="form-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Produkt *
                  </label>
                  {loadingProducts ? (
                    <div className="flex items-center justify-center p-3 bg-neutral-700 rounded">
                      <Loader size={20} className="animate-spin text-primary mr-2" />
                      <span className="text-sm text-neutral-400">Indlæser produkter...</span>
                    </div>
                  ) : (
                    <select
                      value={newBookingData.product_id}
                      onChange={(e) => {
                        const productId = e.target.value;
                        if (productId) {
                          const selectedProduct = products.find(p => p.id === parseInt(productId));
                          if (selectedProduct) {
                            let calculatedPrice = selectedProduct.price;
                            if (newBookingData.include_editing && !selectedProduct.is_editing_included) {
                              calculatedPrice += 100;
                            }
                            setNewBookingData(prev => ({ 
                              ...prev, 
                              product_id: productId,
                              price: calculatedPrice
                            }));
                          }
                        } else {
                          setNewBookingData(prev => ({ ...prev, product_id: productId }));
                        }
                      }}
                      className="form-input"
                    >
                      <option value="">Vælg et produkt</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} - {product.price} kr
                          {product.is_editing_included ? ' (inkl. redigering)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {products.length === 0 && !loadingProducts && (
                    <p className="text-xs text-warning mt-1">Ingen produkter fundet</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Pris (kr) *
                  </label>
                  <input
                    type="number"
                    value={newBookingData.price}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="form-input"
                  />
                  <p className="text-xs text-neutral-400 mt-1">
                    Udfyldes automatisk når produkt vælges
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Betalingsstatus
                  </label>
                  <select
                    value={newBookingData.payment_status}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, payment_status: e.target.value }))}
                    className="form-input"
                  >
                    <option value="pending">Afventende</option>
                    <option value="paid">Betalt</option>
                    <option value="failed">Fejlet</option>
                    <option value="awaiting_payment">Afventer betaling</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Betalingsmetode
                  </label>
                  <select
                    value={newBookingData.payment_method}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="form-input"
                  >
                    <option value="card">Kort</option>
                    <option value="invoice">Faktura</option>
                    <option value="cash">Kontant</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Del Projekt URL
                  </label>
                  <input
                    type="url"
                    value={newBookingData.share_project_url}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, share_project_url: e.target.value }))}
                    className="form-input"
                    placeholder="https://..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Zip Fil URL
                  </label>
                  <input
                    type="url"
                    value={newBookingData.zip_file_url}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, zip_file_url: e.target.value }))}
                    className="form-input"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBookingData.include_editing}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      if (newBookingData.product_id) {
                        const selectedProduct = products.find(p => p.id === parseInt(newBookingData.product_id));
                        if (selectedProduct) {
                          let newPrice = selectedProduct.price;
                          if (!selectedProduct.is_editing_included && checked) {
                            newPrice += 100;
                          }
                          setNewBookingData(prev => ({ 
                            ...prev, 
                            include_editing: checked,
                            price: newPrice
                          }));
                        } else {
                          setNewBookingData(prev => ({ ...prev, include_editing: checked }));
                        }
                      } else {
                        setNewBookingData(prev => ({ ...prev, include_editing: checked }));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-neutral-300">Inkluder Redigering (+100 kr hvis ikke inkluderet)</span>
                </label>

                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBookingData.send_confirmation_email}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, send_confirmation_email: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-neutral-300">Send Bekræftelses Email</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewBookingData({
                    guest_email: '',
                    user_id: '',
                    customer_name: '',
                    booking_date: '',
                    booking_time: '',
                    address: '',
                    product_id: '',
                    price: 0,
                    payment_status: 'pending',
                    payment_method: 'card',
                    include_editing: false,
                    send_confirmation_email: true,
                    zip_file_url: '',
                    share_project_url: ''
                  });
                }}
                className="px-4 py-2 bg-neutral-600 text-white rounded hover:bg-neutral-500 transition-colors"
              >
                Annuller
              </button>
              <button
                onClick={handleCreateBooking}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
              >
                Opret Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-neutral-700/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <EditableContent
                contentKey="admin-bookings-total-label"
                as="p"
                className="text-neutral-400 text-sm"
                fallback="Total Bookinger"
              />
              <p className="text-xl font-bold">{bookings.filter(b => !b.is_archived).length}</p>
              {showArchived && (
                <p className="text-xs text-neutral-500 mt-1">
                  ({bookings.filter(b => b.is_archived).length} arkiverede)
                </p>
              )}
            </div>
            <Calendar className="text-primary" size={20} />
          </div>
        </div>

        <div className="bg-neutral-700/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <EditableContent
                contentKey="admin-bookings-pending-label"
                as="p"
                className="text-neutral-400 text-sm"
                fallback="Afventende"
              />
              <p className="text-xl font-bold text-warning">
                {bookings.filter(b => b.payment_status === 'pending' && !b.is_archived).length}
              </p>
            </div>
            <Clock className="text-warning" size={20} />
          </div>
        </div>

        <div className="bg-neutral-700/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <EditableContent
                contentKey="admin-bookings-paid-label"
                as="p"
                className="text-neutral-400 text-sm"
                fallback="Betalt"
              />
              <p className="text-xl font-bold text-primary">
                {bookings.filter(b => b.payment_status === 'paid' && !b.is_archived).length}
              </p>
            </div>
            <DollarSign className="text-primary" size={20} />
          </div>
        </div>

        <div className="bg-neutral-700/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <EditableContent
                contentKey="admin-bookings-completed-label"
                as="p"
                className="text-neutral-400 text-sm"
                fallback="Gennemført"
              />
              <p className="text-xl font-bold text-success">
                {bookings.filter(b => b.is_completed && !b.is_archived).length}
              </p>
            </div>
            <CheckCircle className="text-success" size={20} />
          </div>
        </div>

        <div className="bg-neutral-700/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-400 text-sm">Smart Bookinger</p>
              <p className="text-xl font-bold text-purple-400">
                {bookings.filter(b => b.mode === 'smart' && !b.is_archived).length}
              </p>
              <p className="text-xs text-neutral-500 mt-1">Afventer dato/tid</p>
            </div>
            <Zap className="text-purple-400" size={20} />
          </div>
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 text-neutral-400">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <EditableContent
              contentKey="admin-bookings-no-results"
              as="p"
              fallback="Ingen bookinger fundet med de valgte filtre."
            />
          </div>
        ) : (
          filteredBookings.map((booking) => (
            <div key={booking.id} className={`bg-neutral-700/20 rounded-lg p-4 md:p-6 transition-all ${
              booking.is_archived ? 'opacity-60 border-2 border-warning/30' : ''
            } ${
              booking.mode === 'smart' 
                ? 'border-2 border-purple-500/30 bg-gradient-to-br from-purple-900/10 to-blue-900/10 shadow-lg shadow-purple-500/10' 
                : 'border border-neutral-700'
            }`}>
              {booking.is_archived && (
                <div className="mb-3 flex items-center text-warning text-sm font-semibold">
                  <Archive size={16} className="mr-2" />
                  ARKIVERET
                </div>
              )}

              {/* Smart Booking Badge */}
              {booking.mode === 'smart' && (
                <div className="mb-4 flex items-center gap-3 flex-wrap">
                  <span className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold rounded-full flex items-center shadow-lg">
                    <Zap size={14} className="mr-2" />
                    SMART BOOKING
                  </span>
                  {!booking.booking_date && (
                    <span className="px-3 py-1 bg-warning/20 border border-warning text-warning text-xs font-semibold rounded-full animate-pulse">
                      ⚠️ Mangler dato/tid
                    </span>
                  )}
                  {booking.payment_status === 'awaiting_payment' && (
                    <span className="px-3 py-1 bg-blue-500/20 border border-blue-500 text-blue-400 text-xs font-semibold rounded-full">
                      💳 Afventer betaling
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                  {/* Customer Info */}
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-neutral-400">
                      <User size={16} className="mr-2" />
                      <EditableContent
                        contentKey="admin-bookings-customer-label"
                        fallback="Kunde"
                      />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">
                        {booking.customer_name}
                      </p>
                      <p className="text-sm text-neutral-300">
                        {booking.user_email || booking.guest_email || <span className="italic text-neutral-500">Ingen email</span>}
                      </p>
                    </div>
                    <p className="text-xs text-neutral-500">Booking #{booking.id}</p>
                  </div>

                  {/* Product & Date */}
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-neutral-400">
                      <Calendar size={16} className="mr-2" />
                      <EditableContent
                        contentKey="admin-bookings-service-label"
                        fallback="Service"
                      />
                    </div>
                    <p className="font-medium text-white">
                      {booking.product_id
                        ? getProductName(booking.product_id)
                        : <span className="italic text-neutral-500">Intet produkt</span>}
                    
                    {booking.booking_date && booking.booking_time ? (
                      <p className="text-sm text-neutral-400">
                        {formatDate(booking.booking_date)} kl. {formatTime(booking.booking_time)}
                      </p>
                    ) : (
                      <p className="text-sm text-warning italic">
                        Dato/tid ikke fastsat endnu
                      </p>
                    )}
                      </p>
                    {booking.include_editing && (
                      <span className="inline-flex items-center px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-lg font-medium">
                        <Edit3 size={14} className="mr-2" />
                        Inkluderer redigering (+100 kr)
                      </span> )}
                  </div> 

                  {/* Location */}
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-neutral-400">
                      <MapPin size={16} className="mr-2" />
                      <EditableContent
                        contentKey="admin-bookings-location-label"
                        fallback="Lokation"
                      />
                    </div>
                    <p className="text-sm">{booking.address}</p>
                    {booking.share_project_url && (
                      <div className="mt-2">
                        <a
                          href={booking.share_project_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-xs text-primary hover:text-primary-light"
                        >
                          <ExternalLink size={12} className="mr-1" />
                          Del Projekt Link
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Price & Status */}
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-neutral-400">
                      <DollarSign size={16} className="mr-2" />
                      <EditableContent
                        contentKey="admin-bookings-payment-label"
                        fallback="Betaling"
                      />
                    </div>
                    <p className="font-bold text-lg">{booking.price} kr</p>
                    <div className="space-y-1">
                      <span className={`inline-block px-2 py-1 text-xs rounded ${getStatusColor(booking.payment_status, false)}`}>
                        {getStatusText(booking.payment_status)}
                      </span>
                      {booking.is_completed && (
                        <span className="inline-block px-2 py-1 text-xs rounded text-success bg-success/10 ml-2">
                          Gennemført
                        </span>
                      )}
                    </div>
                    {booking.payment_method && (
                      <p className="text-sm text-neutral-400">
                        Metode: <span className="font-medium text-neutral-300">{getPaymentMethodText(booking.payment_method)}</span>
                      </p>
                    )}
                    {booking.zip_file_url && (
                      <div className="mt-2">
                        <a
                          href={booking.zip_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-xs text-primary hover:text-primary-light"
                        >
                          <Download size={12} className="mr-1" />
                          Zip fil tilgængelig
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-row lg:flex-col flex-wrap lg:flex-nowrap gap-2 lg:ml-4">
                  {booking.mode === 'smart' && !booking.booking_date && (
                    <button
                      onClick={() => {
                        setCompletingSmartBooking(booking.id);
                        setSmartBookingData({
                          booking_date: booking.booking_date || '',
                          booking_time: booking.booking_time || '',
                        });
                      }}
                      className="flex items-center px-3 py-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded text-sm transition-all shadow-lg shadow-purple-500/25"
                    >
                      <Zap size={14} className="mr-1" />
                      Gennemfør Smart Booking
                    </button>
                  )}

                  {!booking.is_completed && (
                    <button
                      onClick={() => handleCompleteBooking(booking.id)}
                      className="flex items-center px-3 py-1 bg-success text-white rounded text-sm hover:bg-success/80 transition-colors"
                    >
                      <CheckCircle size={14} className="mr-1" />
                      <EditableContent contentKey="admin-bookings-complete-button" fallback="Gennemfør" />
                    </button>
                  )}

                  {booking.is_completed && booking.payment_status !== 'paid' && (
                    <button
                      onClick={() => handleStatusUpdate(booking.id, 'paid')}
                      className="flex items-center px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary/80 transition-colors"
                    >
                      <DollarSign size={14} className="mr-1" />
                      <EditableContent contentKey="admin-bookings-mark-paid-button" fallback="Marker Betalt" />
                    </button>
                  )}

                  {!booking.is_completed && booking.payment_status === 'pending' && (
                    <button
                      onClick={() => handleStatusUpdate(booking.id, 'paid')}
                      className="flex items-center px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary/80 transition-colors"
                    >
                      <DollarSign size={14} className="mr-1" />
                      <EditableContent contentKey="admin-bookings-mark-paid-button" fallback="Marker Betalt" />
                    </button>
                  )}

                  <button
                    onClick={() => handleEditBooking(booking)}
                    className="flex items-center px-3 py-1 bg-neutral-600 text-white rounded text-sm hover:bg-neutral-500 transition-colors"
                  >
                    <Edit size={14} className="mr-1" />
                    <EditableContent contentKey="admin-bookings-edit-button" fallback="Rediger" />
                  </button>

                  <button
                    onClick={() => handleSendConfirmationEmail(booking)}
                    className="flex items-center px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 transition-colors"
                  >
                    <Mail size={14} className="mr-1" />
                    Send Bekræftelse
                  </button>

                  {booking.zip_file_url && (
                    <button
                      onClick={() => handleSendCompletionEmailManually(booking)}
                      className="flex items-center px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-500 transition-colors"
                    >
                      <Mail size={14} className="mr-1" />
                      Send Gennemførsel
                    </button>
                  )}

                  <button
                    onClick={() => handleToggleInfo(booking.id)}
                    className={`flex items-center px-3 py-1 rounded text-sm transition-colors ${
                      viewingInfoId === booking.id 
                        ? 'bg-neutral-500 text-white' 
                        : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                    }`}
                  >
                    <Info size={14} className="mr-1" />
                    Information
                  </button>

                  <button
                    onClick={() => handleArchiveBooking(booking.id, booking.is_archived)}
                    className={`flex items-center px-3 py-1 rounded text-sm transition-colors ${
                      booking.is_archived
                        ? 'bg-warning text-white hover:bg-warning/80'
                        : 'bg-neutral-700 text-white hover:bg-neutral-600'
                    }`}
                  >
                    {booking.is_archived ? (
                      <>
                        <ArchiveRestore size={14} className="mr-1" />
                        Genopret
                      </>
                    ) : (
                      <>
                        <Archive size={14} className="mr-1" />
                        Arkiver
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteClick(booking.id)}
                    className="flex items-center px-3 py-1 bg-error/80 text-white rounded text-sm hover:bg-error transition-colors"
                  >
                    <Trash2 size={14} className="mr-1" />
                    Slet
                  </button>
                </div>
              </div>

              {/* Extra Information */}
              {viewingInfoId === booking.id && (
                <div className="mt-6 pt-4 border-t border-neutral-600 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-600">
                    <div className="flex items-center mb-2">
                      <Info size={16} className="text-primary mr-2" />
                      <h4 className="font-semibold text-white">Ekstra Information (Raw Data)</h4>
                    </div>
                    {(!booking.extra_information || Object.keys(booking.extra_information).length === 0) ? (
                      <p className="text-neutral-400 text-sm italic">Ingen ekstra information fundet for denne booking.</p>
                    ) : (
                      <div className="bg-neutral-900 rounded p-3 overflow-x-auto">
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                          {JSON.stringify(booking.extra_information, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Delete Confirmation */}
              {deletingBookingId === booking.id && (
                <div className="mt-6 pt-6 border-t border-neutral-600">
                  <div className="bg-error/10 border border-error/30 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <Trash2 size={24} className="text-error mr-3" />
                      <h4 className="font-semibold text-error text-lg">Bekræft Sletning</h4>
                    </div>
                    <p className="text-neutral-300 mb-4">
                      Er du sikker på, at du vil slette denne booking? Dette kan ikke fortrydes.
                    </p>
                    <p className="text-sm text-neutral-400 mb-4">
                      Booking: <span className="font-semibold">{booking.customer_name}</span> - {getProductName(booking.product_id)}
                    </p>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={handleDeleteCancel}
                        className="px-4 py-2 bg-neutral-600 text-white rounded hover:bg-neutral-500 transition-colors"
                      >
                        Annuller
                      </button>
                      <button
                        onClick={handleDeleteConfirm}
                        className="px-4 py-2 bg-error text-white rounded hover:bg-error/80 transition-colors flex items-center"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Slet Booking
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Complete Smart Booking Modal */}
              {completingSmartBooking === booking.id && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                  <div className="bg-neutral-800 rounded-2xl p-8 max-w-2xl w-full border-2 border-purple-500/30 shadow-2xl shadow-purple-500/20 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center mr-4 shadow-lg">
                        <Zap className="text-white" size={28} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Gennemfør Smart Booking</h3>
                        <p className="text-sm text-neutral-400">Booking #{booking.id}</p>
                      </div>
                    </div>
                    
                    <div className="mb-6 p-5 bg-neutral-700/50 rounded-xl border border-neutral-600">
                      <h4 className="font-semibold mb-4 flex items-center text-lg">
                        <Info size={18} className="mr-2 text-blue-400" />
                        Booking Detaljer
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="col-span-2 md:col-span-1">
                          <span className="text-neutral-400 block mb-1">Produkt</span>
                          <p className="font-medium text-white">{getProductName(booking.product_id)}</p>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <span className="text-neutral-400 block mb-1">Pris</span>
                          <p className="font-bold text-primary text-lg">{booking.price} kr</p>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <span className="text-neutral-400 block mb-1">Kunde</span>
                          <p className="font-medium text-white">{booking.customer_name}</p>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <span className="text-neutral-400 block mb-1">Betaling</span>
                          <span className={`inline-block px-2 py-1 text-xs rounded font-semibold ${
                            booking.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' :
                            booking.payment_status === 'awaiting_payment' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-warning/20 text-warning'
                          }`}>
                            {getStatusText(booking.payment_status)}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-neutral-400 block mb-1">Email</span>
                          <p className="font-medium text-white break-all">{booking.user_email || booking.guest_email || <span className="italic text-neutral-500">Ingen email</span>}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-neutral-400 block mb-1">Adresse</span>
                          <p className="text-sm text-neutral-300">{booking.address}</p>
                        </div>
                        {booking.include_editing && (
                          <div className="col-span-2">
                            <span className="inline-flex items-center px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-lg font-medium">
                              <Edit3 size={14} className="mr-2" />
                              Inkluderer redigering (+100 kr)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-2">
                          📅 Booking Dato *
                        </label>
                        <input
                          type="date"
                          value={smartBookingData.booking_date}
                          onChange={(e) => setSmartBookingData(prev => ({ ...prev, booking_date: e.target.value }))}
                          className="form-input w-full bg-neutral-700 border-neutral-600 focus:border-purple-500 focus:ring-purple-500 text-white"
                          required
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-2">
                          🕐 Booking Tidspunkt *
                        </label>
                        <input
                          type="time"
                          value={smartBookingData.booking_time}
                          onChange={(e) => setSmartBookingData(prev => ({ ...prev, booking_time: e.target.value }))}
                          className="form-input w-full bg-neutral-700 border-neutral-600 focus:border-purple-500 focus:ring-purple-500 text-white"
                          required
                        />
                      </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                      <div className="flex items-start">
                        <Info size={20} className="text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-neutral-300">
                          <strong className="text-blue-400 block mb-2">📋 Hvad sker der når du gennemfører:</strong>
                          <ul className="space-y-1.5 list-none">
                            <li className="flex items-start">
                              <span className="text-blue-400 mr-2">✓</span>
                              <span>Bookingen opdateres med dato og tidspunkt</span>
                            </li>
                            <li className="flex items-start">
                              <span className="text-blue-400 mr-2">✓</span>
                              <span>Mode ændres fra "smart" til "normal"</span>
                            </li>
                            <li className="flex items-start">
                              <span className="text-blue-400 mr-2">✓</span>
                              <span>Bekræftelses-email sendes til kunden</span>
                            </li>
                            {booking.payment_status === 'awaiting_payment' && (
                              <li className="flex items-start">
                                <span className="text-warning mr-2">⚠</span>
                                <span className="text-warning">Kunden kan derefter gennemføre betaling</span>
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-3">
                      <button
                        onClick={() => {
                          setCompletingSmartBooking(null);
                          setSmartBookingData({ booking_date: '', booking_time: '' });
                        }}
                        className="px-5 py-2.5 bg-neutral-600 hover:bg-neutral-500 text-white rounded-lg transition-all font-medium"
                      >
                        Annuller
                      </button>
                      <button
                        onClick={async () => {
                          if (!smartBookingData.booking_date || !smartBookingData.booking_time) {
                            toast.error('Udfyld venligst både dato og tidspunkt');
                            return;
                          }
                          try {
                            await updateBooking(booking.id, {
                              booking_date: smartBookingData.booking_date,
                              booking_time: smartBookingData.booking_time,
                              mode: 'normal',
                            });
                            await handleSendConfirmationEmail({
                              ...booking,
                              booking_date: smartBookingData.booking_date,
                              booking_time: smartBookingData.booking_time,
                            });
                            toast.success('🚀 Smart booking gennemført! Kunde har modtaget bekræftelse.');
                            setCompletingSmartBooking(null);
                            setSmartBookingData({ booking_date: '', booking_time: '' });
                          } catch (error) {
                            console.error('Error completing smart booking:', error);
                            toast.error('Kunne ikke gennemføre smart booking. Prøv igen.');
                          }
                        }}
                        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-purple-500/25"
                        disabled={!smartBookingData.booking_date || !smartBookingData.booking_time}
                      >
                        <Zap size={16} className="mr-2" />
                        🚀 Gennemfør Booking
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Form */}
              {editingBooking === booking.id && (
                <div className="mt-6 pt-6 border-t border-neutral-600">
                  <EditableContent
                    contentKey="admin-bookings-edit-form-title"
                    as="h4"
                    className="font-medium mb-4"
                    fallback="Rediger Booking"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <EditableContent
                        contentKey="admin-bookings-edit-status-label"
                        as="label"
                        className="block text-sm font-medium text-neutral-300 mb-1"
                        fallback="Betalingsstatus"
                      />
                      <select
                        value={editingData.payment_status}
                        onChange={(e) => setEditingData({ ...editingData, payment_status: e.target.value })}
                        className="form-input w-full"
                      >
                        <option value="pending">Afventende</option>
                        <option value="paid">Betalt</option>
                        <option value="failed">Fejlet</option>
                        <option value="awaiting_payment">Afventer betaling</option>
                      </select>
                    </div>
                    <div>
                      <EditableContent
                        contentKey="admin-bookings-edit-method-label"
                        as="label"
                        className="block text-sm font-medium text-neutral-300 mb-1"
                        fallback="Betalingsmetode"
                      />
                      <select
                        value={editingData.payment_method}
                        onChange={(e) => setEditingData({ ...editingData, payment_method: e.target.value })}
                        className="form-input w-full"
                      >
                        <option value="">Vælg metode</option>
                        <option value="card">Kort</option>
                        <option value="invoice">Faktura</option>
                        <option value="cash">Kontant</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-1">
                        Booking Dato
                      </label>
                      <input
                        type="date"
                        value={editingData.booking_date}
                        onChange={(e) => setEditingData({ ...editingData, booking_date: e.target.value })}
                        className="form-input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-1">
                        Booking Tidspunkt
                      </label>
                      <input
                        type="time"
                        value={editingData.booking_time}
                        onChange={(e) => setEditingData({ ...editingData, booking_time: e.target.value })}
                        className="form-input w-full"
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`editing-${booking.id}`}
                        checked={editingData.include_editing}
                        onChange={(e) => handleEditingToggle(e.target.checked)}
                        className="mr-2 h-4 w-4"
                      />
                      <label htmlFor={`editing-${booking.id}`} className="text-sm text-neutral-300">
                        Inkluder Redigering
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-1">
                        Total Pris
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={editingData.price}
                          onChange={(e) => setEditingData({ ...editingData, price: parseFloat(e.target.value) || 0 })}
                          className="form-input w-full"
                        />
                        <span className="text-neutral-400">kr</span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">
                        Prisen opdateres automatisk når du ændrer redigering
                      </p>
                    </div>

                    <div className="flex items-center md:col-span-2">
                      <input
                        type="checkbox"
                        id={`completed-${booking.id}`}
                        checked={editingData.is_completed}
                        onChange={(e) => setEditingData({ ...editingData, is_completed: e.target.checked })}
                        className="mr-2 h-4 w-4"
                      />
                      <label htmlFor={`completed-${booking.id}`} className="text-sm text-neutral-300">
                        Booking Gennemført
                      </label>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-neutral-300 mb-1">
                        Del Projekt URL
                      </label>
                      <input
                        type="url"
                        value={editingData.share_project_url}
                        onChange={(e) => setEditingData({ ...editingData, share_project_url: e.target.value })}
                        placeholder="https://example.com/share/project-link"
                        className="form-input w-full"
                      />
                      <p className="text-xs text-neutral-400 mt-1">
                        Link til delt projekt (f.eks. Google Drive, WeTransfer, etc.)
                      </p>
                    </div>
                  </div>
                  
                  {/* File Upload Section */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                      Zip fil til kunde
                    </label>
                    
                    <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0 mb-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name={`zipInputType-${booking.id}`}
                          value="gofile"
                          checked={zipInputType === 'gofile'}
                          onChange={() => handleZipInputTypeChange('gofile')}
                          className="mr-2"
                        />
                        <Cloud size={16} className="mr-1 text-green-400" />
                        <span className="text-sm">Gofile Upload (Ubegrænset)</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name={`zipInputType-${booking.id}`}
                          value="upload"
                          checked={zipInputType === 'upload'}
                          onChange={() => handleZipInputTypeChange('upload')}
                          className="mr-2"
                        />
                        <Upload size={16} className="mr-1" />
                        <span className="text-sm">Upload fil (Max 50MB)</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name={`zipInputType-${booking.id}`}
                          value="link"
                          checked={zipInputType === 'link'}
                          onChange={() => handleZipInputTypeChange('link')}
                          className="mr-2"
                        />
                        <LinkIcon size={16} className="mr-1" />
                        <span className="text-sm">Brug link (Eksternt)</span>
                      </label>
                    </div>

                    {zipInputType === 'gofile' && (
                      <div>
                        <div className="border-2 border-dashed border-neutral-600 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                          <input
                            type="file"
                            accept=".zip,.rar,.7z"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleGofileUpload(file);
                            }}
                            className="hidden"
                            id={`gofile-upload-${booking.id}`}
                            disabled={gofileUploading}
                          />
                          <label
                            htmlFor={`gofile-upload-${booking.id}`}
                            className={`cursor-pointer ${gofileUploading ? 'opacity-50' : ''}`}
                          >
                            {gofileUploading ? (
                              <div>
                                <Loader size={32} className="mx-auto mb-2 animate-spin text-primary" />
                                <p className="text-sm text-neutral-400 mb-1">
                                  {uploadStatus || 'Uploader til Gofile...'}
                                </p>
                                <div className="w-full bg-neutral-700 rounded-full h-2 mt-2">
                                  <div
                                    className="bg-primary h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${gofileProgress}%` }}
                                  ></div>
                                </div>
                                <p className="text-xs text-neutral-500 mt-1">{gofileProgress}%</p>
                              </div>
                            ) : (
                              <>
                                <Cloud size={32} className="mx-auto mb-2 text-green-400" />
                                <p className="text-sm text-neutral-300 mb-1">Klik for at uploade til Gofile</p>
                                <p className="text-xs text-neutral-500">Gratis • Ubegrænset størrelse</p>
                                <p className="text-xs text-neutral-500">.zip, .rar, .7z</p>
                              </>
                            )}
                          </label>
                        </div>
                        {editingData.zip_file_url && zipInputType === 'gofile' && (
                          <div className="mt-2 p-2 bg-success/10 border border-success/30 rounded">
                            <p className="text-xs text-success flex items-center">
                              <CheckCircle size={12} className="mr-1" />
                              Fil uploadet til Gofile
                            </p>
                            <a
                              href={editingData.zip_file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline break-all"
                            >
                              {editingData.zip_file_url}
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {zipInputType === 'upload' && (
                      <FileUpload
                        onFileUploaded={handleFileUploaded}
                        currentFileUrl={zipInputType === 'upload' ? editingData.zip_file_url : ''}
                        bucketName="booking-files"
                        filePath={`booking-${booking.id}-${booking.user_id}`}
                        acceptedTypes=".zip,.rar,.7z"
                        maxSizeMB={50}
                        label="Upload zip fil med færdige optagelser"
                      />
                    )}

                    {zipInputType === 'link' && (
                      <div>
                        <input
                          type="url"
                          value={zipInputType === 'link' ? editingData.zip_file_url : ''}
                          onChange={(e) => handleZipLinkChange(e.target.value)}
                          placeholder="https://example.com/your-zip-file.zip"
                          className="form-input w-full"
                        />
                        <p className="text-xs text-neutral-400 mt-1">
                          Indtast et direkte link til zip filen (f.eks. Google Drive, Dropbox, WeTransfer, etc.)
                        </p>
                      </div>
                    )}
                    
                    {editingData.zip_file_url && editingData.zip_file_url !== booking.zip_file_url && (
                      <div className="mt-4 space-y-2">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendCompletionEmail}
                            onChange={(e) => setSendCompletionEmail(e.target.checked)}
                            className="mr-2 h-4 w-4"
                          />
                          <span className="text-sm text-neutral-300">
                            Send gennemførselsemail automatisk ved gem
                          </span>
                        </label>
                        <p className="text-sm text-warning flex items-center">
                          ⚠️ Ny {zipInputType === 'gofile' ? 'Gofile upload' : zipInputType === 'upload' ? 'fil' : 'link'} detekteret
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-neutral-600 text-white rounded hover:bg-neutral-500 transition-colors"
                    >
                      Annuller
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                      disabled={gofileUploading}
                    >
                      {gofileUploading ? 'Uploader...' : 'Gem'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BookingsManager;