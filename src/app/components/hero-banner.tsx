import { Link } from 'react-router';
import './hero-banner.css';

export interface HeroBannerAction {
  label: string;
  routerLink?: string;
  href?: string;
  icon?: string;
  target?: string;
  rel?: string;
  title?: string;
}

interface HeroBannerProps {
  title: string;
  description: string;
  actions?: HeroBannerAction[];
  backgroundImage?: string;
}

// Remove focus from the link after clicking to prevent a stuck hover state
function blurOnClick(event: React.MouseEvent<HTMLAnchorElement>): void {
  const target = event.currentTarget;
  setTimeout(() => target.blur(), 0);
}

export function HeroBanner({ title, description, actions = [], backgroundImage }: HeroBannerProps) {
  return (
    <div className="hero-banner" style={{ backgroundImage: backgroundImage ? `url(${backgroundImage})` : '' }}>
      <div className="container">
        <div className="container-inner">
          <div className="hero-banner__content">
            <div tabIndex={0}>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {actions.length > 0 && (
              <div className="hero-banner__actions d-flex flex-column flex-sm-row gap-3">
                {actions.map(action => (
                  action.routerLink ? (
                    <Link
                      key={action.label}
                      className="btn hero-banner-btn slide-l-btn"
                      to={action.routerLink}
                      title={action.title || action.label}
                    >
                      {action.icon && <i className="material-icons">{action.icon}</i>}
                      <span>{action.label}</span>
                    </Link>
                  ) : action.href ? (
                    <a
                      key={action.label}
                      className="btn hero-banner-btn slide-l-btn"
                      href={action.href}
                      target={action.target || '_self'}
                      rel={action.rel || ''}
                      title={action.title || action.label}
                      onClick={blurOnClick}
                    >
                      {action.icon && <i className="material-icons">{action.icon}</i>}
                      <span>{action.label}</span>
                    </a>
                  ) : null
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
