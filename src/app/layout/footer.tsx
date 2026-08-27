import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { adminUrl } from 'app/api/api';
import './footer.css';

export function Footer({ className = '' }: { className?: string }) {
  const { pathname } = useLocation();
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const updateFooterHeight = () => {
      const height = footerRef.current?.offsetHeight;
      if (height) {
        document.documentElement.style.setProperty('--footer-height', `${height}px`);
      }
    };
    updateFooterHeight();
    window.addEventListener('resize', updateFooterHeight);
    return () => window.removeEventListener('resize', updateFooterHeight);
  }, [pathname]);

  return (
    <footer
      ref={footerRef}
      className={`app-footer${pathname.startsWith('/projects') ? ' app-footer--sm' : ''}${className ? ' ' + className : ''}`}
      id="footer"
    >
      <div className="container">
        <div className="footer-admin clearfix">
          <ul className="gov-links">
            <li><a href="#">Home</a></li>
            <li><a href="http://www2.gov.bc.ca/gov/content/home/copyright" target="_blank" rel="noopener">Copyright</a></li>
            <li><a href="http://www2.gov.bc.ca/gov/content/home/disclaimer" target="_blank" rel="noopener">Disclaimer</a></li>
            <li><a href="http://www2.gov.bc.ca/gov/content/home/privacy" target="_blank" rel="noopener">Privacy</a></li>
            <li><a href="http://www2.gov.bc.ca/gov/content/home/accessibility" target="_blank" rel="noopener">Accessibility</a></li>
            <li><a href={adminUrl()} className="gtm-admin-login" target="_blank" rel="noopener">Admin Login</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
