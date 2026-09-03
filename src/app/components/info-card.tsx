import { Link } from 'react-router';
import { safeHtml } from 'app/utils/safe-html';

export interface InfoCardButton {
  text: string;
  link?: string;
  href?: string;
  icon?: string;
  target?: string;
  rel?: string;
  title?: string;
}

interface InfoCardProps {
  title: string;
  description: string;
  icon?: string;
  button?: InfoCardButton;
}

export function InfoCard({ title, description, icon, button }: InfoCardProps) {
  return (
    <div className="feature-block">
      {icon && (
        <div className="feature-block__icon">
          <div
            className="rounded-circle border border-white border-3 d-inline-flex align-items-center justify-content-center"
            style={{ width: '80px', height: '80px' }}
          >
            <i className="material-icons fs-1 text-white">{icon}</i>
          </div>
        </div>
      )}
      <div className="feature-block__header">
        <h3>{title}</h3>
      </div>
      <div className="feature-block__body">
        <p dangerouslySetInnerHTML={safeHtml(description)}></p>
      </div>
      {button && (
        <div className="feature-block__footer">
          {button.link ? (
            <Link
              className="btn btn-sm inverted"
              to={button.link}
              aria-label={button.title || button.text}
            >
              {button.text}
            </Link>
          ) : button.href ? (
            <a
              className="btn btn-sm inverted"
              href={button.href}
              target={button.target || '_self'}
              rel={button.rel || ''}
              title={button.title || button.text}
            >
              {button.text}
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
