import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { adminUrl } from 'app/config/config';
import './site-footer.css';

/** The seven links every gov.bc.ca site carries, in the B.C. Design System footer's order. */
const GOV_LINKS = [
  { label: 'Home', href: 'https://www2.gov.bc.ca/gov/content/home' },
  { label: 'About gov.bc.ca', href: 'https://www2.gov.bc.ca/gov/content/about-gov-bc-ca' },
  { label: 'Disclaimer', href: 'https://www2.gov.bc.ca/gov/content/home/disclaimer' },
  { label: 'Privacy', href: 'https://www2.gov.bc.ca/gov/content/home/privacy' },
  {
    label: 'Accessibility',
    href: 'https://www2.gov.bc.ca/gov/content/home/accessible-government',
  },
  { label: 'Copyright', href: 'https://www2.gov.bc.ca/gov/content/home/copyright' },
  {
    label: 'Contact us',
    href: 'https://www2.gov.bc.ca/gov/content/home/get-help-with-government-services',
  },
];

export function SiteFooter({ className = '' }: { className?: string }) {
  const { pathname } = useLocation();
  const footerRef = useRef<HTMLElement>(null);

  // Re-measured on navigation as well as resize: the map page hides the footer, so the height has
  // to be taken again once a route that shows it is back.
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
    <footer ref={footerRef} className={`app-footer${className ? ' ' + className : ''}`} id="footer">
      <div className="app-footer--acknowledgement">
        <div className="app-footer--acknowledgement-text">
          <p>
            The B.C. Public Service acknowledges the territories of First Nations around B.C. and is
            grateful to carry out our work on these lands. We acknowledge the rights, interests,
            priorities, and concerns of all Indigenous Peoples — First Nations, Métis, and Inuit —
            respecting and acknowledging their distinct cultures, histories, rights, laws, and
            governments.
          </p>
        </div>
      </div>
      <div className="app-footer--container">
        <div className="app-footer--container-content">
          <div className="app-footer--logo-links">
            <div className="app-footer--logo">
              <img src="/assets/images/BCID_H_rgb_rev.svg" alt="" id="bcgov-logo-footer" />
              <p>
                We can help in over 220 languages and through other accessible options.{' '}
                <a href="https://www2.gov.bc.ca/gov/content/home/get-help-with-government-services">
                  Call, email or text us
                </a>
                , or{' '}
                <a href="https://www2.gov.bc.ca/gov/content/home/services-a-z">
                  find a service centre
                </a>
              </p>
            </div>
            <figure className="app-footer--links">
              <figcaption className="app-footer--links-title">More Info</figcaption>
              <ul>
                {GOV_LINKS.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
                <li>
                  <a href={adminUrl()} className="gtm-admin-login" target="_blank" rel="noopener">
                    Admin Login
                  </a>
                </li>
              </ul>
            </figure>
          </div>
          <hr />
          <p className="app-footer--copyright">
            © {new Date().getUTCFullYear()} Government of British Columbia.
          </p>
        </div>
      </div>
    </footer>
  );
}
