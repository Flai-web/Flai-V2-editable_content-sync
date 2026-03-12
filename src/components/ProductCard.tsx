import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { SkeletonLoader, SkeletonImage, SkeletonText, SkeletonButton } from './SkeletonLoader';

interface ProductCardSkeletonProps {
  className?: string;
}

export const ProductCardSkeleton: React.FC<ProductCardSkeletonProps> = ({ className = '' }) => (
  <div className={`bg-neutral-800 rounded-xl shadow-md overflow-hidden border border-neutral-700 ${className}`}>
    {/* Match actual ProductCard image dimensions: h-48 (192px) or aspect-video */}
    <div className="w-full aspect-video bg-gradient-to-r from-neutral-700 via-neutral-600 to-neutral-700 animate-shimmer bg-[length:200%_100%] rounded-t-lg" />
    <div className="p-4">
      <SkeletonLoader height="1.5rem" className="mb-2" />
      <SkeletonText lines={2} className="mb-4" />
      <div className="mt-4">
        {/* Top Row: Price and Se detaljer */}
        <div className="flex items-center mb-3">
          <SkeletonLoader width="80px" height="1.5rem" />
          <SkeletonButton width="100px" height="36px" className="ml-4 flex-1" />
        </div>
        {/* Button Stack */}
        <div className="flex flex-col space-y-2">
          <SkeletonButton width="100%" height="80px" />
          <SkeletonButton width="100%" height="80px" />
        </div>
      </div>
    </div>
  </div>
);
import { Link } from 'lucide-react';
import EditableContent from './EditableContent';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [timer, setTimer] = useState(3);
  const timerRef = useRef<NodeJS.Timeout>();

  const handleOrderClick = () => {
    navigate(`/booking/${product.id}`);
  };

  const handleSimpleRequestClick = () => {
    navigate(`/simple-request?product_id=${product.id}&product_name=${encodeURIComponent(product.name)}`);
  };

  const handleViewProduct = () => {
    navigate(`/product/${product.id}`);
  };

  useEffect(() => {
    if (isHovering && timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCurrentImageIndex((prev) => 
        prev === product.images.length - 1 ? 0 : prev + 1
      );
      setTimer(3);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isHovering, timer, product.images.length]);

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setTimer(3);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const renderMedia = () => {
    const currentImage = product.images[currentImageIndex];
    
    if (currentImage?.startsWith('youtube:')) {
      const videoId = currentImage.split(':')[1];
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
        src={currentImage || "https://images.pexels.com/photos/336232/pexels-photo-336232.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"} 
        alt={product.name} 
        className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  };

  return (
    <div className="card hover:shadow-lg group">
      <div 
        className="relative overflow-hidden rounded-lg mb-4 cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleViewProduct}
      >
        {renderMedia()}
        {isHovering && !product.images[currentImageIndex]?.startsWith('youtube:') && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center">
            {timer}
          </div>
        )}
      </div>
      <h3 className="text-xl font-semibold cursor-pointer hover:text-primary transition-colors" onClick={handleViewProduct}>
        {product.name}
      </h3>
      <p className="text-neutral-300 my-3 line-clamp-3">{product.description}</p>
      
      {product.links && product.links.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {product.links.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-sm text-primary hover:text-primary-dark transition-colors"
            >
              <Link size={14} className="mr-1" />
              {link.title}
            </a>
          ))}
        </div>
      )}
      
<div className="mt-4">
  {/* Top Row: Price and Se detaljer (Stretched) */}
  <div className="flex items-center mb-3">
    <span className="text-xl font-bold text-primary whitespace-nowrap">{product.price} <EditableContent contentKey="product-card-kr" fallback="kr" /></span>
    <button 
      onClick={handleViewProduct} 
      className="ml-4 flex-1 btn-secondary text-sm px-4 py-2"
    >
      <EditableContent contentKey="product-card-se-detaljer" fallback="Se detaljer" /></button>
  </div>

  {/* Button Stack: Book Nu and Book For Mig */}
  <div className="flex flex-col space-y-2">
    <button 
      onClick={handleOrderClick} 
      className="w-full btn-primary text-sm px-4 py-3 flex flex-col items-center"
    >
      <span className="font-bold text-base block"><EditableContent contentKey="product-card-book-nu" fallback="Book Nu" /></span>
      <span className="text-xs opacity-80 font-normal"><EditableContent contentKey="product-card-du-vaelger-selv-tid-og" fallback="Du vælger selv tid og dato efter dine behov" /></span>
    </button>
    
    <button 
      onClick={handleSimpleRequestClick}
      className="w-full btn-secondary text-sm px-4 py-3 border-2 border-primary/30 hover:border-primary/60 transition-colors flex flex-col items-center"
    >
      <span className="font-bold text-base block"><EditableContent contentKey="product-card-smart-booking" fallback="Smart Booking" /></span>
      <span className="text-xs opacity-80 font-normal text-neutral-400"><EditableContent contentKey="product-card-vi-vaelger-dato-og-tid" fallback="Vi vælger dato og tid efter lysforholdende" /></span>
    </button>
  </div>
</div>
    </div>
  );
};

export default ProductCard;