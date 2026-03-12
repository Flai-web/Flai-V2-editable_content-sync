import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import EditableContent from './EditableContent';
import { useData } from '../contexts/DataContext';

const Testimonials: React.FC = () => {
  const navigate = useNavigate();
  const { ratings } = useData();
  const controls = useAnimation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(800);

  const [ref, inView] = useInView({
    triggerOnce: false,
    threshold: 0.2,
  });

  // Listen for height messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data.height === 'number') {
        setIframeHeight(event.data.height + 20);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    } else {
      controls.start('hidden');
    }
  }, [controls, inView]);

  return (
    <section ref={ref} className="py-20 bg-neutral-800">
      <div className="container">
        <motion.div
          initial="hidden"
          animate={controls}
          variants={{
            visible: { opacity: 1, y: 0 },
            hidden: { opacity: 0, y: 50 }
          }}
          transition={{ duration: 0.8 }}
        >
          <EditableContent
            contentKey="testimonials-title"
            as="h2"
            className="text-3xl font-bold text-center mb-12 text-white"
            fallback="Hvad siger vores kunder?"
          />

          <div className="mb-16 px-4 sm:px-0 flex justify-center">
            <div className="w-full sm:w-[90%] md:w-full">
              <iframe
                ref={iframeRef}
                src="/review-4.html"
                className="w-full transition-all duration-300"
                style={{
                  height: `${iframeHeight}px`,
                  border: 'none',
                  background: 'transparent',
                  overflow: 'hidden'
                }}
                title="Google Anmeldelser"
                scrolling="no"
              />
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate('/ratings')}
              className="btn-primary"
            >
              <EditableContent
                contentKey="testimonials-button"
                fallback="Se Alle Anmeldelser"
              />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;