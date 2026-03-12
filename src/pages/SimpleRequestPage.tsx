import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import EditableContent from '../components/EditableContent';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripePaymentForm from '../components/StripePaymentForm';
import { isAddressWithinRange, getFormattedDistance } from '../utils/location';
import { AlertTriangle } from 'lucide-react';

const SimpleRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { products, isProductsLoaded, isSiteContentLoaded } = useData();
  const { user } = useAuth();

  const prefilledProductId = searchParams.get('product_id');
  const prefilledProductName = searchParams.get('product_name');

  const [formData, setFormData] = useState({
    productId: prefilledProductId || '',
    productName: prefilledProductName || '',
    productPrice: 0,
    customerEmail: '',
    customerName: '',
    customerAddress: '',
    wantsEditing: false,
    paymentMethod: 'pay_now',
  });

  const [errors, setErrors] = useState({
    productId: '',
    customerEmail: '',
    customerName: '',
    customerAddress: '',
    paymentMethod: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Address validation state
  const [isAddressValid, setIsAddressValid] = useState<boolean>(true);
  const [addressDistance, setAddressDistance] = useState<string>('');
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);

  // Mount guard — prevents black screen flash on direct URL navigation
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Restore state after Google OAuth
  useEffect(() => {
    const restoreState = () => {
      const savedState = sessionStorage.getItem('smartBookingState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          if (state.productId) setFormData(prev => ({ ...prev, productId: state.productId }));
          if (state.customerAddress) setFormData(prev => ({ ...prev, customerAddress: state.customerAddress }));
          if (state.wantsEditing !== undefined) setFormData(prev => ({ ...prev, wantsEditing: state.wantsEditing }));
          if (state.paymentMethod) setFormData(prev => ({ ...prev, paymentMethod: state.paymentMethod }));
          sessionStorage.removeItem('smartBookingState');
          toast.success('Velkommen tilbage! Dine oplysninger er udfyldt.');
        } catch (error) {
          console.error('Error restoring state:', error);
        }
      }
    };
    if (user) restoreState();
  }, [user]);

  // Get user info from auth
  useEffect(() => {
    const getUserInfo = async () => {
      if (user) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const fullName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || '';
        if (fullName) setFormData(prev => ({ ...prev, customerName: fullName }));
        if (user.email) setFormData(prev => ({ ...prev, customerEmail: user.email }));
      }
    };
    getUserInfo();
  }, [user]);

  // Prefill product from URL params
  useEffect(() => {
    if (prefilledProductId && prefilledProductName) {
      const product = products.find(p => p.id.toString() === prefilledProductId);
      setSelectedProduct(product);
      setFormData(prev => ({
        ...prev,
        productId: prefilledProductId,
        productName: prefilledProductName,
        productPrice: product?.price || 0,
      }));
    }
  }, [prefilledProductId, prefilledProductName, products]);

  // Initialize Stripe
  useEffect(() => {
    const initializeStripe = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-stripe-config`,
          { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` } }
        );
        const data = await response.json();
        if (data.error) { console.error('Failed to get Stripe config:', data.error); return; }
        setStripePromise(loadStripe(data.publishableKey));
      } catch (error) {
        console.error('Error initializing Stripe:', error);
      }
    };
    initializeStripe();
  }, []);

  // -------------------------------------------------------------------------
  // Address validation — same logic as BookingPage
  // -------------------------------------------------------------------------
  const validateAddress = async (address: string): Promise<boolean> => {
    if (!address.trim()) {
      setIsAddressValid(true);
      setAddressDistance('');
      return true;
    }
    setIsValidatingAddress(true);
    try {
      const isValid = await isAddressWithinRange(address);
      setIsAddressValid(isValid);
      if (!isValid) {
        const dist = await getFormattedDistance(address);
        setAddressDistance(dist);
        return false;
      } else {
        setAddressDistance('');
        return true;
      }
    } catch (error) {
      console.error('Error validating address:', error);
      return false;
    } finally {
      setIsValidatingAddress(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors = {
      productId: '',
      customerEmail: '',
      customerName: '',
      customerAddress: '',
      paymentMethod: '',
    };

    if (!formData.productId) newErrors.productId = 'Vælg venligst et produkt';
    if (!formData.customerEmail) {
      newErrors.customerEmail = 'Email er påkrævet';
    } else if (!validateEmail(formData.customerEmail)) {
      newErrors.customerEmail = 'Indtast en gyldig email-adresse';
    }
    if (!formData.customerName || formData.customerName.trim().length < 2) {
      newErrors.customerName = 'Indtast dit fulde navn';
    }
    if (!formData.customerAddress || formData.customerAddress.trim().length < 5) {
      newErrors.customerAddress = 'Indtast en gyldig adresse (minimum 5 tegn)';
    }
    if (!formData.paymentMethod) newErrors.paymentMethod = 'Vælg venligst en betalingsmetode';

    setErrors(newErrors);
    return !Object.values(newErrors).some(e => e !== '');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, customerAddress: value }));
    setErrors(prev => ({ ...prev, customerAddress: '' }));
    // Reset range error when user edits the field
    if (!isAddressValid) {
      setIsAddressValid(true);
      setAddressDistance('');
    }
  };

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedProductId = e.target.value;
    const product = products.find(p => p.id.toString() === selectedProductId);
    setSelectedProduct(product);
    setFormData(prev => ({
      ...prev,
      productId: selectedProductId,
      productName: product?.name || '',
      productPrice: product?.price || 0,
      wantsEditing: false,
    }));
    setErrors(prev => ({ ...prev, productId: '' }));
  };

  const calculateTotalPrice = () => {
    let total = formData.productPrice;
    if (formData.wantsEditing && selectedProduct && !selectedProduct.is_editing_included) total += 100;
    return total;
  };

  // Handle invoice / on-site submissions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Udfyld venligst alle påkrævede felter korrekt');
      return;
    }

    // pay_now is handled by StripePaymentForm
    if (formData.paymentMethod === 'pay_now') return;

    // Validate address range before submitting
    const addressOk = await validateAddress(formData.customerAddress);
    if (!addressOk) {
      toast.error('Adressen er uden for vores dækningsområde');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-simple-booking-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            productId: parseInt(formData.productId),
            productName: formData.productName,
            productPrice: formData.productPrice,
            customerEmail: formData.customerEmail,
            customerName: formData.customerName,
            customerAddress: formData.customerAddress,
            wantsEditing: selectedProduct?.is_editing_included ? true : formData.wantsEditing,
            paymentMethod: formData.paymentMethod,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send booking request');
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to create booking');

      toast.success('🚀 Din booking er modtaget! Vi kontakter dig snart.');
      setTimeout(() => navigate('/booking-success'), 2000);
    } catch (error: any) {
      console.error('Error submitting simple booking request:', error);
      toast.error(error.message || 'Der opstod en fejl. Prøv venligst igen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Called by StripePaymentForm before payment is charged
  const createPaymentIntent = async () => {
    if (!validateForm()) {
      throw new Error('Udfyld venligst alle påkrævede felter korrekt');
    }

    // Validate address range before charging
    const addressOk = await validateAddress(formData.customerAddress);
    if (!addressOk) {
      throw new Error('Adressen er uden for vores dækningsområde');
    }

    // Create booking first
    const bookingResponse = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-simple-booking-request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          productId: parseInt(formData.productId),
          productName: formData.productName,
          productPrice: formData.productPrice,
          customerEmail: formData.customerEmail,
          customerName: formData.customerName,
          customerAddress: formData.customerAddress,
          wantsEditing: selectedProduct?.is_editing_included ? true : formData.wantsEditing,
          paymentMethod: formData.paymentMethod,
        }),
      }
    );

    if (!bookingResponse.ok) {
      const errorData = await bookingResponse.json();
      throw new Error(errorData.error || 'Failed to create booking');
    }

    const bookingResult = await bookingResponse.json();
    if (!bookingResult.success) throw new Error(bookingResult.error || 'Failed to create booking');

    setBookingId(bookingResult.bookingId);

    // Create Stripe payment intent
    const totalPrice = calculateTotalPrice();
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          amount: totalPrice,
          customerEmail: formData.customerEmail,
          customerName: formData.customerName,
          metadata: {
            bookingId: bookingResult.bookingId,
            productId: formData.productId,
            productName: formData.productName,
            address: formData.customerAddress,
            includeEditing: formData.wantsEditing,
            guestEmail: formData.customerEmail,
            customerName: formData.customerName,
            mode: 'smart',
          },
        }),
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return { clientSecret: data.clientSecret, paymentIntentId: data.paymentIntentId };
  };

  const handlePaymentComplete = async (paymentIntentId: string) => {
    if (!bookingId) return;
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ payment_intent_id: paymentIntentId, payment_status: 'paid' }),
      }
    );
    if (!response.ok) console.error('Failed to update booking with payment intent');
  };

  // Show spinner until mounted AND data is ready
  if (!isMounted || !isProductsLoaded || !isSiteContentLoaded) {
    return (
      <div className="pt-24 pb-16 container">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-300"></div>
          <EditableContent contentKey="simple-loading-text" className="mt-2 text-neutral-400" fallback="Indlæser..." />
        </div>
      </div>
    );
  }

  const totalPrice = calculateTotalPrice();

  return (
    <div className="pt-24 pb-16">
      <div className="container">
        <div className="max-w-3xl mx-auto">

          {/* Product Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-neutral-400 text-sm mb-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <EditableContent contentKey="simple-product-label" fallback="Produkt" />
            </div>
            <EditableContent
              contentKey="simple-product-name"
              className="text-3xl font-bold"
              fallback={formData.productName || 'Vælg et produkt'}
            />
          </div>

          <form onSubmit={handleSubmit}>

            {/* Product Selection */}
            {!prefilledProductId && (
              <div className="bg-neutral-800 rounded-xl shadow-md p-6 mb-6 border border-neutral-700">
                <EditableContent contentKey="simple-product-selection-title" as="h2" className="text-xl font-semibold mb-4" fallback="Vælg Produkt" />
                <select
                  name="productId"
                  value={formData.productId}
                  onChange={handleProductChange}
                  className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                >
                  <option value="">-- Vælg et produkt --</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.price} kr
                    </option>
                  ))}
                </select>
                {errors.productId && <p className="text-red-500 text-sm mt-2">{errors.productId}</p>}
              </div>
            )}

            {/* Personal Information */}
            <div className="bg-neutral-800 rounded-xl shadow-md p-6 mb-6 border border-neutral-700">
              <EditableContent contentKey="simple-personal-info-title" as="h2" className="text-xl font-semibold mb-4" fallback="Dine oplysninger" />

              {/* Name */}
              <div className="mb-4">
                <label htmlFor="customerName" className="block text-sm font-medium text-neutral-300 mb-2">
                  <EditableContent contentKey="simple-name-label" fallback="Dit navn" />
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="customerName"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 bg-neutral-700 border rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all ${errors.customerName ? 'border-red-500' : 'border-neutral-600'}`}
                    placeholder="John Doe"
                  />
                  {!user && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <GoogleLoginButton
                        buttonText=""
                        redirectTo={`${window.location.origin}/simple-request${prefilledProductId ? `?product_id=${prefilledProductId}&product_name=${encodeURIComponent(prefilledProductName || '')}` : ''}`}
                        bookingState={{ productId: formData.productId, customerAddress: formData.customerAddress, wantsEditing: formData.wantsEditing, paymentMethod: formData.paymentMethod }}
                        compact={true}
                      />
                    </div>
                  )}
                </div>
                {errors.customerName && <p className="text-red-500 text-sm mt-2">{errors.customerName}</p>}
              </div>

              {/* Email */}
              <div className="mb-4">
                <label htmlFor="customerEmail" className="block text-sm font-medium text-neutral-300 mb-2">
                  <EditableContent contentKey="simple-email-label" fallback="Din email" />
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="customerEmail"
                    name="customerEmail"
                    value={formData.customerEmail}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 bg-neutral-700 border rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all ${errors.customerEmail ? 'border-red-500' : 'border-neutral-600'}`}
                    placeholder="din@email.dk"
                  />
                  {!user && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <GoogleLoginButton
                        buttonText=""
                        redirectTo={`${window.location.origin}/simple-request${prefilledProductId ? `?product_id=${prefilledProductId}&product_name=${encodeURIComponent(prefilledProductName || '')}` : ''}`}
                        bookingState={{ productId: formData.productId, customerAddress: formData.customerAddress, wantsEditing: formData.wantsEditing, paymentMethod: formData.paymentMethod }}
                        compact={true}
                      />
                    </div>
                  )}
                </div>
                {errors.customerEmail && <p className="text-red-500 text-sm mt-2">{errors.customerEmail}</p>}
              </div>

              {/* Address */}
              <div>
                <label htmlFor="customerAddress" className="block text-sm font-medium text-neutral-300 mb-2">
                  <EditableContent contentKey="simple-address-label" fallback="Din adresse" />
                </label>
                <textarea
                  id="customerAddress"
                  name="customerAddress"
                  value={formData.customerAddress}
                  onChange={handleAddressChange}
                  onBlur={() => {
                    if (formData.customerAddress.trim()) validateAddress(formData.customerAddress);
                  }}
                  placeholder="Gade, husnummer, postnummer, by"
                  rows={3}
                  className={`w-full px-4 py-2 bg-neutral-700 border rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none ${
                    errors.customerAddress || !isAddressValid ? 'border-red-500' : 'border-neutral-600'
                  }`}
                />
                {errors.customerAddress && (
                  <p className="text-red-500 text-sm mt-2">{errors.customerAddress}</p>
                )}
                {!isAddressValid && formData.customerAddress && (
                  <div className="mt-2 text-red-500 flex items-start text-sm">
                    <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                    <span>
                      Denne adresse er {addressDistance} fra vores base og er uden for vores dækningsområde.
                    </span>
                  </div>
                )}
                {isValidatingAddress && (
                  <p className="text-neutral-400 text-sm mt-2">Validerer adresse...</p>
                )}
              </div>
            </div>

            {/* Editing Option */}
            {selectedProduct && (
              <div className="bg-neutral-800 rounded-xl shadow-md p-6 mb-6 border border-neutral-700">
                <EditableContent contentKey="simple-editing-title" as="h2" className="text-xl font-semibold mb-4" fallback="Tilvalg" />

                {selectedProduct.is_editing_included ? (
                  <div className="flex items-start space-x-3 p-4 border border-green-500/20 rounded-lg bg-green-500/10">
                    <svg className="w-6 h-6 text-green-400 mt-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <EditableContent contentKey="booking-editing-included-title" as="h3" className="font-medium text-green-400" fallback="Redigering inkluderet" />
                      <EditableContent contentKey="booking-editing-included-description" as="p" className="text-neutral-300 mt-1" fallback="Dette produkt inkluderer redigering som farvekorrigering, klipning, baggrundsmusik og lydeffekter." />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start space-x-3 p-4 border border-neutral-700 rounded-lg bg-neutral-800/50">
                    <input
                      type="checkbox"
                      id="editing"
                      checked={formData.wantsEditing}
                      onChange={(e) => setFormData(prev => ({ ...prev, wantsEditing: e.target.checked }))}
                      className="mt-1"
                    />
                    <div>
                      <label htmlFor="editing" className="font-medium cursor-pointer text-white">
                        <EditableContent contentKey="simple-editing-option-title" fallback="Redigering" />
                      </label>
                      <EditableContent contentKey="simple-editing-description" as="p" className="text-neutral-300 mt-1" fallback="Få redigering af dine optagelser, herunder klipning og baggrundsmusik. Farvekorrigering er gratis." />
                      <EditableContent contentKey="simple-editing-price" as="p" className="text-neutral-300 font-semibold mt-2" fallback="+100 kr" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Method */}
            <div className="bg-neutral-800 rounded-xl shadow-md p-6 mb-6 border border-neutral-700">
              <EditableContent contentKey="simple-payment-method-title" as="h2" className="text-xl font-semibold mb-4" fallback="Betalingsmetode" />

              <div className="space-y-3">
                {[
                  { value: 'pay_now', titleKey: 'simple-payment-now-title', titleFallback: 'Betal Nu', descKey: 'simple-payment-now-description', descFallback: 'Betal med kort, MobilePay, Apple Pay eller Google Pay' },
                  { value: 'invoice-card', titleKey: 'simple-payment-invoice-title', titleFallback: 'Faktura - Kort', descKey: 'simple-payment-invoice-description', descFallback: 'Betal efter levering' },
                  { value: 'on-site-card', titleKey: 'simple-payment-onsite-title', titleFallback: 'Betaling ved optagelsen', descKey: 'simple-payment-onsite-description', descFallback: 'Kort eller kontant' },
                ].map(({ value, titleKey, titleFallback, descKey, descFallback }) => (
                  <div
                    key={value}
                    className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.paymentMethod === value ? 'border-blue-500 bg-blue-500/10' : 'border-neutral-700 bg-neutral-800/50'
                    }`}
                  >
                    <input
                      type="radio"
                      id={value}
                      name="paymentMethod"
                      value={value}
                      checked={formData.paymentMethod === value}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label htmlFor={value} className="font-medium cursor-pointer text-white">
                        <EditableContent contentKey={titleKey} fallback={titleFallback} />
                      </label>
                      <EditableContent contentKey={descKey} as="p" className="text-neutral-300 mt-1 text-sm" fallback={descFallback} />
                    </div>
                  </div>
                ))}
              </div>
              {errors.paymentMethod && <p className="text-red-500 text-sm mt-2">{errors.paymentMethod}</p>}
            </div>

            {/* Total Price */}
            {selectedProduct && (
              <div className="bg-neutral-800 rounded-xl shadow-md p-6 mb-6 border border-neutral-700">
                <div className="flex justify-between items-center">
                  <EditableContent contentKey="simple-total-label" as="span" className="font-semibold text-white" fallback="Total pris:" />
                  <span className="text-2xl font-bold text-white">{totalPrice} kr</span>
                </div>
              </div>
            )}

            {/* Submit — invoice / on-site only */}
            {formData.paymentMethod !== 'pay_now' && (
              <div className="flex justify-between">
                <button type="button" onClick={() => navigate(-1)} className="btn-secondary" disabled={isSubmitting}>
                  <EditableContent contentKey="simple-cancel-button" fallback="Tilbage" />
                </button>
                <button type="submit" className="btn-primary flex items-center" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      <EditableContent contentKey="simple-submitting-button" fallback="Sender..." />
                    </>
                  ) : (
                    <EditableContent contentKey="simple-submit-button" fallback="Gennemfør booking" />
                  )}
                </button>
              </div>
            )}
          </form>

          {/* Stripe Payment Section */}
          {formData.paymentMethod === 'pay_now' && stripePromise && (
            <div className="bg-neutral-800 rounded-xl shadow-md p-6 border border-neutral-700 space-y-6">
              <div>
                <EditableContent contentKey="simple-payment-section-title" as="h2" className="text-xl font-semibold mb-4" fallback="Gennemfør betaling" />
                <EditableContent contentKey="simple-payment-section-description" as="p" className="text-neutral-300 text-sm" fallback="Udfyld kortoplysninger nedenfor for at bekræfte din booking" />
              </div>

              <div>
                <Elements
                  stripe={stripePromise}
                  options={{
                    mode: 'payment',
                    amount: Math.round(totalPrice * 100),
                    currency: 'dkk',
                    locale: 'da',
                    appearance: {
                      theme: 'night',
                      variables: {
                        colorPrimary: '#3b82f6',
                        colorBackground: '#262626',
                        colorText: '#ffffff',
                        colorDanger: '#ef4444',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        spacingUnit: '4px',
                        borderRadius: '8px',
                      },
                    },
                  }}
                >
                  <StripePaymentForm
                    amount={totalPrice}
                    customerName={formData.customerName}
                    onSuccess={() => {
                      toast.success('🎉 Betaling gennemført! Vi kontakter dig snart.');
                      setTimeout(() => navigate('/booking-success'), 2500);
                    }}
                    loading={loading}
                    setLoading={setLoading}
                    setError={setError}
                    createPaymentIntent={createPaymentIntent}
                    onPaymentComplete={handlePaymentComplete}
                    showNameField={false}
                    submitButtonText={`Betal ${totalPrice} kr`}
                  />
                </Elements>

                {error && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-3">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SimpleRequestPage;
